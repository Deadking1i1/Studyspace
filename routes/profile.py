import os
from datetime import datetime

from flask import Blueprint, current_app, flash, redirect, render_template, request, session, url_for
from sqlalchemy import func
from werkzeug.utils import secure_filename

from auth_helpers import login_required
from extensions import db
from models import Achievement, StudySession, Task, User
from services import ensure_account_records, sanitize_plain, timestamp_now, validate_image_upload


profile_bp = Blueprint("profile", __name__)


@profile_bp.route("/profile")
@login_required
def profile():
    user = db.session.get(User, session["user_id"])
    profile_record, settings = ensure_account_records(user)
    db.session.commit()
    achievements = (
        Achievement.query.filter_by(user_id=user.id)
        .order_by(Achievement.unlocked_at.desc())
        .limit(6)
        .all()
    )
    total_minutes = (
        db.session.query(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .filter(StudySession.user_id == user.id)
        .scalar()
        or 0
    )
    completed_tasks = Task.query.filter_by(user_id=user.id, completed=True).count()
    return render_template(
        "profile.html",
        user=user,
        profile_record=profile_record,
        settings=settings,
        achievements=achievements,
        study_hours=round(total_minutes / 60, 1),
        completed_tasks=completed_tasks,
    )


@profile_bp.route("/profile/edit", methods=["GET", "POST"])
@login_required
def edit_profile():
    user = db.session.get(User, session["user_id"])
    profile_record, settings = ensure_account_records(user)
    if request.method == "POST":
        bio = sanitize_plain(request.form.get("bio"))
        course = sanitize_plain(request.form.get("course"))
        display_name = sanitize_plain(request.form.get("display_name"))
        institution = sanitize_plain(request.form.get("institution"))
        education_level = sanitize_plain(request.form.get("education_level"))
        field_of_study = sanitize_plain(request.form.get("field_of_study"))
        country = sanitize_plain(request.form.get("country"))
        profile_visibility = request.form.get("profile_visibility", "private")
        if profile_visibility not in {"private", "classmates", "public"}:
            profile_visibility = "private"
        file = request.files.get("profile_pic")

        if file and file.filename:
            is_valid, error = validate_image_upload(file)
            if not is_valid:
                flash(error, "error")
                return redirect(url_for("profile.edit_profile"))
            filename = secure_filename(f"{user.id}_{int(datetime.now().timestamp())}_{file.filename}")
            upload_path = current_app.config.get("UPLOAD_FOLDER")
            os.makedirs(upload_path, exist_ok=True)
            file.save(os.path.join(upload_path, filename))
            profile_record.profile_pic = os.path.join("static", "uploads", filename)

        profile_record.display_name = display_name or user.username
        profile_record.bio = bio
        profile_record.course = course
        profile_record.institution = institution
        profile_record.education_level = education_level
        profile_record.field_of_study = field_of_study
        profile_record.country = country
        profile_record.profile_visibility = profile_visibility
        profile_record.show_email = request.form.get("show_email") == "on"
        profile_record.show_academic_profile = request.form.get("show_academic_profile") == "on"
        profile_record.updated_at = timestamp_now()

        user.bio = profile_record.bio
        user.course = profile_record.course
        user.profile_pic = profile_record.profile_pic
        db.session.commit()
        flash("Profile updated.", "success")
        return redirect(url_for("profile.profile"))

    return render_template("profile_edit.html", user=user, profile_record=profile_record, settings=settings)
