from datetime import date, timedelta

from flask import Blueprint, render_template, session
from sqlalchemy import func

from auth_helpers import login_required
from extensions import db
from models import Event, Group, Note, StudySession, Task, User


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/dashboard")
@login_required
def dashboard():
    user = db.session.get(User, session["user_id"])
    notes_count = Note.query.filter_by(user_id=user.id).count()
    open_tasks_count = Task.query.filter_by(user_id=user.id, completed=False).count()
    sessions_minutes = (
        db.session.query(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .filter_by(user_id=user.id)
        .scalar()
        or 0
    )
    sessions_hours = round(sessions_minutes / 60, 1)
    today = date.today()
    week_from_today = today + timedelta(days=7)
    today_events = (
        Event.query.filter_by(user_id=user.id, event_date=today).order_by(Event.event_date.asc()).limit(5).all()
    )
    upcoming_tasks = (
        Task.query.filter(
            Task.user_id == user.id,
            Task.completed.is_(False),
            Task.archived.is_(False),
            Task.due_date >= today,
            Task.due_date <= week_from_today,
        )
        .order_by(Task.due_date.asc())
        .limit(5)
        .all()
    )
    recent_notes = (
        Note.query.filter_by(user_id=user.id, is_archived=False)
        .order_by(Note.updated_at.desc(), Note.created_at.desc())
        .limit(5)
        .all()
    )
    latest_session = (
        StudySession.query.filter_by(user_id=user.id).order_by(StudySession.ended_at.desc()).first()
    )
    community_notes = Note.query.filter_by(is_public=True).order_by(Note.likes.desc()).limit(3).all()
    top_groups = Group.query.order_by(Group.member_count.desc()).limit(3).all()

    return render_template(
        "dashboard.html",
        today=today.strftime("%A, %d %B %Y"),
        streak_days=user.streak_days or 0,
        hours_this_week=sessions_hours,
        notes_count=notes_count,
        open_tasks_count=open_tasks_count,
        today_events=today_events,
        upcoming_tasks=upcoming_tasks,
        recent_notes=recent_notes,
        latest_session=latest_session,
        community_notes=community_notes,
        top_groups=top_groups,
    )
