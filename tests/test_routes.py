import unittest

from helpers import configure_test_app, create_test_user, db, delete_test_user, login_client


class RouteSmokeTests(unittest.TestCase):
    def setUp(self):
        self.app = configure_test_app()
        self.client = self.app.test_client()
        self.email = "route-smoke@example.com"
        with self.app.app_context():
            delete_test_user(self.email)
            self.user = create_test_user(self.email, username="route_smoke")
            self.user_id = self.user.id
        login_client(self.client, self.user_id)

    def tearDown(self):
        with self.app.app_context():
            delete_test_user(self.email)
            db.session.remove()

    def test_authenticated_pages_render(self):
        expected = {
            "/": 302,
            "/dashboard": 200,
            "/hub": 200,
            "/notes_hub": 200,
            "/notes": 200,
            "/tasks": 200,
            "/flashcards": 200,
            "/timer": 200,
            "/groups": 200,
            "/feed": 200,
            "/profile": 200,
            "/profile/edit": 200,
            "/integrations/spotify": 200,
            "/settings": 200,
            "/settings/security-history": 200,
            "/notifications": 200,
            "/assistant": 200,
            "/achievements": 200,
        }
        for path, status_code in expected.items():
            with self.subTest(path=path):
                response = self.client.get(path, follow_redirects=False)
                self.assertEqual(response.status_code, status_code)


if __name__ == "__main__":
    unittest.main()
