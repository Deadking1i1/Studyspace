from . import db


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(128), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    course = db.Column(db.String(128))
    bio = db.Column(db.Text)
    profile_pic = db.Column(db.String(255))
    streak_days = db.Column(db.Integer, default=0)
    total_hours = db.Column(db.Integer, default=0)
    created_at = db.Column(db.String(64))

    notes = db.relationship("Note", back_populates="user", lazy=True)
    flashcards = db.relationship("Flashcard", back_populates="user", lazy=True)
    groups = db.relationship("GroupMember", back_populates="user", lazy=True)
    posts = db.relationship("Post", back_populates="user", lazy=True)
    achievements = db.relationship("Achievement", back_populates="user", lazy=True)
    notifications = db.relationship("Notification", back_populates="user", lazy=True)
    events = db.relationship("Event", back_populates="user", lazy=True)


class Note(db.Model):
    __tablename__ = "notes"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64))
    is_public = db.Column(db.Boolean, default=False)
    likes = db.Column(db.Integer, default=0)

    user = db.relationship("User", back_populates="notes")


class Flashcard(db.Model):
    __tablename__ = "flashcards"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.String(64))
    is_public = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="flashcards")
    card = db.relationship("FlashcardCard", back_populates="flashcard", uselist=False, cascade="all, delete-orphan")

    @property
    def question(self):
        return self.card.front if self.card else None

    @property
    def answer(self):
        return self.card.back if self.card else None


class FlashcardCard(db.Model):
    __tablename__ = "flashcard_cards"
    id = db.Column(db.Integer, primary_key=True)
    flashcard_id = db.Column(db.Integer, db.ForeignKey("flashcards.id"), nullable=False)
    front = db.Column(db.Text, nullable=False)
    back = db.Column(db.Text, nullable=False)

    flashcard = db.relationship("Flashcard", back_populates="card")


class StudySession(db.Model):
    __tablename__ = "study_sessions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    duration_minutes = db.Column(db.Integer)
    started_at = db.Column(db.String(64))
    ended_at = db.Column(db.String(64))

    user = db.relationship("User")


class Group(db.Model):
    __tablename__ = "groups"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.String(64))
    member_count = db.Column(db.Integer, default=0)

    members = db.relationship("GroupMember", back_populates="group", lazy=True)


class GroupMember(db.Model):
    __tablename__ = "group_members"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    joined_at = db.Column(db.String(64))

    group = db.relationship("Group", back_populates="members")
    user = db.relationship("User", back_populates="groups")


class Post(db.Model):
    __tablename__ = "posts"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"))
    content = db.Column(db.Text)
    created_at = db.Column(db.String(64))

    user = db.relationship("User", back_populates="posts")


class Comment(db.Model):
    __tablename__ = "comments"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    content = db.Column(db.Text)
    created_at = db.Column(db.String(64))


class Like(db.Model):
    __tablename__ = "likes"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    note_id = db.Column(db.Integer, db.ForeignKey("notes.id"), nullable=False)
    created_at = db.Column(db.String(64))


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255))
    message = db.Column(db.Text)
    created_at = db.Column(db.String(64))
    is_read = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="notifications")


class Achievement(db.Model):
    __tablename__ = "achievements"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    unlocked_at = db.Column(db.String(64))

    user = db.relationship("User", back_populates="achievements")


class Event(db.Model):
    __tablename__ = "events"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(255))
    event_date = db.Column(db.String(64))
    notes = db.Column(db.Text)

    user = db.relationship("User", back_populates="events")


class Task(db.Model):
    __tablename__ = "tasks"
    id = db.Column(db.Integer, primary_key=True)
    task = db.Column(db.Text)
    due_date = db.Column(db.String(64))
    completed = db.Column(db.Boolean, default=False)
