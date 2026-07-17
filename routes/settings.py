import json

from flask import Blueprint, Response, current_app, flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from auth_helpers import login_required
from extensions import db
from models import SecurityEvent, User
from services import (
    delete_user_account,
    create_email_verification_token,
    ensure_account_records,
    export_user_data,
    build_absolute_url,
    create_pending_email_token,
    hash_token,
    log_security_event,
    mail_configured,
    normalize_email,
    password_strength_errors,
    pending_email_expired,
    sanitize_plain,
    send_email,
    timestamp_now,
)


settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    user = db.session.get(User, session["user_id"])
    profile_record, user_settings = ensure_account_records(user)

    if request.method == "POST":
        theme = request.form.get("theme", "dark")
        if theme not in {"dark", "high-contrast"}:
            theme = "dark"

        language = sanitize_plain(request.form.get("language")) or "en"
        timezone = sanitize_plain(request.form.get("timezone")) or "UTC"

        user_settings.theme = theme
        user_settings.language = language[:16]
        user_settings.timezone = timezone[:64]
        user_settings.reduced_motion = request.form.get("reduced_motion") == "on"
        user_settings.high_contrast = request.form.get("high_contrast") == "on"
        user_settings.email_notifications = request.form.get("email_notifications") == "on"
        user_settings.study_reminders = request.form.get("study_reminders") == "on"
        user_settings.updated_at = timestamp_now()
        log_security_event(user.id, "settings.updated")
        db.session.commit()
        flash("Settings saved.", "success")
        return redirect(url_for("settings.settings"))

    db.session.commit()
    return render_template(
        "settings.html",
        user=user,
        profile_record=profile_record,
        user_settings=user_settings,
    )


@settings_bp.route("/settings/change-password", methods=["POST"])
@login_required
def change_password():
    user = db.session.get(User, session["user_id"])
    current_password = request.form.get("current_password", "")
    new_password = request.form.get("new_password", "")
    confirm_password = request.form.get("confirm_password", "")

    if not check_password_hash(user.password_hash, current_password):
        log_security_event(user.id, "password.change_failed", {"reason": "current_password"})
        db.session.commit()
        flash("Current password is incorrect.", "error")
        return redirect(url_for("settings.settings"))

    if new_password != confirm_password:
        log_security_event(user.id, "password.change_failed", {"reason": "confirmation"})
        db.session.commit()
        flash("New password confirmation does not match.", "error")
        return redirect(url_for("settings.settings"))

    password_errors = password_strength_errors(new_password)
    if password_errors:
        log_security_event(user.id, "password.change_failed", {"reason": "strength"})
        db.session.commit()
        for error in password_errors:
            flash(error, "error")
        return redirect(url_for("settings.settings"))

    user.password_hash = generate_password_hash(new_password)
    log_security_event(user.id, "password.changed")
    db.session.commit()
    flash("Password changed successfully.", "success")
    return redirect(url_for("settings.settings"))


@settings_bp.route("/settings/change-email", methods=["POST"])
@login_required
def change_email():
    user = db.session.get(User, session["user_id"])
    new_email = normalize_email(request.form.get("new_email"))
    password = request.form.get("password", "")

    if not new_email:
        flash("New email is required.", "error")
        return redirect(url_for("settings.settings"))
    if not check_password_hash(user.password_hash, password):
        log_security_event(user.id, "email.change_failed", {"reason": "password"})
        db.session.commit()
        flash("Password confirmation failed.", "error")
        return redirect(url_for("settings.settings"))
    if new_email == user.email:
        flash("That email is already on your account.", "error")
        return redirect(url_for("settings.settings"))
    if User.query.filter(User.email == new_email, User.id != user.id).first():
        log_security_event(user.id, "email.change_failed", {"reason": "duplicate"})
        db.session.commit()
        flash("That email is already in use.", "error")
        return redirect(url_for("settings.settings"))

    token = create_pending_email_token(user, new_email)
    confirmation_path = url_for("settings.confirm_email_change", token=token, _external=False)
    log_security_event(user.id, "email.change_requested")
    if mail_configured():
        send_email(
            new_email,
            "Confirm your Study Space email change",
            f"Confirm your Study Space email change here: {build_absolute_url(confirmation_path)}",
        )
        log_security_event(user.id, "email.change_confirmation_sent")
    db.session.commit()
    flash("Email change confirmation prepared.", "success")
    if not mail_configured() and not current_app.config.get("IS_PRODUCTION"):
        flash(confirmation_path, "success")
    return redirect(url_for("settings.settings"))


