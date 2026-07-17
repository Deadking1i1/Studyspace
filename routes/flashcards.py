from flask import Blueprint, flash, redirect, render_template, request, session, url_for
from sqlalchemy.orm import joinedload

from auth_helpers import login_required
from extensions import db
from models import Flashcard, FlashcardCard
from services import paginate_query, sanitize_plain, timestamp_now


flashcards_bp = Blueprint("flashcards", __name__)


@flashcards_bp.route("/flashcards", methods=["GET", "POST"])
@login_required
def flashcards():
    if request.method == "POST":
        title = sanitize_plain(request.form.get("title"))
        question = sanitize_plain(request.form.get("question"))
        answer = sanitize_plain(request.form.get("answer"))
        is_public = request.form.get("visibility") == "public"

        if title and question and answer:
            flashcard = Flashcard(
                user_id=session["user_id"],
                title=title,
                created_at=timestamp_now(),
                is_public=is_public,
            )
            db.session.add(flashcard)
            db.session.flush()
            db.session.add(FlashcardCard(flashcard_id=flashcard.id, front=question, back=answer))
            db.session.commit()
            flash("Flashcard created successfully.", "success")
        else:
            flash("Please provide title, question, and answer.", "error")
        return redirect(url_for("flashcards.flashcards"))

    page = request.args.get("page", 1, type=int)
    paginated_flashcards = paginate_query(
        Flashcard.query.options(joinedload(Flashcard.card))
        .filter_by(user_id=session["user_id"])
        .order_by(Flashcard.created_at.desc()),
        page,
        12,
    )
    trending = (
        Flashcard.query.options(joinedload(Flashcard.card))
        .filter_by(is_public=True)
        .order_by(Flashcard.id.desc())
        .limit(6)
        .all()
    )
    return render_template(
        "flashcards.html",
        flashcards=paginated_flashcards["items"],
        pagination=paginated_flashcards,
        trending=trending,
    )
