from . import db


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(128), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email_verified = db.Column(db.Boolean, default=False)
    email_verification_token_hash = db.Column(db.String(64))
    email_verification_sent_at = db.Column(db.DateTime)
    pending_email = db.Column(db.String(255))
    pending_email_token_hash = db.Column(db.String(64))
    pending_email_sent_at = db.Column(db.DateTime)
    password_reset_token_hash = db.Column(db.String(64))
    password_reset_sent_at = db.Column(db.DateTime)
    course = db.Column(db.String(128))
    bio = db.Column(db.Text)
    profile_pic = db.Column(db.String(255))
    streak_days = db.Column(db.Integer, default=0)
    total_hours = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime)

    notes = db.relationship("Note", back_populates="user", lazy=True)
    flashcards = db.relationship("Flashcard", back_populates="user", lazy=True)
    groups = db.relationship("GroupMember", back_populates="user", lazy=True)
    created_groups = db.relationship("Group", back_populates="creator", lazy=True)
    posts = db.relationship("Post", back_populates="user", lazy=True)
    comments = db.relationship("Comment", back_populates="user", lazy=True)
    note_likes = db.relationship("Like", back_populates="user", lazy=True)
    achievements = db.relationship("Achievement", back_populates="user", lazy=True)
    notifications = db.relationship("Notification", back_populates="user", lazy=True)
    events = db.relationship("Event", back_populates="user", lazy=True)
    tasks = db.relationship("Task", back_populates="user", lazy=True)
    study_sessions = db.relationship("StudySession", back_populates="user", lazy=True)
    profile = db.relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    settings = db.relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserProfile(db.Model):
    __tablename__ = "user_profiles"
    __table_args__ = (
        db.Index("ix_user_profiles_user", "user_id"),
        db.Index("ix_user_profiles_visibility", "profile_visibility"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    display_name = db.Column(db.String(128))
    bio = db.Column(db.Text)
    profile_pic = db.Column(db.String(255))
    course = db.Column(db.String(128))
    institution = db.Column(db.String(255))
    education_level = db.Column(db.String(128))
    field_of_study = db.Column(db.String(128))
    country = db.Column(db.String(128))
    profile_visibility = db.Column(db.String(32), default="private")
    show_email = db.Column(db.Boolean, default=False)
    show_academic_profile = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="profile")


class UserSettings(db.Model):
    __tablename__ = "user_settings"
    __table_args__ = (
        db.Index("ix_user_settings_user", "user_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    theme = db.Column(db.String(32), default="dark")
    language = db.Column(db.String(16), default="en")
    timezone = db.Column(db.String(64), default="UTC")
    reduced_motion = db.Column(db.Boolean, default=False)
    high_contrast = db.Column(db.Boolean, default=False)
    email_notifications = db.Column(db.Boolean, default=True)
    study_reminders = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="settings")


class SecurityEvent(db.Model):
    __tablename__ = "security_events"
    __table_args__ = (
        db.Index("ix_security_events_user_created", "user_id", "created_at"),
        db.Index("ix_security_events_type_created", "event_type", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    event_type = db.Column(db.String(64), nullable=False)
    ip_address = db.Column(db.String(64))
    user_agent = db.Column(db.String(255))
    metadata_json = db.Column(db.Text)
    created_at = db.Column(db.DateTime)


class Note(db.Model):
    __tablename__ = "notes"
    __table_args__ = (
        db.Index("ix_notes_user_created", "user_id", "created_at"),
        db.Index("ix_notes_user_archived_pinned", "user_id", "is_archived", "is_pinned"),
        db.Index("ix_notes_public_likes", "is_public", "likes"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    subject = db.Column(db.String(128))
    tags = db.Column(db.String(255))
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)
    is_public = db.Column(db.Boolean, default=False)
    is_favorite = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)
    likes = db.Column(db.Integer, default=0)

    user = db.relationship("User", back_populates="notes")
    liked_by = db.relationship("Like", back_populates="note", lazy=True)


class Flashcard(db.Model):
    __tablename__ = "flashcards"
    __table_args__ = (
        db.Index("ix_flashcards_user_created", "user_id", "created_at"),
        db.Index("ix_flashcards_public_id", "is_public", "id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime)
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
    __table_args__ = (
        db.Index("ix_study_sessions_user_started", "user_id", "started_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=False)
    started_at = db.Column(db.DateTime)
    ended_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="study_sessions")


class Group(db.Model):
    __tablename__ = "groups"
    __table_args__ = (
        db.Index("ix_groups_member_count", "member_count"),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime)
    member_count = db.Column(db.Integer, default=0)

    creator = db.relationship("User", back_populates="created_groups")
    members = db.relationship("GroupMember", back_populates="group", lazy=True)
    posts = db.relationship("Post", back_populates="group", lazy=True)


class GroupMember(db.Model):
    __tablename__ = "group_members"
    __table_args__ = (
        db.UniqueConstraint("group_id", "user_id", name="uq_group_members_group_user"),
        db.Index("ix_group_members_user", "user_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    joined_at = db.Column(db.DateTime)

    group = db.relationship("Group", back_populates="members")
    user = db.relationship("User", back_populates="groups")


class Post(db.Model):
    __tablename__ = "posts"
    __table_args__ = (
        db.Index("ix_posts_created", "created_at"),
        db.Index("ix_posts_user_created", "user_id", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"))
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="posts")
    group = db.relationship("Group", back_populates="posts")
    comments = db.relationship("Comment", back_populates="post", lazy=True)


class Comment(db.Model):
    __tablename__ = "comments"
    __table_args__ = (
        db.Index("ix_comments_post_created", "post_id", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False)
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="comments")
    post = db.relationship("Post", back_populates="comments")


class Like(db.Model):
    __tablename__ = "likes"
    __table_args__ = (
        db.UniqueConstraint("user_id", "note_id", name="uq_likes_user_note"),
        db.Index("ix_likes_note", "note_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    note_id = db.Column(db.Integer, db.ForeignKey("notes.id"), nullable=False)
    created_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="note_likes")
    note = db.relationship("Note", back_populates="liked_by")


class Notification(db.Model):
    __tablename__ = "notifications"
    __table_args__ = (
        db.Index("ix_notifications_user_read_created", "user_id", "is_read", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255))
    message = db.Column(db.Text)
    created_at = db.Column(db.DateTime)
    is_read = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="notifications")


class Achievement(db.Model):
    __tablename__ = "achievements"
    __table_args__ = (
        db.Index("ix_achievements_user_unlocked", "user_id", "unlocked_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    unlocked_at = db.Column(db.DateTime)

    user = db.relationship("User", back_populates="achievements")


class Event(db.Model):
    __tablename__ = "events"
    __table_args__ = (
        db.Index("ix_events_user_date", "user_id", "event_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(255))
    event_date = db.Column(db.Date)
    notes = db.Column(db.Text)

    user = db.relationship("User", back_populates="events")


class Task(db.Model):
    __tablename__ = "tasks"
    __table_args__ = (
        db.Index("ix_tasks_user_completed_due", "user_id", "completed", "due_date"),
        db.Index("ix_tasks_user_archived_priority", "user_id", "archived", "priority"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    task = db.Column(db.Text)
    subject = db.Column(db.String(128))
    priority = db.Column(db.String(32), default="medium")
    due_date = db.Column(db.Date)
    reminder_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime)
    completed = db.Column(db.Boolean, default=False)
    archived = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="tasks")
