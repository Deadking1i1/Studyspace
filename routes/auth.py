from flask import Blueprint, current_app, flash, redirect, render_template, request, session, url_for
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db, limiter
from models import User
from services import (
    create_email_verification_token,
    create_password_reset_token,
    email_verification_expired,
    ensure_account_records,
    build_absolute_url,
    hash_token,
    log_security_event,
    mail_configured,
    normalize_email,
    password_strength_errors,
    password_reset_expired,
    send_email,
    timestamp_now,
)


auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["GET", "POST"])
@limiter.limit("3 per minute")
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = normalize_email(request.form.get("email"))
        password = request.form.get("password", "").strip()

        if not username or not email or not password:
            flash("Please fill in all registration fields.", "error")
            return redirect(url_for("auth.register"))

        password_errors = password_strength_errors(password)
        if password_errors:
            for error in password_errors:
                flash(error, "error")
            return redirect(url_for("auth.register"))

        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            created_at=timestamp_now(),
        )
        db.session.add(user)
        ensure_account_records(user)
        verification_token = create_email_verification_token(user)
        try:
            db.session.commit()
            log_security_event(user.id, "account.registered")
            db.session.commit()
            session.clear()
            session["user_id"] = user.id
            flash("Registration successful. Welcome to Study Space!", "success")
            verification_path = url_for("auth.verify_email", token=verification_token, _external=False)
            if mail_configured():
                send_email(
                    user.email,
                    "Verify your Study Space email",
                    f"Verify your Study Space email here: {build_absolute_url(verification_path)}",
                )
                log_security_event(user.id, "email.verification_sent")
                db.session.commit()
            elif not current_app.config.get("IS_PRODUCTION"):
                flash(verification_path, "success")
            return redirect(url_for("dashboard.dashboard"))
        except IntegrityError:
            db.session.rollback()
            flash("A user with that email or username already exists.", "error")
            return redirect(url_for("auth.register"))

    return render_template("register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute")
def login():
    if request.method == "POST":
        email = normalize_email(request.form.get("email"))
        password = request.form.get("password", "").strip()

        if not email or not password:
            flash("Please enter both email and password.", "error")
            return redirect(url_for("auth.login"))

        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            log_security_event(user.id, "auth.login_success")
            db.session.commit()
            session.clear()
            session["user_id"] = user.id
            flash("Logged in successfully.", "success")
            return redirect(url_for("dashboard.dashboard"))

        log_security_event(user.id if user else None, "auth.login_failed", {"email_provided": bool(email)})
        db.session.commit()
        flash("Invalid email or password.", "error")
        return redirect(url_for("auth.login"))

    return render_template("login.html")


@auth_bp.route("/forgot-password", methods=["GET", "POST"])
@limiter.limit("5 per minute")
def forgot_password():
    if request.method == "POST":
        email = normalize_email(request.form.get("email"))
        user = User.query.filter_by(email=email).first() if email else None
        if user:
            reset_token = create_password_reset_token(user)
            log_security_event(user.id, "password.reset_requested")
            reset_path = url_for("auth.reset_password", token=reset_token, _external=False)
            if mail_configured():
                send_email(
                    user.email,
                    "Reset your Study Space password",
                    f"Reset your Study Space password here: {build_absolute_url(reset_path)}",
                )
                log_security_event(user.id, "password.reset_email_sent")
            elif not current_app.config.get("IS_PRODUCTION"):
                flash(reset_path, "success")
            db.session.commit()
        else:
            log_security_event(None, "password.reset_requested_unknown", {"email_provided": bool(email)})
            db.session.commit()
        flash("If that email exists, a password reset link has been prepared.", "success")
        return redirect(url_for("auth.login"))

    return render_template("forgot_password.html")


@auth_bp.route("/reset-password/<token>", methods=["GET", "POST"])
@limiter.limit("5 per minute")
def reset_password(token):
    user = User.query.filter_by(password_reset_token_hash=hash_token(token)).first()
    if not user:
        flash("Password reset link is invalid.", "error")
        return redirect(url_for("auth.forgot_password"))
    if password_reset_expired(user):
        log_security_event(user.id, "password.reset_failed", {"reason": "expired"})
        user.password_reset_token_hash = None
        user.password_reset_sent_at = None
        db.session.commit()
        flash("Password reset link has expired.", "error")
        return redirect(url_for("auth.forgot_password"))

    if request.method == "POST":
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")
        if password != confirm_password:
            log_security_event(user.id, "password.reset_failed", {"reason": "confirmation"})
            db.session.commit()
            flash("Password confirmation does not match.", "error")
            return redirect(url_for("auth.reset_password", token=token))
        password_errors = password_strength_errors(password)
        if password_errors:
            log_security_event(user.id, "password.reset_failed", {"reason": "strength"})
            db.session.commit()
            for error in password_errors:
                flash(error, "error")
            return redirect(url_for("auth.reset_password", token=token))

        user.password_hash = generate_password_hash(password)
        user.password_reset_token_hash = None
        user.password_reset_sent_at = None
        log_security_event(user.id, "password.reset_completed")
        db.session.commit()
        session.clear()
        flash("Password reset successfully. Sign in with your new password.", "success")
        return redirect(url_for("auth.login"))

    return render_template("reset_password.html", token=token)


@auth_bp.route("/verify-email/<token>")
def verify_email(token):
    token_hash = hash_token(token)
    user = User.query.filter_by(email_verification_token_hash=token_hash).first()
    if not user:
        flash("Email verification link is invalid.", "error")
        return redirect(url_for("auth.login"))
    if email_verification_expired(user):
        log_security_event(user.id, "email.verify_failed", {"reason": "expired"})
        db.session.commit()
        flash("Email verification link has expired. Request a new one from settings.", "error")
        return redirect(url_for("settings.settings") if session.get("user_id") else url_for("auth.login"))

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_sent_at = None
    log_security_event(user.id, "email.verified")
    db.session.commit()
    flash("Email verified successfully.", "success")
    return redirect(url_for("dashboard.dashboard") if session.get("user_id") else url_for("auth.login"))


@auth_bp.route("/logout", methods=["POST"])
def logout():
    user_id = session.get("user_id")
    if user_id:
        log_security_event(user_id, "auth.logout")
        db.session.commit()
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("auth.login"))


@auth_bp.route("/logout", methods=["GET"])
def logout_get():
    flash("Use the logout button to sign out securely.", "error")
    return redirect(url_for("dashboard.dashboard") if session.get("user_id") else url_for("auth.login"))
