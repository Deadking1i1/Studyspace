from flask import Blueprint, flash, redirect, render_template, request, session, url_for
from sqlalchemy import or_

from auth_helpers import login_required
from extensions import db
from models import Note
from services import current_user_id, paginate_query, sanitize_plain, summarize_text, timestamp_now


notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/notes_hub", methods=["GET", "POST"])
@login_required
def notes_hub():
    query = request.args.get("q", "").strip()
    show_archived = request.args.get("archived") == "1"
    page = request.args.get("page", 1, type=int)
    if request.method == "POST":
        title = sanitize_plain(request.form.get("title"))
        content = sanitize_plain(request.form.get("content"))
        subject = sanitize_plain(request.form.get("subject"))
        tags = sanitize_plain(request.form.get("tags"))
        is_public = request.form.get("visibility") == "public"
        if title and content:
            now = timestamp_now()
            db.session.add(
                Note(
                    user_id=session["user_id"],
                    title=title,
                    content=content,
                    subject=subject,
                    tags=tags,
                    created_at=now,
                    updated_at=now,
                    is_public=is_public,
                )
            )
            db.session.commit()
            flash("Note created successfully.", "success")
        else:
            flash("Title and content are required.", "error")
        return redirect(url_for("notes.notes_hub"))

    note_query = Note.query.filter_by(user_id=session["user_id"], is_archived=show_archived)
    if query:
        search = f"%{query}%"
        note_query = note_query.filter(
            or_(
                Note.title.ilike(search),
                Note.content.ilike(search),
                Note.subject.ilike(search),
                Note.tags.ilike(search),
            )
        )
    paginated_notes = paginate_query(
        note_query.order_by(Note.is_pinned.desc(), Note.updated_at.desc(), Note.created_at.desc()),
        page,
        12,
    )
    community_notes = Note.query.filter_by(is_public=True).order_by(Note.likes.desc()).limit(6).all()

    return render_template(
        "notes_hub.html",
        notes=paginated_notes["items"],
        pagination=paginated_notes,
        community_notes=community_notes,
        query=query,
        show_archived=show_archived,
    )


@notes_bp.route("/notes", methods=["GET", "POST"])
@login_required
def notes():
    if request.method == "POST":
        title = sanitize_plain(request.form.get("title"))
        content = sanitize_plain(request.form.get("content"))
        if title and content:
            db.session.add(
                Note(
                    user_id=current_user_id(),
                    title=title,
                    content=content,
                    created_at=timestamp_now(),
                    updated_at=timestamp_now(),
                    is_public=False,
                )
            )
            db.session.commit()
            flash("Note saved.", "success")
        else:
            flash("Title and content are required.", "error")
        return redirect(url_for("notes.notes"))

    page = request.args.get("page", 1, type=int)
    paginated_notes = paginate_query(
        Note.query.filter_by(user_id=current_user_id()).order_by(Note.created_at.desc()),
        page,
        12,
    )
    return render_template("notes.html", notes=paginated_notes["items"], pagination=paginated_notes, summary=None)


@notes_bp.route("/notes/<int:note_id>/edit", methods=["POST"])
@login_required
def edit_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=current_user_id()).first()
    if not note:
        flash("Note not found.", "error")
        return redirect(url_for("notes.notes_hub"))

    title = sanitize_plain(request.form.get("title"))
    content = sanitize_plain(request.form.get("content"))
    if not title or not content:
        flash("Title and content are required.", "error")
        return redirect(url_for("notes.notes_hub"))

    note.title = title
    note.content = content
    note.subject = sanitize_plain(request.form.get("subject"))
    note.tags = sanitize_plain(request.form.get("tags"))
    note.is_public = request.form.get("visibility") == "public"
    note.updated_at = timestamp_now()
    db.session.commit()
    flash("Note updated.", "success")
    return redirect(url_for("notes.notes_hub"))


@notes_bp.route("/notes/<int:note_id>/<action>", methods=["POST"])
@login_required
def update_note_state(note_id, action):
    note = Note.query.filter_by(id=note_id, user_id=current_user_id()).first()
    if not note:
        flash("Note not found.", "error")
        return redirect(url_for("notes.notes_hub"))

    if action == "favorite":
        note.is_favorite = not bool(note.is_favorite)
    elif action == "pin":
        note.is_pinned = not bool(note.is_pinned)
    elif action == "archive":
        note.is_archived = True
    elif action == "restore":
        note.is_archived = False
    elif action == "delete":
        db.session.delete(note)
        db.session.commit()
        flash("Note deleted.", "success")
        return redirect(url_for("notes.notes_hub"))
    else:
        flash("Unknown note action.", "error")
        return redirect(url_for("notes.notes_hub"))

    note.updated_at = timestamp_now()
    db.session.commit()
    flash("Note updated.", "success")
    return redirect(url_for("notes.notes_hub"))


@notes_bp.route("/notes/<int:note_id>/summary")
@login_required
def summarize_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=current_user_id()).first()
    if not note:
        flash("Note not found.", "error")
        return redirect(url_for("notes.notes"))

    paginated_notes = paginate_query(
        Note.query.filter_by(user_id=current_user_id()).order_by(Note.created_at.desc()),
        1,
        12,
    )
    return render_template(
        "notes.html",
        notes=paginated_notes["items"],
        pagination=paginated_notes,
        summary=summarize_text(note.content),
    )
