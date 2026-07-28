import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", str(BASE_DIR / "database.db"))
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

FLASK_ENV = os.getenv("FLASK_ENV", "development")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    IS_PRODUCTION = FLASK_ENV == "production"
    DEBUG = False if IS_PRODUCTION else os.getenv("FLASK_DEBUG", "0") == "1" or FLASK_ENV == "development"
    SESSION_COOKIE_SECURE = IS_PRODUCTION
    REMEMBER_COOKIE_SECURE = IS_PRODUCTION
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    WTF_CSRF_CHECK_DEFAULT = True
    WTF_CSRF_TIME_LIMIT = None
    FORCE_HTTPS = IS_PRODUCTION
    STRICT_TRANSPORT_SECURITY = IS_PRODUCTION
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    AUTH_REGISTER_RATE_LIMIT = os.getenv(
        "AUTH_REGISTER_RATE_LIMIT",
        "3 per minute" if IS_PRODUCTION else "30 per minute",
    )
    AUTH_LOGIN_RATE_LIMIT = os.getenv(
        "AUTH_LOGIN_RATE_LIMIT",
        "5 per minute" if IS_PRODUCTION else "30 per minute",
    )
    AUTH_PASSWORD_RESET_RATE_LIMIT = os.getenv(
        "AUTH_PASSWORD_RESET_RATE_LIMIT",
        "5 per minute" if IS_PRODUCTION else "20 per minute",
    )
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + str(BASE_DIR / DATABASE_URL) if not DATABASE_URL.startswith(("postgresql://", "postgres://", "mysql://")) else DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    # Upload settings
    UPLOAD_FOLDER = str(BASE_DIR / "static" / "uploads")
    MAX_CONTENT_LENGTH = 4 * 1024 * 1024  # 4MB
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
    ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/gif"}
    PDF_ALLOWED_DOMAINS = {
        domain.strip().lower()
        for domain in os.getenv("PDF_ALLOWED_DOMAINS", "").split(",")
        if domain.strip()
    }
    MAIL_SERVER = os.getenv("MAIL_SERVER", "")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "1") == "1"
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", MAIL_USERNAME)
    APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:5000")
    # Future integration settings. These are intentionally optional until the
    # corresponding product features are implemented.
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
    SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")
    GOOGLE_OAUTH_SCOPES = [
        scope.strip()
        for scope in os.getenv(
            "GOOGLE_OAUTH_SCOPES",
            "openid,email,profile,https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/drive.file",
        ).split(",")
        if scope.strip()
    ]
    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
    STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "")
    STORAGE_REGION = os.getenv("STORAGE_REGION", "")
    STORAGE_ENDPOINT_URL = os.getenv("STORAGE_ENDPOINT_URL", "")
    STORAGE_ACCESS_KEY_ID = os.getenv("STORAGE_ACCESS_KEY_ID", "")
    STORAGE_SECRET_ACCESS_KEY = os.getenv("STORAGE_SECRET_ACCESS_KEY", "")
    STORAGE_PUBLIC_BASE_URL = os.getenv("STORAGE_PUBLIC_BASE_URL", "")

    @classmethod
    def validate(cls):
        if not cls.IS_PRODUCTION:
            return
        unsafe_secret_keys = {
            "dev-secret",
            "replace-with-a-secure-random-string",
            "replace-with-a-long-random-secret-from-a-password-manager",
        }
        if cls.SECRET_KEY in unsafe_secret_keys or len(cls.SECRET_KEY) < 32:
            raise RuntimeError("SECRET_KEY must be set to a strong value in production.")
        if os.getenv("FLASK_DEBUG", "0") == "1":
            raise RuntimeError("FLASK_DEBUG must be disabled in production.")
        if cls.RATELIMIT_STORAGE_URI == "memory://":
            raise RuntimeError("RATELIMIT_STORAGE_URI must use shared storage in production.")
