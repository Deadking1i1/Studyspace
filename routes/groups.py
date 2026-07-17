from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from auth_helpers import login_required
from extensions import db
from models import Group, GroupMember
from services import paginate_query, sanitize_plain, timestamp_now


groups_bp = Blueprint("groups", __name__)


@groups_bp.route("/groups", methods=["GET", "POST"])
@login_required
def groups():
    if request.method == "POST":
        name = sanitize_plain(request.form.get("name"))
        description = sanitize_plain(request.form.get("description"))
        if name and description:
            group = Group(
                name=name,
                description=description,
                created_by=session["user_id"],
                created_at=timestamp_now(),
                member_count=1,
            )
            db.session.add(group)
            db.session.flush()
            db.session.add(
                GroupMember(group_id=group.id, user_id=session["user_id"], joined_at=timestamp_now())
            )
            db.session.commit()
            flash("Study group created successfully.", "success")
        else:
            flash("Please provide a group name and description.", "error")
        return redirect(url_for("groups.groups"))

    page = request.args.get("page", 1, type=int)
    paginated_groups = paginate_query(
        Group.query.join(GroupMember)
        .filter(GroupMember.user_id == session["user_id"])
        .order_by(Group.created_at.desc()),
        page,
        12,
    )
    recommended = Group.query.order_by(Group.member_count.desc()).limit(6).all()
    return render_template(
        "groups.html",
        groups=paginated_groups["items"],
        pagination=paginated_groups,
        recommended=recommended,
    )
