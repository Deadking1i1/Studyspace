import os
import re
from datetime import datetime, date
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
from models.database import DB_PATH, init_db, get_db_connection

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "study-space-secret-key")
init_db()
app.logger.info(f"SQLite database initialized at {DB_PATH}")


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
        conn = get_db_connection()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        conn.close()
    return {"current_user": user}


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

        conn = get_db_connection()
        try:
            conn.execute(
                "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (username, email, password_hash, created_at)
            )
            conn.commit()
            user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            session["user_id"] = user["id"]
            flash("Registration successful. Welcome to Study Space!", "success")
            return redirect(url_for("dashboard"))
        except Exception:
            flash("A user with that email or username already exists.", "error")
            return redirect(url_for("register"))
        finally:
            conn.close()

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "").strip()

        if not email or not password:
            flash("Please enter both email and password.", "error")
            return redirect(url_for("login"))

        conn = get_db_connection()
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()

        if user and check_password_hash(user["password_hash"], password):
            session["user_id"] = user["id"]
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
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    notes_count = conn.execute("SELECT COUNT(*) AS count FROM notes WHERE user_id = ?", (user["id"],)).fetchone()["count"]
    sessions_hours = conn.execute("SELECT COALESCE(SUM(duration_minutes), 0) AS total FROM study_sessions WHERE user_id = ?", (user["id"],)).fetchone()["total"]
    sessions_hours = round(sessions_hours / 60, 1)
    recent_activity = conn.execute(
        "SELECT content, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 4",
        (user["id"],)
    ).fetchall()
    community_notes = conn.execute("SELECT title FROM notes WHERE is_public = 1 ORDER BY likes DESC LIMIT 3").fetchall()
    top_groups = conn.execute("SELECT name FROM groups ORDER BY member_count DESC LIMIT 3").fetchall()
    streak_days = user["streak_days"] or 0
    conn.close()

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
    conn = get_db_connection()
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        content = request.form.get("content", "").strip()
        visibility = request.form.get("visibility")
        is_public = 1 if visibility == "public" else 0
        if title and content:
            conn.execute(
                "INSERT INTO notes (user_id, title, content, created_at, is_public) VALUES (?, ?, ?, ?, ?)",
                (session["user_id"], title, content, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), is_public)
            )
            conn.commit()
            flash("Note created successfully.", "success")
        else:
            flash("Title and content are required.", "error")
        return redirect(url_for("notes_hub"))

    if query:
        notes = conn.execute(
            "SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY created_at DESC",
            (session["user_id"], f"%{query}%", f"%{query}%")
        ).fetchall()
    else:
        notes = conn.execute(
            "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC",
            (session["user_id"],)
        ).fetchall()

    community_notes = conn.execute(
        "SELECT * FROM notes WHERE is_public = 1 ORDER BY likes DESC LIMIT 6"
    ).fetchall()
    conn.close()

    return render_template("notes_hub.html", notes=notes, community_notes=community_notes, query=query)


@app.route("/flashcards", methods=["GET", "POST"])
@login_required
def flashcards():
    conn = get_db_connection()
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        question = request.form.get("question", "").strip()
        answer = request.form.get("answer", "").strip()
        visibility = request.form.get("visibility")
        is_public = 1 if visibility == "public" else 0

        if title and question and answer:
            cursor = conn.execute(
                "INSERT INTO flashcards (user_id, title, created_at, is_public) VALUES (?, ?, ?, ?)",
                (session["user_id"], title, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), is_public)
            )
            flashcard_id = cursor.lastrowid
            conn.execute(
                "INSERT INTO flashcard_cards (flashcard_id, front, back) VALUES (?, ?, ?)",
                (flashcard_id, question, answer)
            )
            conn.commit()
            flash("Flashcard created successfully.", "success")
        else:
            flash("Please provide title, question, and answer.", "error")
        conn.close()
        return redirect(url_for("flashcards"))

    flashcards = conn.execute(
        "SELECT f.*, fc.front AS question, fc.back AS answer FROM flashcards f "
        "LEFT JOIN flashcard_cards fc ON fc.flashcard_id = f.id "
        "WHERE f.user_id = ? ORDER BY f.created_at DESC",
        (session["user_id"],)
    ).fetchall()
    trending = conn.execute(
        "SELECT f.*, fc.front AS question, fc.back AS answer FROM flashcards f "
        "LEFT JOIN flashcard_cards fc ON fc.flashcard_id = f.id "
        "WHERE f.is_public = 1 ORDER BY f.id DESC LIMIT 6"
    ).fetchall()
    conn.close()
    return render_template("flashcards.html", flashcards=flashcards, trending=trending)


@app.route("/timer")
@login_required
def timer():
    conn = get_db_connection()
    sessions = conn.execute(
        "SELECT COUNT(*) AS total, COALESCE(SUM(duration_minutes), 0) AS minutes FROM study_sessions WHERE user_id = ?",
        (session["user_id"],)
    ).fetchone()
    conn.close()
    total_minutes = sessions["minutes"] if sessions else 0
    return render_template(
        "timer.html",
        total_minutes=total_minutes,
        sessions_completed=sessions["total"] if sessions else 0
    )


@app.route("/groups", methods=["GET", "POST"])
@login_required
def groups():
    conn = get_db_connection()
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        description = request.form.get("description", "").strip()
        if name and description:
            cursor = conn.execute(
                "INSERT INTO groups (name, description, created_by, created_at, member_count) VALUES (?, ?, ?, ?, ?)",
                (name, description, session["user_id"], datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 1)
            )
            group_id = cursor.lastrowid
            conn.execute(
                "INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)",
                (group_id, session["user_id"], datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
            flash("Study group created successfully.", "success")
        else:
            flash("Please provide a group name and description.", "error")
        conn.close()
        return redirect(url_for("groups"))

    my_groups = conn.execute(
        "SELECT g.* FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?",
        (session["user_id"],)
    ).fetchall()
    recommended = conn.execute("SELECT * FROM groups ORDER BY member_count DESC LIMIT 6").fetchall()
    conn.close()
    return render_template("groups.html", groups=my_groups, recommended=recommended)


@app.route("/feed")
@login_required
def feed():
    conn = get_db_connection()
    posts = conn.execute(
        "SELECT p.*, u.username FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT 12"
    ).fetchall()
    conn.close()
    return render_template("feed.html", posts=posts)


@app.route("/profile")
@login_required
def profile():
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    achievements = conn.execute("SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC", (session["user_id"],)).fetchall()
    conn.close()
    return render_template("profile.html", user=user, achievements=achievements)


@app.route("/notifications")
@login_required
def notifications():
    conn = get_db_connection()
    notes = conn.execute(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    return render_template("notifications.html", notifications=notes)


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
    conn = get_db_connection()
    achievements_list = conn.execute("SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC", (session["user_id"],)).fetchall()
    conn.close()
    return render_template("achievements.html", achievements=achievements_list)


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)
