from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from auth_helpers import login_required
from extensions import db
from models import Notification
from services import paginate_query


notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/notifications")
@login_required
def notifications():
    page = request.args.get("page", 1, type=int)
    paginated_notifications = paginate_query(
        Notification.query.filter_by(user_id=session["user_id"]).order_by(Notification.created_at.desc()),
        page,
        25,
    )
    return render_template(
        "notifications.html",
        notifications=paginated_notifications["items"],
        pagination=paginated_notifications,
    )


@notifications_bp.route("/notifications/mark_read/<int:notification_id>", methods=["POST"])
@login_required
def mark_notification_read(notification_id):
    notif = db.session.get(Notification, notification_id)
    if not notif or notif.user_id != session.get("user_id"):
        flash("Notification not found.", "error")
        return redirect(url_for("notifications.notifications"))
    notif.is_read = True
    db.session.commit()
    return redirect(url_for("notifications.notifications"))


@notifications_bp.route("/notifications/mark_all_read", methods=["POST"])
@login_required
def mark_all_notifications_read():
    Notification.query.filter_by(user_id=session.get("user_id"), is_read=False).update({"is_read": True})
    db.session.commit()
    flash("All notifications marked as read.", "success")
    return redirect(url_for("notifications.notifications"))
