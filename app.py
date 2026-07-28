import os

from flask import Flask, redirect, render_template, session, url_for
from flask_limiter.errors import RateLimitExceeded
from flask_talisman import Talisman

from config import Config
from extensions import csrf, db, limiter, migrate
from models import Notification, User
from routes import register_blueprints


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)
    if hasattr(config_object, "validate"):
        config_object.validate()

    db.init_app(app)
    migrate.init_app(app, db, compare_type=compare_column_types, render_as_batch=True)
    csrf.init_app(app)
    limiter.init_app(app)
    configure_security_headers(app)
    register_error_handlers(app)
    register_blueprints(app)
    register_context_processors(app)
    register_root_route(app)

    return app


def configure_security_headers(app):
    frame_sources = ["'self'"]
    frame_sources.extend(f"https://{domain}" for domain in app.config.get("PDF_ALLOWED_DOMAINS", set()))
    Talisman(
        app,
        content_security_policy={
            "default-src": "'self'",
            "script-src": "'self' https://sdk.scdn.co",
            "style-src": "'self'",
            "img-src": "'self' data: https://i.scdn.co https://mosaic.scdn.co",
            "connect-src": "'self' https://api.spotify.com https://accounts.spotify.com https://*.spotify.com wss://*.spotify.com",
            "media-src": "'self' blob: https://*.spotify.com",
            "frame-src": " ".join(frame_sources),
            "object-src": "'none'",
            "base-uri": "'self'",
            "form-action": "'self'",
        },
        force_https=app.config["FORCE_HTTPS"],
        strict_transport_security=app.config["STRICT_TRANSPORT_SECURITY"],
    )


def compare_column_types(context, inspected_column, metadata_column, inspected_type, metadata_type):
    if context.dialect.name == "sqlite":
        sqlite_text_type = inspected_type.__class__.__name__.upper() == "TEXT"
        metadata_date_type = metadata_type.__class__.__name__ in {"Date", "DateTime"}
        if sqlite_text_type and metadata_date_type:
            return False
    return None


def register_error_handlers(app):
    @app.errorhandler(RateLimitExceeded)
    def rate_limit_exceeded(error):
        return render_template("429.html", limit=getattr(error, "description", None)), 429


def register_context_processors(app):
    @app.context_processor
    def inject_user():
        user = None
        account_preferences = {
            "theme": "dark",
            "language": "en",
            "reduced_motion": False,
            "high_contrast": False,
        }
        unread_notifications_count = 0
        if session.get("user_id"):
            user = db.session.get(User, session["user_id"])
            if user and user.settings:
                account_preferences = {
                    "theme": user.settings.theme or "dark",
                    "language": user.settings.language or "en",
                    "reduced_motion": bool(user.settings.reduced_motion),
                    "high_contrast": bool(user.settings.high_contrast),
                }
            unread_notifications_count = Notification.query.filter_by(
                user_id=session["user_id"],
                is_read=False,
            ).count()
        return {
            "current_user": user,
            "account_preferences": account_preferences,
            "unread_notifications_count": unread_notifications_count,
        }


def register_root_route(app):
    @app.route("/")
    def root():
        if session.get("user_id"):
            return redirect(url_for("dashboard.dashboard"))
        return redirect(url_for("auth.login"))


app = create_app()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    debug = app.config["DEBUG"]
    app.run(host=host, port=port, debug=debug)
