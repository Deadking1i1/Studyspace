import unittest

from helpers import configure_test_app, create_test_user, db, delete_test_user, login_client
from models import Note, StudySession, Task
from services import timestamp_now


class WriteFlowTests(unittest.TestCase):
    def setUp(self):
        self.app = configure_test_app()
        self.client = self.app.test_client()
        self.email = "write-flow@example.com"
        with self.app.app_context():
            delete_test_user(self.email)
            self.user = create_test_user(self.email, username="write_flow")
            self.user_id = self.user.id
        login_client(self.client, self.user_id)

    def tearDown(self):
        with self.app.app_context():
            delete_test_user(self.email)
            db.session.remove()

    def test_task_and_study_session_writes(self):
        task_response = self.client.post(
            "/tasks",
            data={
                "task": "Finish cleanup smoke test",
                "subject": "Engineering",
                "priority": "high",
                "due": "2026-07-10",
            },
            follow_redirects=False,
        )
        self.assertEqual(task_response.status_code, 302)

        session_response = self.client.post(
            "/study-sessions",
            json={"duration_minutes": 25},
            follow_redirects=False,
        )
        self.assertEqual(session_response.status_code, 200)

        with self.app.app_context():
            task = Task.query.filter_by(user_id=self.user_id).first()
            self.assertIsNotNone(task)
            self.assertEqual(task.priority, "high")
            self.assertEqual(StudySession.query.filter_by(user_id=self.user_id).count(), 1)

    def test_note_state_actions(self):
        response = self.client.post(
            "/notes_hub",
            data={
                "title": "Photosynthesis",
                "content": "Plants turn light into energy.",
                "subject": "Biology",
                "tags": "exam,chapter 2",
                "visibility": "private",
            },
            follow_redirects=False,
        )
        self.assertEqual(response.status_code, 302)

        with self.app.app_context():
            note = Note.query.filter_by(user_id=self.user_id).first()
            self.assertIsNotNone(note)
            note_id = note.id

        self.assertEqual(self.client.post(f"/notes/{note_id}/favorite").status_code, 302)
        self.assertEqual(self.client.post(f"/notes/{note_id}/pin").status_code, 302)
        self.assertEqual(self.client.post(f"/notes/{note_id}/archive").status_code, 302)

        with self.app.app_context():
            note = db.session.get(Note, note_id)
            self.assertTrue(note.is_favorite)
            self.assertTrue(note.is_pinned)
            self.assertTrue(note.is_archived)

    def test_notes_hub_paginates_large_note_sets(self):
        with self.app.app_context():
            for index in range(13):
                db.session.add(
                    Note(
                        user_id=self.user_id,
                        title=f"Paged note {index}",
                        content="Pagination keeps the notes hub responsive.",
                        created_at=timestamp_now(),
                        updated_at=timestamp_now(),
                    )
                )
            db.session.commit()

        first_page = self.client.get("/notes_hub")
        self.assertEqual(first_page.status_code, 200)
        self.assertIn("Page 1 of 2", first_page.get_data(as_text=True))

        second_page = self.client.get("/notes_hub?page=2")
        self.assertEqual(second_page.status_code, 200)
        self.assertIn("Page 2 of 2", second_page.get_data(as_text=True))

    def test_tasks_paginate_with_filters(self):
        with self.app.app_context():
            for index in range(13):
                db.session.add(
                    Task(
                        user_id=self.user_id,
                        task=f"Paged task {index}",
                        subject="Engineering",
                        priority="high",
                        due_date=timestamp_now().date(),
                        completed=False,
                        archived=False,
                        created_at=timestamp_now(),
                    )
                )
            db.session.commit()

        response = self.client.get("/tasks?status=open&priority=high")
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn("Page 1 of 2", html)
        self.assertIn("priority=high", html)

        second_page = self.client.get("/tasks?status=open&priority=high&page=2")
        self.assertEqual(second_page.status_code, 200)
        self.assertIn("Page 2 of 2", second_page.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
