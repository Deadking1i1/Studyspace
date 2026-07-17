from functools import wraps

from flask import redirect, session, url_for


def login_required(view):
    @wraps(view)
    def wrapped_view(**kwargs):
        if session.get("user_id") is None:
            return redirect(url_for("auth.login"))
        return view(**kwargs)

    return wrapped_view
