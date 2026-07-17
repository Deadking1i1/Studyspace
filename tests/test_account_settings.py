import unittest

from werkzeug.security import generate_password_hash

from helpers import configure_test_app, create_test_user, db, delete_test_user, login_client
from models import (
    Group,
    GroupMember,
    Note,
    Post,
    SecurityEvent,
    StudySession,
    Task,
    User,
    UserProfile,
    UserSettings,
)
from services import timestamp_now


class AccountSettingsTests(unittest.TestCase):
    def setUp(self):
        self.app = configure_test_app()
        self.client = self.app.test_client()
        self.email = "account-settings@example.com"
        with self.app.app_context():
            delete_test_user(self.email)
            delete_test_user("account-settings-peer@example.com")
            delete_test_user("new.account@example.com")
            self.user = create_test_user(self.email, username="account_settings")
            self.user_id = self.user.id
        login_client(self.client, self.user_id)

    def tearDown(self):
        with self.app.app_context():
            delete_test_user(self.email)
            delete_test_user("account-settings-peer@example.com")
            delete_test_user("new.account@example.com")
            db.session.remove()

    def test_profile_and_settings_write_to_normalized_records(self):
        profile_response = self.client.post(
            "/profile/edit",
            data={
                "display_name": "Ada Student",
                "course": "Computer Science",
                "bio": "Learning systems carefully.",
                "institution": "Study Space University",
                "education_level": "University",
                "field_of_study": "Software Engineering",
                "country": "South Africa",
                "profile_visibility": "classmates",
                "show_academic_profile": "on",
            },
            follow_redirects=False,
        )
        self.assertEqual(profile_response.status_code, 302)

        settings_response = self.client.post(
            "/settings",
            data={
                "theme": "high-contrast",
                "language": "en-ZA",
                "timezone": "Africa/Johannesburg",
                "reduced_motion": "on",
                "high_contrast": "on",
                "study_reminders": "on",
            },
            follow_redirects=False,
        )
        self.assertEqual(settings_response.status_code, 302)

        with self.app.app_context():
            profile = UserProfile.query.filter_by(user_id=self.user_id).first()
            settings = UserSettings.query.filter_by(user_id=self.user_id).first()
            user = db.session.get(User, self.user_id)

            self.assertEqual(profile.display_name, "Ada Student")
            self.assertEqual(profile.profile_visibility, "classmates")
            self.assertTrue(profile.show_academic_profile)
            self.assertFalse(profile.show_email)
            self.assertEqual(settings.theme, "high-contrast")
            self.assertEqual(settings.timezone, "Africa/Johannesburg")
            self.assertTrue(settings.reduced_motion)
            self.assertFalse(settings.email_notifications)
            self.assertEqual(user.course, "Computer Science")

        rendered = self.client.get("/settings")
        html = rendered.get_data(as_text=True)
        self.assertIn('<html lang="en-ZA">', html)
        self.assertIn("theme-high-contrast", html)
        self.assertIn("high-contrast", html)
        self.assertIn("reduce-motion", html)

    def test_export_includes_user_owned_data(self):
        with self.app.app_context():
            db.session.add(
                Note(
                    user_id=self.user_id,
                    title="Exported note",
                    content="This belongs in the export.",
                    created_at=timestamp_now(),
                )
            )
            db.session.commit()

        response = self.client.get("/settings/export")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/json")
        self.assertIn("attachment;", response.headers["Content-Disposition"])
        payload = response.get_json()
        self.assertEqual(payload["user"]["email"], self.email)
        self.assertNotIn("password_hash", payload["user"])
        self.assertEqual(payload["notes"][0]["title"], "Exported note")
        self.assertIn("settings", payload)
        with self.app.app_context():
            self.assertEqual(
                SecurityEvent.query.filter_by(user_id=self.user_id, event_type="account.exported").count(),
                1,
            )

    def test_change_password_validates_and_updates_hash(self):
        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            user.password_hash = generate_password_hash("OldPass123!")
            db.session.commit()

        failed = self.client.post(
            "/settings/change-password",
            data={
                "current_password": "wrong",
                "new_password": "NewPass1234!",
                "confirm_password": "NewPass1234!",
            },
            follow_redirects=False,
        )
        self.assertEqual(failed.status_code, 302)

        changed = self.client.post(
            "/settings/change-password",
            data={
                "current_password": "OldPass123!",
                "new_password": "NewPass1234!",
                "confirm_password": "NewPass1234!",
            },
            follow_redirects=False,
        )
        self.assertEqual(changed.status_code, 302)

        self.client.post("/logout", follow_redirects=False)
        old_login = self.client.post(
            "/login",
            data={"email": self.email, "password": "OldPass123!"},
            follow_redirects=False,
        )
        self.assertIn("/login", old_login.headers["Location"])

        new_login = self.client.post(
            "/login",
            data={"email": self.email, "password": "NewPass1234!"},
            follow_redirects=False,
        )
        self.assertIn("/dashboard", new_login.headers["Location"])

        with self.app.app_context():
            self.assertEqual(
                SecurityEvent.query.filter_by(user_id=self.user_id, event_type="password.changed").count(),
                1,
            )
            self.assertGreaterEqual(
                SecurityEvent.query.filter_by(user_id=self.user_id, event_type="password.change_failed").count(),
                1,
            )

    def test_resend_email_verification_refreshes_token(self):
        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            user.email_verified = False
            user.email_verification_token_hash = None
            user.email_verification_sent_at = None
            db.session.commit()

        response = self.client.post("/settings/resend-verification", follow_redirects=False)
        self.assertEqual(response.status_code, 302)

        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            self.assertFalse(user.email_verified)
            self.assertIsNotNone(user.email_verification_token_hash)
            self.assertIsNotNone(user.email_verification_sent_at)
            self.assertEqual(
                SecurityEvent.query.filter_by(user_id=self.user_id, event_type="email.verification_requested").count(),
                1,
            )

    def test_change_email_requires_confirmation_token(self):
        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            user.password_hash = generate_password_hash("EmailPass123!")
            user.email_verified = True
            db.session.commit()

        response = self.client.post(
            "/settings/change-email",
            data={"new_email": "New.Account@example.com", "password": "EmailPass123!"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)

        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            self.assertEqual(user.email, self.email)
            self.assertEqual(user.pending_email, "new.account@example.com")
            token_hash = user.pending_email_token_hash
            self.assertIsNotNone(token_hash)

        from services import hash_token
        token = None
        # Test-only token recovery is impossible by design; create a fresh token to exercise confirmation.
        with self.app.app_context():
            from services import create_pending_email_token

            user = db.session.get(User, self.user_id)
            token = create_pending_email_token(user, "new.account@example.com")
            db.session.commit()

        confirmed = self.client.get(f"/settings/confirm-email-change/{token}", follow_redirects=False)
        self.assertEqual(confirmed.status_code, 302)

        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            self.assertEqual(user.email, "new.account@example.com")
            self.assertTrue(user.email_verified)
            self.assertIsNone(user.pending_email)
            self.assertIsNone(user.pending_email_token_hash)
            self.assertEqual(SecurityEvent.query.filter_by(user_id=self.user_id, event_type="email.changed").count(), 1)

    def test_security_history_renders_user_events(self):
        with self.app.app_context():
            db.session.add(
                SecurityEvent(
                    user_id=self.user_id,
                    event_type="security.history_test",
                    created_at=timestamp_now(),
                )
            )
            db.session.commit()

        response = self.client.get("/settings/security-history")
        self.assertEqual(response.status_code, 200)
        self.assertIn("security.history_test", response.get_data(as_text=True))

    def test_delete_account_requires_password_and_removes_owned_data(self):
        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            user.password_hash = generate_password_hash("DeletePass123!")
            db.session.add(Task(user_id=self.user_id, task="Delete me", created_at=timestamp_now()))
            db.session.add(StudySession(user_id=self.user_id, duration_minutes=15, started_at=timestamp_now()))
            db.session.commit()

        failed = self.client.post(
            "/settings/delete-account",
            data={"password": "wrong", "confirmation": "DELETE"},
            follow_redirects=False,
        )
        self.assertEqual(failed.status_code, 302)

        with self.app.app_context():
            self.assertIsNotNone(db.session.get(User, self.user_id))

        deleted = self.client.post(
            "/settings/delete-account",
            data={"password": "DeletePass123!", "confirmation": "DELETE"},
            follow_redirects=False,
        )
        self.assertEqual(deleted.status_code, 302)

        with self.app.app_context():
            self.assertIsNone(db.session.get(User, self.user_id))
            self.assertEqual(Task.query.filter_by(user_id=self.user_id).count(), 0)
            self.assertEqual(StudySession.query.filter_by(user_id=self.user_id).count(), 0)
            self.assertEqual(UserProfile.query.filter_by(user_id=self.user_id).count(), 0)
            self.assertEqual(UserSettings.query.filter_by(user_id=self.user_id).count(), 0)
            self.assertEqual(
                SecurityEvent.query.filter_by(user_id=self.user_id, event_type="account.deleted").count(),
                1,
            )

    def test_delete_account_transfers_shared_group_ownership(self):
        peer_email = "account-settings-peer@example.com"
        with self.app.app_context():
            user = db.session.get(User, self.user_id)
            user.password_hash = generate_password_hash("DeletePass123!")
            peer = create_test_user(peer_email, username="account_settings_peer")
            group = Group(
                name="Shared Study Group",
                description="A group that should survive account deletion.",
                created_by=self.user_id,
                created_at=timestamp_now(),
                member_count=2,
            )
            db.session.add(group)
            db.session.flush()
            db.session.add(GroupMember(group_id=group.id, user_id=self.user_id, joined_at=timestamp_now()))
            db.session.add(GroupMember(group_id=group.id, user_id=peer.id, joined_at=timestamp_now()))
            db.session.add(Post(user_id=self.user_id, group_id=group.id, content="Remove my post.", created_at=timestamp_now()))
            db.session.add(Post(user_id=peer.id, group_id=group.id, content="Keep peer post.", created_at=timestamp_now()))
            db.session.commit()
            group_id = group.id
            peer_id = peer.id

        response = self.client.post(
            "/settings/delete-account",
            data={"password": "DeletePass123!", "confirmation": "DELETE"},
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)

        with self.app.app_context():
            group = db.session.get(Group, group_id)
            self.assertIsNotNone(group)
            self.assertEqual(group.created_by, peer_id)
            self.assertEqual(GroupMember.query.filter_by(group_id=group_id, user_id=self.user_id).count(), 0)
            self.assertEqual(GroupMember.query.filter_by(group_id=group_id, user_id=peer_id).count(), 1)
            self.assertEqual(Post.query.filter_by(group_id=group_id, user_id=self.user_id).count(), 0)
            self.assertEqual(Post.query.filter_by(group_id=group_id, user_id=peer_id).count(), 1)


if __name__ == "__main__":
    unittest.main()
