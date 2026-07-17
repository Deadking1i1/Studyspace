from flask import Blueprint, flash, render_template, request

from auth_helpers import login_required
from services import summarize_text


assistant_bp = Blueprint("assistant", __name__)


@assistant_bp.route("/assistant", methods=["GET", "POST"])
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
