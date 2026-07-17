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
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1" or FLASK_ENV == "development"
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

    @classmethod
    def validate(cls):
        if not cls.IS_PRODUCTION:
            return
        if cls.SECRET_KEY == "dev-secret" or len(cls.SECRET_KEY) < 32:
            raise RuntimeError("SECRET_KEY must be set to a strong value in production.")
        if cls.RATELIMIT_STORAGE_URI == "memory://":
            raise RuntimeError("RATELIMIT_STORAGE_URI must use shared storage in production.")
