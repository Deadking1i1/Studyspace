import os
import re
from datetime import datetime, date
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from werkzeug.security import generate_password_hash, check_password_hash
from bleach import clean as bleach_clean
from sqlalchemy import or_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from werkzeug.utils import secure_filename
from models import db, migrate, User, Note, Flashcard, FlashcardCard, StudySession, Group, GroupMember, Post, Achievement, Notification, Event, Task
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
migrate.init_app(app, db)
CSRFProtect(app)
Talisman(
    app,
    content_security_policy={
        'default-src': "'self'",
        'script-src': "'self' 'unsafe-inline'",
        'style-src': "'self' 'unsafe-inline'",
        'img-src': "'self' data:",
        'connect-src': "'self'",
    },
    force_https=False,
    strict_transport_security=False,
)
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])
limiter.init_app(app)

with app.app_context():
    db.create_all()
    app.logger.info(f"Database initialized at {app.config['SQLALCHEMY_DATABASE_URI']}")


def login_required(view):
    @wraps(view)
    def wrapped_view(**kwargs):
        if session.get("user_id") is None:
            return redirect(url_for("login"))
        return view(**kwargs)
    return wrapped_view


@app.context_processor
def inject_user():
    user = None
    if session.get("user_id"):
        user = User.query.get(session["user_id"])
    return {"current_user": user}


def allowed_file(filename):
    if not filename:
        return False
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config.get('ALLOWED_IMAGE_EXTENSIONS', set())


def summarize_text(text):
    if not text:
        return "No content available to summarise."
    cleaned = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r'(?<=[.!?])\s+', cleaned)
    meaningful = [s.strip() for s in sentences if len(s.strip()) > 20]
    if not meaningful:
        return cleaned[:140] + ("..." if len(cleaned) > 140 else "")
    summary = " ".join(meaningful[:2])
    if len(summary) > 220:
        summary = summary[:220].rstrip() + "..."
    return summary


@app.route("/")
def root():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
@limiter.limit("3 per minute")
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "").strip()

        if not username or not email or not password:
            flash("Please fill in all registration fields.", "error")
            return redirect(url_for("register"))

        password_hash = generate_password_hash(password)
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        user = User(username=username, email=email, password_hash=password_hash, created_at=created_at)
        db.session.add(user)
        try:
            db.session.commit()
            session["user_id"] = user.id
            flash("Registration successful. Welcome to Study Space!", "success")
            return redirect(url_for("dashboard"))
        except IntegrityError:
            db.session.rollback()
            flash("A user with that email or username already exists.", "error")
            return redirect(url_for("register"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute")
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "").strip()

        if not email or not password:
            flash("Please enter both email and password.", "error")
            return redirect(url_for("login"))

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password_hash, password):
            session["user_id"] = user.id
            flash("Logged in successfully.", "success")
            return redirect(url_for("dashboard"))

        flash("Invalid email or password.", "error")
        return redirect(url_for("login"))

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    user = User.query.get(session["user_id"])
    notes_count = Note.query.filter_by(user_id=user.id).count()
    sessions_minutes = db.session.query(func.coalesce(func.sum(StudySession.duration_minutes), 0)).filter_by(user_id=user.id).scalar() or 0
    sessions_hours = round(sessions_minutes / 60, 1)
    recent_activity = Post.query.filter_by(user_id=user.id).order_by(Post.created_at.desc()).limit(4).all()
    community_notes = Note.query.filter_by(is_public=True).order_by(Note.likes.desc()).limit(3).all()
    top_groups = Group.query.order_by(Group.member_count.desc()).limit(3).all()
    streak_days = user.streak_days or 0

    return render_template(
        "dashboard.html",
        today=date.today().strftime("%A, %d %B %Y"),
        streak_days=streak_days,
        hours_this_week=sessions_hours,
        notes_count=notes_count,
        recent_activity=recent_activity,
        community_notes=community_notes,
        top_groups=top_groups
    )


@app.route("/notes_hub", methods=["GET", "POST"])
@login_required
def notes_hub():
    query = request.args.get("q", "").strip()
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        content = request.form.get("content", "").strip()
        visibility = request.form.get("visibility")
        is_public = visibility == "public"
        if title and content:
            safe_title = bleach_clean(title, strip=True)
            safe_content = bleach_clean(content, strip=True)
            note = Note(
                user_id=session["user_id"],
                title=safe_title,
                content=safe_content,
                created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                is_public=is_public,
            )
            db.session.add(note)
            db.session.commit()
            flash("Note created successfully.", "success")
        else:
            flash("Title and content are required.", "error")
        return redirect(url_for("notes_hub"))

    note_query = Note.query.filter_by(user_id=session["user_id"])
    if query:
        search = f"%{query}%"
        note_query = note_query.filter(or_(Note.title.ilike(search), Note.content.ilike(search)))
    notes = note_query.order_by(Note.created_at.desc()).all()

    community_notes = Note.query.filter_by(is_public=True).order_by(Note.likes.desc()).limit(6).all()

    return render_template("notes_hub.html", notes=notes, community_notes=community_notes, query=query)


