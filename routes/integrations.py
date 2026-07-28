import base64
import json
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, session, url_for

from auth_helpers import login_required
from services import current_user_id


integrations_bp = Blueprint("integrations", __name__)

SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "playlist-read-collaborative",
]
SPOTIFY_TOKEN_STORE = {}


def spotify_configured():
    return bool(
        current_app.config.get("SPOTIFY_CLIENT_ID")
        and current_app.config.get("SPOTIFY_CLIENT_SECRET")
        and current_app.config.get("SPOTIFY_REDIRECT_URI")
    )


def spotify_token_record():
    user_id = session.get("user_id")
    if not user_id:
        return None
    record = SPOTIFY_TOKEN_STORE.get(user_id)
    if not record or record.get("expires_at", 0) <= time.time():
        SPOTIFY_TOKEN_STORE.pop(user_id, None)
        return None
    return record


def spotify_token_active():
    return bool(spotify_token_record())


def spotify_auth_header():
    credentials = f"{current_app.config['SPOTIFY_CLIENT_ID']}:{current_app.config['SPOTIFY_CLIENT_SECRET']}"
    encoded = base64.b64encode(credentials.encode("utf-8")).decode("ascii")
    return f"Basic {encoded}"


def spotify_request(method, url, access_token=None, data=None):
    headers = {"Accept": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as response:
            if response.status == 204:
                return None
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Spotify API error {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError("Unable to reach Spotify.") from exc


def exchange_spotify_code(code):
    data = urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": current_app.config["SPOTIFY_REDIRECT_URI"],
        }
    ).encode("utf-8")
    req = Request(
        SPOTIFY_TOKEN_URL,
        data=data,
        headers={
            "Authorization": spotify_auth_header(),
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Spotify token exchange failed {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError("Unable to reach Spotify authorization server.") from exc


def store_spotify_token(token_payload, user_id=None):
    expires_in = int(token_payload.get("expires_in", 3600))
    token_owner_id = user_id or current_user_id()
    SPOTIFY_TOKEN_STORE[token_owner_id] = {
        "access_token": token_payload["access_token"],
        "expires_at": time.time() + max(60, expires_in - 60),
        "scope": token_payload.get("scope", ""),
    }


def spotify_profile():
    token = spotify_token_record()
    if not token:
        return None
    try:
        return spotify_request("GET", f"{SPOTIFY_API_BASE}/me", token["access_token"])
    except RuntimeError:
        return None


@integrations_bp.route("/integrations/spotify")
@login_required
def spotify():
    profile = spotify_profile()
    return render_template(
        "spotify.html",
        spotify_configured=spotify_configured(),
        spotify_connected=spotify_token_active(),
        spotify_profile=profile,
        spotify_scopes=SPOTIFY_SCOPES,
    )


@integrations_bp.route("/integrations/spotify/connect")
@login_required
def spotify_connect():
    if not spotify_configured():
        flash("Spotify is not configured yet. Add Spotify credentials to .env first.", "error")
        return redirect(url_for("integrations.spotify"))
    state = secrets.token_urlsafe(24)
    session["spotify_oauth_state"] = state
    params = {
        "client_id": current_app.config["SPOTIFY_CLIENT_ID"],
        "response_type": "code",
        "redirect_uri": current_app.config["SPOTIFY_REDIRECT_URI"],
        "scope": " ".join(SPOTIFY_SCOPES),
        "state": state,
        "show_dialog": "true",
    }
    return redirect(f"{SPOTIFY_AUTHORIZE_URL}?{urlencode(params)}")


@integrations_bp.route("/integrations/spotify/callback")
@login_required
def spotify_callback():
    if request.args.get("error"):
        flash("Spotify connection was cancelled or denied.", "error")
        return redirect(url_for("integrations.spotify"))
    if request.args.get("state") != session.pop("spotify_oauth_state", None):
        flash("Spotify connection could not be verified. Please try again.", "error")
        return redirect(url_for("integrations.spotify"))
    code = request.args.get("code")
    if not code:
        flash("Spotify did not return an authorization code.", "error")
        return redirect(url_for("integrations.spotify"))
    try:
        store_spotify_token(exchange_spotify_code(code))
        profile = spotify_profile()
        if profile:
            session["spotify_display_name"] = profile.get("display_name") or profile.get("id")
        flash("Spotify connected.", "success")
    except RuntimeError as exc:
        current_app.logger.warning("Spotify OAuth failed: %s", exc)
        flash("Spotify connection failed. Check the redirect URI and app credentials.", "error")
    return redirect(url_for("integrations.spotify"))


@integrations_bp.route("/integrations/spotify/token")
@login_required
def spotify_token():
    token = spotify_token_record()
    if not token:
        return jsonify({"error": "Spotify needs to be reconnected."}), 401
    return jsonify(
        {
            "access_token": token["access_token"],
            "expires_at": int(token["expires_at"]),
        }
    )


@integrations_bp.route("/integrations/spotify/transfer", methods=["POST"])
@login_required
def spotify_transfer():
    token = spotify_token_record()
    if not token:
        return jsonify({"error": "Spotify needs to be reconnected."}), 401
    payload = request.get_json(silent=True) or {}
    device_id = payload.get("device_id")
    if not device_id:
        return jsonify({"error": "Missing Spotify device ID."}), 400
    try:
        spotify_request(
            "PUT",
            f"{SPOTIFY_API_BASE}/me/player",
            token["access_token"],
            {"device_ids": [device_id], "play": False},
        )
    except RuntimeError as exc:
        current_app.logger.info("Spotify playback transfer failed: %s", exc)
        return jsonify({"error": "Unable to transfer Spotify playback. Premium may be required."}), 502
    return jsonify({"ok": True})


@integrations_bp.route("/integrations/spotify/disconnect", methods=["POST"])
@login_required
def spotify_disconnect():
    SPOTIFY_TOKEN_STORE.pop(session.get("user_id"), None)
    for key in (
        "spotify_display_name",
        "spotify_oauth_state",
    ):
        session.pop(key, None)
    flash("Spotify disconnected from this browser session.", "success")
    return redirect(url_for("integrations.spotify"))
