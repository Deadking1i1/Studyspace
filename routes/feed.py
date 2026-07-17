from flask import Blueprint, render_template
from sqlalchemy.orm import joinedload

from auth_helpers import login_required
from models import Post


feed_bp = Blueprint("feed", __name__)


@feed_bp.route("/feed")
@login_required
def feed():
    posts = Post.query.options(joinedload(Post.user)).order_by(Post.created_at.desc()).limit(12).all()
    return render_template("feed.html", posts=posts)
