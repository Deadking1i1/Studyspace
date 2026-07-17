import sys
from pathlib import Path

from werkzeug.security import generate_password_hash

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import SecurityEvent, User  # noqa: E402
from services import delete_user_account, ensure_account_records  # noqa: E402


def configure_test_app():
    app.config.update(TESTING=True, WTF_CSRF_ENABLED=False, RATELIMIT_ENABLED=False)
    return app


def create_test_user(email, username="test_user", password="StrongPass123!"):
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
        )
        db.session.add(user)
        ensure_account_records(user)
        db.session.commit()
    return user


def delete_test_user(email):
    user = User.query.filter_by(email=email).first()
    if not user:
        return
    SecurityEvent.query.filter_by(user_id=user.id).delete()
    delete_user_account(user)


def login_client(client, user_id):
    with client.session_transaction() as sess:
        sess["user_id"] = user_id