@settings_bp.route("/settings/confirm-email-change/<token>")
def confirm_email_change(token):
    user = User.query.filter_by(pending_email_token_hash=hash_token(token)).first()
    if not user:
        flash("Email change link is invalid.", "error")
        return redirect(url_for("auth.login"))
    if pending_email_expired(user):
        log_security_event(user.id, "email.change_failed", {"reason": "expired"})
        user.pending_email = None
        user.pending_email_token_hash = None
        user.pending_email_sent_at = None
        db.session.commit()
        flash("Email change link has expired.", "error")
        return redirect(url_for("settings.settings") if session.get("user_id") else url_for("auth.login"))
    if User.query.filter(User.email == user.pending_email, User.id != user.id).first():
        log_security_event(user.id, "email.change_failed", {"reason": "duplicate_on_confirm"})
        db.session.commit()
        flash("That email is already in use.", "error")
        return redirect(url_for("settings.settings") if session.get("user_id") else url_for("auth.login"))

    old_email = user.email
    user.email = user.pending_email
    user.email_verified = True
    user.pending_email = None
    user.pending_email_token_hash = None
    user.pending_email_sent_at = None
    user.email_verification_token_hash = None
    user.email_verification_sent_at = None
    log_security_event(user.id, "email.changed", {"old_email": old_email})
    db.session.commit()
    flash("Email changed and verified successfully.", "success")
    return redirect(url_for("settings.settings") if session.get("user_id") else url_for("auth.login"))


@settings_bp.route("/settings/resend-verification", methods=["POST"])
@login_required
def resend_verification():
    user = db.session.get(User, session["user_id"])
    if user.email_verified:
        flash("Email is already verified.", "success")
        return redirect(url_for("settings.settings"))

    token = create_email_verification_token(user)
    log_security_event(user.id, "email.verification_requested")
    verification_path = url_for("auth.verify_email", token=token, _external=False)
    if mail_configured():
        send_email(
            user.email,
            "Verify your Study Space email",
            f"Verify your Study Space email here: {build_absolute_url(verification_path)}",
        )
        log_security_event(user.id, "email.verification_sent")
    db.session.commit()
    flash("Verification link prepared.", "success")
    if not mail_configured() and not current_app.config.get("IS_PRODUCTION"):
        flash(verification_path, "success")
    return redirect(url_for("settings.settings"))


@settings_bp.route("/settings/security-history")
@login_required
def security_history():
    events = (
        SecurityEvent.query.filter_by(user_id=session["user_id"])
        .order_by(SecurityEvent.created_at.desc())
        .limit(50)
        .all()
    )
    return render_template("security_history.html", events=events)


@settings_bp.route("/settings/export")
@login_required
def export_account():
    user = db.session.get(User, session["user_id"])
    payload = export_user_data(user)
    log_security_event(user.id, "account.exported")
    db.session.commit()
    filename = f"study-space-export-{user.id}.json"
    return Response(
        json.dumps(payload, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@settings_bp.route("/settings/delete-account", methods=["POST"])
@login_required
def delete_account():
    user = db.session.get(User, session["user_id"])
    password = request.form.get("password", "")
    confirmation = request.form.get("confirmation", "")

    if confirmation != "DELETE":
        log_security_event(user.id, "account.delete_failed", {"reason": "confirmation"})
        db.session.commit()
        flash("Type DELETE to confirm account deletion.", "error")
        return redirect(url_for("settings.settings"))
    if not check_password_hash(user.password_hash, password):
        log_security_event(user.id, "account.delete_failed", {"reason": "password"})
        db.session.commit()
        flash("Password confirmation failed.", "error")
        return redirect(url_for("settings.settings"))

    log_security_event(user.id, "account.deleted")
    delete_user_account(user)
    session.clear()
    flash("Your account and Study Space data have been deleted.", "success")
    return redirect(url_for("auth.register"))