@app.route("/flashcards", methods=["GET", "POST"])
@login_required
def flashcards():
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        question = request.form.get("question", "").strip()
        answer = request.form.get("answer", "").strip()
        visibility = request.form.get("visibility")
        is_public = visibility == "public"

        if title and question and answer:
            safe_title = bleach_clean(title, strip=True)
            safe_question = bleach_clean(question, strip=True)
            safe_answer = bleach_clean(answer, strip=True)
            flashcard = Flashcard(
                user_id=session["user_id"],
                title=safe_title,
                created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                is_public=is_public,
            )
            db.session.add(flashcard)
            db.session.flush()
            card = FlashcardCard(
                flashcard_id=flashcard.id,
                front=safe_question,
                back=safe_answer,
            )
            db.session.add(card)
            db.session.commit()
            flash("Flashcard created successfully.", "success")
        else:
            flash("Please provide title, question, and answer.", "error")
        return redirect(url_for("flashcards"))

    flashcards = Flashcard.query.options(joinedload(Flashcard.card)).filter_by(user_id=session["user_id"]).order_by(Flashcard.created_at.desc()).all()
    trending = Flashcard.query.options(joinedload(Flashcard.card)).filter_by(is_public=True).order_by(Flashcard.id.desc()).limit(6).all()
    return render_template("flashcards.html", flashcards=flashcards, trending=trending)


@app.route("/timer")
@login_required
def timer():
    sessions_completed = StudySession.query.filter_by(user_id=session["user_id"]).count()
    total_minutes = db.session.query(
        func.coalesce(func.sum(StudySession.duration_minutes), 0)
    ).filter(StudySession.user_id == session["user_id"]).scalar() or 0
    return render_template(
        "timer.html",
        total_minutes=total_minutes,
        sessions_completed=sessions_completed
    )


@app.route("/groups", methods=["GET", "POST"])
@login_required
def groups():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        description = request.form.get("description", "").strip()
        if name and description:
            safe_name = bleach_clean(name, strip=True)
            safe_description = bleach_clean(description, strip=True)
            group = Group(
                name=safe_name,
                description=safe_description,
                created_by=session["user_id"],
                created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                member_count=1,
            )
            db.session.add(group)
            db.session.flush()
            membership = GroupMember(
                group_id=group.id,
                user_id=session["user_id"],
                joined_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            )
            db.session.add(membership)
            db.session.commit()
            flash("Study group created successfully.", "success")
        else:
            flash("Please provide a group name and description.", "error")
        return redirect(url_for("groups"))

    my_groups = Group.query.join(GroupMember).filter(GroupMember.user_id == session["user_id"]).all()
    recommended = Group.query.order_by(Group.member_count.desc()).limit(6).all()
    return render_template("groups.html", groups=my_groups, recommended=recommended)


@app.route("/feed")
@login_required
def feed():
    posts = Post.query.options(joinedload(Post.user)).order_by(Post.created_at.desc()).limit(12).all()
    return render_template("feed.html", posts=posts)


@app.route("/profile")
@login_required
def profile():
    user = User.query.get(session["user_id"])
    achievements = Achievement.query.filter_by(user_id=user.id).order_by(Achievement.unlocked_at.desc()).all()
    return render_template("profile.html", user=user, achievements=achievements)


@app.route("/profile/edit", methods=["GET", "POST"])
@login_required
def edit_profile():
    user = User.query.get(session["user_id"])
    if request.method == "POST":
        bio = request.form.get("bio", "").strip()
        course = request.form.get("course", "").strip()
        file = request.files.get("profile_pic")

        if file and file.filename:
            if not allowed_file(file.filename):
                flash("Invalid image type. Allowed: png, jpg, jpeg, gif", "error")
                return redirect(url_for("edit_profile"))
            filename = secure_filename(f"{user.id}_{int(datetime.now().timestamp())}_{file.filename}")
            upload_path = os.path.join(app.config.get("UPLOAD_FOLDER"))
            os.makedirs(upload_path, exist_ok=True)
            file.save(os.path.join(upload_path, filename))
            user.profile_pic = os.path.join("static", "uploads", filename)

        user.bio = bleach_clean(bio, strip=True)
        user.course = bleach_clean(course, strip=True)
        db.session.commit()
        flash("Profile updated.", "success")
        return redirect(url_for("profile"))

    return render_template("profile_edit.html", user=user)


@app.route("/notifications")
@login_required
def notifications():
    notifications = Notification.query.filter_by(user_id=session["user_id"]).order_by(Notification.created_at.desc()).limit(50).all()
    return render_template("notifications.html", notifications=notifications)


@app.route("/notifications/mark_read/<int:notification_id>", methods=["POST"])
@login_required
def mark_notification_read(notification_id):
    notif = Notification.query.get(notification_id)
    if not notif or notif.user_id != session.get("user_id"):
        flash("Notification not found.", "error")
        return redirect(url_for("notifications"))
    notif.is_read = True
    db.session.commit()
    return redirect(url_for("notifications"))


@app.route("/notifications/mark_all_read", methods=["POST"])
@login_required
def mark_all_notifications_read():
    Notification.query.filter_by(user_id=session.get("user_id"), is_read=False).update({"is_read": True})
    db.session.commit()
    flash("All notifications marked as read.", "success")
    return redirect(url_for("notifications"))


@app.route("/assistant", methods=["GET", "POST"])
@login_required
def assistant():
    assistant_response = None
    query = None
    if request.method == "POST":
        query = request.form.get("query", "").strip()
        if query:
            assistant_response = summarize_text(query)
        else:
            flash("Please ask a question or describe what you need help with.", "error")
    return render_template("assistant.html", query=query, assistant_response=assistant_response)


@app.route("/achievements")
@login_required
def achievements():
    achievements_list = Achievement.query.filter_by(user_id=session["user_id"]).order_by(Achievement.unlocked_at.desc()).all()
    return render_template("achievements.html", achievements=achievements_list)


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)
