from datetime import datetime, timedelta

from flask import Blueprint, jsonify, render_template, request, session
from sqlalchemy import func

from auth_helpers import login_required
from extensions import db
from models import StudySession
from services import current_user_id


study_sessions_bp = Blueprint("study_sessions", __name__)


@study_sessions_bp.route("/timer")
@login_required
def timer():
    sessions_completed = StudySession.query.filter_by(user_id=session["user_id"]).count()
    total_minutes = (
        db.session.query(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .filter(StudySession.user_id == session["user_id"])
        .scalar()
        or 0
    )
    return render_template(
        "timer.html",
        total_minutes=total_minutes,
        sessions_completed=sessions_completed,
    )


@study_sessions_bp.route("/study-sessions", methods=["POST"])
@login_required
def save_study_session():
    data = request.get_json(silent=True) or {}
    duration_minutes = int(data.get("duration_minutes") or 0)
    if duration_minutes < 1 or duration_minutes > 720:
        return jsonify({"error": "Session duration must be between 1 and 720 minutes."}), 400

    ended_at = datetime.now()
    started_at = ended_at - timedelta(minutes=duration_minutes)
    db.session.add(
        StudySession(
            user_id=current_user_id(),
            duration_minutes=duration_minutes,
            started_at=started_at,
            ended_at=ended_at,
        )
    )
    db.session.commit()
    return jsonify({"status": "saved", "duration_minutes": duration_minutes})
