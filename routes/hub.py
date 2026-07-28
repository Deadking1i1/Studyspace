from flask import Blueprint, flash, redirect, render_template, request, url_for

from auth_helpers import login_required
from extensions import db
from models import Event, Note
from services import current_user_id, is_safe_pdf_url, parse_iso_date, sanitize_plain, sanitize_rich_text, timestamp_now


hub_bp = Blueprint("hub", __name__)


@hub_bp.route("/hub", methods=["GET", "POST"])
@login_required
def hub():
    user_id = current_user_id()
    pdf_url = None

    if request.method == "POST":
        form_type = request.form.get("form_type")

        if form_type == "add_note":
            title = sanitize_plain(request.form.get("title"))
            content = sanitize_plain(request.form.get("content"))
            if title and content:
                db.session.add(
                    Note(
                        user_id=user_id,
                        title=title,
                        content=content,
                        created_at=timestamp_now(),
                        is_public=False,
                    )
                )
                db.session.commit()
                flash("Quick note saved.", "success")
            else:
                flash("Title and note content are required.", "error")
            return redirect(url_for("hub.hub"))

        if form_type == "add_event":
            name = sanitize_plain(request.form.get("event_name"))
            event_date = parse_iso_date(request.form.get("event_date"))
            notes = sanitize_plain(request.form.get("event_notes"))
            if name and event_date:
                db.session.add(Event(user_id=user_id, name=name, event_date=event_date, notes=notes))
                db.session.commit()
                flash("Event added to your study hub.", "success")
            else:
                flash("Event name and date are required.", "error")
            return redirect(url_for("hub.hub"))

        if form_type == "save_editor":
            title = sanitize_plain(request.form.get("editor_title")) or "Untitled study document"
            content = sanitize_rich_text(request.form.get("editor_content"))
            if content:
                db.session.add(
                    Note(
                        user_id=user_id,
                        title=title,
                        content=content,
                        created_at=timestamp_now(),
                        is_public=False,
                    )
                )
                db.session.commit()
                flash("Study document saved to notes.", "success")
            else:
                flash("Write something before saving a document.", "error")
            return redirect(url_for("hub.hub"))

        if form_type == "load_pdf":
            submitted_url = (request.form.get("pdf_url") or "").strip()
            if is_safe_pdf_url(submitted_url):
                pdf_url = submitted_url
            else:
                flash("Please paste an HTTPS PDF URL from an allowed domain.", "error")

    notes = Note.query.filter_by(user_id=user_id).order_by(Note.created_at.desc()).limit(4).all()
    events = Event.query.filter_by(user_id=user_id).order_by(Event.event_date.asc()).limit(5).all()
    return render_template(
        "hub.html",
        notes=notes,
        events=events,
        pdf_url=pdf_url,
    )
