import io
import sys
import unittest
from pathlib import Path

from werkzeug.security import generate_password_hash

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app import app  # noqa: E402
from config import Config  # noqa: E402
from extensions import db  # noqa: E402
from models import SecurityEvent, User  # noqa: E402
from services import (  # noqa: E402
    create_email_verification_token,
    create_password_reset_token,
    delete_user_account,
    ensure_account_records,
    password_strength_errors,
    validate_image_upload,
)


class SecurityFlowTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True, WTF_CSRF_ENABLED=False, RATELIMIT_ENABLED=False)
        self.client = app.test_client()
        self.email = "security-test@example.com"
        self.password = "StrongPass123!"
        with app.app_context():
            self._delete_test_user()

    def tearDown(self):
        with app.app_context():
            self._delete_test_user()

    def _delete_test_user(self):
        user = User.query.filter_by(email=self.email).first()
        if user:
            delete_user_account(user)

    def _create_user(self):
        with app.app_context():
            user = User(
                username="security_test",
                email=self.email,
                password_hash=generate_password_hash(self.password),
            )
            db.session.add(user)
            ensure_account_records(user)
            db.session.commit()
            return user.id

    def test_password_strength_rejects_weak_password(self):
        self.assertTrue(password_strength_errors("password"))
        self.assertFalse(password_strength_errors(self.password))

    def test_production_config_rejects_unsafe_defaults(self):
        class UnsafeProductionConfig(Config):
            IS_PRODUCTION = True
            SECRET_KEY = "dev-secret"
            RATELIMIT_STORAGE_URI = "memory://"

        with self.assertRaises(RuntimeError):
            UnsafeProductionConfig.validate()

    def test_production_config_rejects_placeholder_secret(self):
        class PlaceholderProductionConfig(Config):
            IS_PRODUCTION = True
            SECRET_KEY = "replace-with-a-secure-random-string"
            RATELIMIT_STORAGE_URI = "redis://localhost:6379/0"

        with self.assertRaises(RuntimeError):
            PlaceholderProductionConfig.validate()

    def test_future_integration_config_defaults_are_present(self):
        self.assertEqual(Config.OPENAI_MODEL, "gpt-4.1-mini")
        self.assertEqual(Config.STORAGE_BACKEND, "local")
        self.assertIn("https://www.googleapis.com/auth/calendar.events", Config.GOOGLE_OAUTH_SCOPES)
        self.assertTrue(hasattr(Config, "OPENAI_API_KEY"))
        self.assertTrue(hasattr(Config, "SPOTIFY_CLIENT_ID"))
        self.assertTrue(hasattr(Config, "SPOTIFY_CLIENT_SECRET"))
        self.assertTrue(hasattr(Config, "GOOGLE_CLIENT_ID"))
        self.assertTrue(hasattr(Config, "GOOGLE_CLIENT_SECRET"))
        self.assertTrue(hasattr(Config, "STORAGE_ACCESS_KEY_ID"))
        self.assertTrue(hasattr(Config, "STORAGE_SECRET_ACCESS_KEY"))

    def test_register_login_logout_flow(self):
        response = self.client.post(
            "/register",
            data={"username": "security_test", "email": f"  {self.email.upper()}  ", "password": self.password},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/dashboard", response.headers["Location"])
        with app.app_context():
            user = User.query.filter_by(email=self.email).first()
            self.assertIsNotNone(user)
            self.assertEqual(user.email, self.email)
            self.assertFalse(user.email_verified)
            self.assertIsNotNone(user.email_verification_token_hash)
            self.assertEqual(
                SecurityEvent.query.filter_by(user_id=user.id, event_type="account.registered").count(),
                1,
            )

        self.client.post("/logout", follow_redirects=False)
        with self.client.session_transaction() as sess:
            sess["pre_login_marker"] = "clear-me"
        response = self.client.post(
            "/login",
            data={"email": self.email.upper(), "password": self.password},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/dashboard", response.headers["Location"])
        with self.client.session_transaction() as sess:
            self.assertNotIn("pre_login_marker", sess)
        with app.app_context():
            user = User.query.filter_by(email=self.email).first()
            self.assertGreaterEqual(
                SecurityEvent.query.filter_by(user_id=user.id, event_type="auth.login_success").count(),
                1,
            )

        response = self.client.get("/logout", follow_redirects=False)
        self.assertEqual(response.status_code, 302)
        self.assertNotEqual(response.headers["Location"], "/login")

        response = self.client.post("/logout", follow_redirects=False)
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login", response.headers["Location"])

    def test_email_verification_token_marks_email_verified(self):
        user_id = self._create_user()
        with app.app_context():
            user = db.session.get(User, user_id)
            token = create_email_verification_token(user)
            db.session.commit()

        response = self.client.get(f"/verify-email/{token}", follow_redirects=False)
        self.assertEqual(response.status_code, 302)

        with app.app_context():
            user = db.session.get(User, user_id)
            self.assertTrue(user.email_verified)
            self.assertIsNone(user.email_verification_token_hash)
            self.assertEqual(
                SecurityEvent.query.filter_by(user_id=user.id, event_type="email.verified").count(),
                1,
            )

    def test_password_reset_flow_updates_password_and_clears_token(self):
        user_id = self._create_user()
        with app.app_context():
            user = db.session.get(User, user_id)
            token = create_password_reset_token(user)
            db.session.commit()

        page = self.client.get(f"/reset-password/{token}")
        self.assertEqual(page.status_code, 200)

        response = self.client.post(
            f"/reset-password/{token}",
            data={"password": "ResetPass123!", "confirm_password": "ResetPass123!"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login", response.headers["Location"])

        with app.app_context():
            user = db.session.get(User, user_id)
            self.assertIsNone(user.password_reset_token_hash)
            self.assertIsNone(user.password_reset_sent_at)
            self.assertEqual(
                SecurityEvent.query.filter_by(user_id=user.id, event_type="password.reset_completed").count(),
                1,
            )

        old_login = self.client.post(
            "/login",
            data={"email": self.email, "password": self.password},
            follow_redirects=False,
        )
        self.assertIn("/login", old_login.headers["Location"])

        new_login = self.client.post(
            "/login",
            data={"email": self.email, "password": "ResetPass123!"},
            follow_redirects=False,
        )
        self.assertIn("/dashboard", new_login.headers["Location"])

    def test_forgot_password_does_not_reveal_unknown_email(self):
        response = self.client.post(
            "/forgot-password",
            data={"email": "nobody@example.com"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login", response.headers["Location"])
        with app.app_context():
            self.assertGreaterEqual(
                SecurityEvent.query.filter_by(event_type="password.reset_requested_unknown").count(),
                1,
            )

    def test_image_upload_rejects_extension_spoof(self):
        with app.test_request_context():
            from werkzeug.datastructures import FileStorage

            fake_image = FileStorage(
                stream=io.BytesIO(b"not actually a png"),
                filename="avatar.png",
                content_type="image/png",
            )
            is_valid, _ = validate_image_upload(fake_image)
            self.assertFalse(is_valid)


if __name__ == "__main__":
    unittest.main()
