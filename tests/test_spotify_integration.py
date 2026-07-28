import unittest
from urllib.parse import parse_qs, urlparse

from helpers import configure_test_app, create_test_user, db, delete_test_user, login_client
from routes.integrations import SPOTIFY_TOKEN_STORE, store_spotify_token


class SpotifyIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.app = configure_test_app()
        self.app.config.update(
            SPOTIFY_CLIENT_ID="test-client-id",
            SPOTIFY_CLIENT_SECRET="test-client-secret",
            SPOTIFY_REDIRECT_URI="http://127.0.0.1:5000/integrations/spotify/callback",
        )
        self.client = self.app.test_client()
        self.email = "spotify-test@example.com"
        with self.app.app_context():
            delete_test_user(self.email)
            self.user = create_test_user(self.email, username="spotify_test")
            self.user_id = self.user.id
        login_client(self.client, self.user_id)

    def tearDown(self):
        SPOTIFY_TOKEN_STORE.pop(self.user_id, None)
        with self.app.app_context():
            delete_test_user(self.email)
            db.session.remove()

    def test_spotify_page_renders(self):
        response = self.client.get("/integrations/spotify")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Spotify Playback", response.data)

    def test_spotify_connect_redirect_uses_configured_scopes(self):
        response = self.client.get("/integrations/spotify/connect", follow_redirects=False)
        self.assertEqual(response.status_code, 302)
        location = response.headers["Location"]
        parsed = urlparse(location)
        query = parse_qs(parsed.query)
        self.assertEqual(parsed.netloc, "accounts.spotify.com")
        self.assertEqual(query["client_id"], ["test-client-id"])
        self.assertEqual(query["redirect_uri"], ["http://127.0.0.1:5000/integrations/spotify/callback"])
        self.assertIn("streaming", query["scope"][0])
        self.assertIn("user-modify-playback-state", query["scope"][0])

    def test_spotify_token_requires_active_connection(self):
        response = self.client.get("/integrations/spotify/token")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json["error"], "Spotify needs to be reconnected.")

    def test_spotify_access_token_is_not_stored_in_browser_session(self):
        with self.client:
            with self.client.session_transaction() as sess:
                sess["user_id"] = self.user_id
            store_spotify_token(
                {"access_token": "server-side-token", "expires_in": 3600, "scope": "streaming"},
                user_id=self.user_id,
            )
            with self.client.session_transaction() as sess:
                self.assertNotIn("spotify_access_token", sess)
                self.assertNotIn("spotify_token_expires_at", sess)

            response = self.client.get("/integrations/spotify/token")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json["access_token"], "server-side-token")


if __name__ == "__main__":
    unittest.main()
