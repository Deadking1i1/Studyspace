from flask import Blueprint, render_template, request, session

from auth_helpers import login_required
from models import Achievement
from services import paginate_query


achievements_bp = Blueprint("achievements", __name__)


@achievements_bp.route("/achievements")
@login_required
def achievements():
    page = request.args.get("page", 1, type=int)
    paginated_achievements = paginate_query(
        Achievement.query.filter_by(user_id=session["user_id"])
        .order_by(Achievement.unlocked_at.desc()),
        page,
        12,
    )
    return render_template(
        "achievements.html",
        achievements=paginated_achievements["items"],
        pagination=paginated_achievements,
    )
