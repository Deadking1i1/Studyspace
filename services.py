import json
import re
import secrets
import smtplib
from hashlib import sha256
from math import ceil
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from urllib.parse import urlparse

from bleach import clean as bleach_clean
from flask import current_app, has_request_context, request, session
from sqlalchemy import or_


def current_user_id():
    return session.get("user_id")


def timestamp_now():
    return datetime.now()


def normalize_email(value):
    return (value or "").strip().lower()


def hash_token(token):
    return sha256((token or "").encode("utf-8")).hexdigest()


def create_email_verification_token(user):
    token = secrets.token_urlsafe(32)
    user.email_verification_token_hash = hash_token(token)
    user.email_verification_sent_at = timestamp_now()
    user.email_verified = False
    return token


def create_pending_email_token(user, pending_email):
    token = secrets.token_urlsafe(32)
    user.pending_email = normalize_email(pending_email)
    user.pending_email_token_hash = hash_token(token)
    user.pending_email_sent_at = timestamp_now()
    return token


def email_verification_expired(user, max_age_hours=48):
    if not user.email_verification_sent_at:
        return True
    return timestamp_now() - user.email_verification_sent_at > timedelta(hours=max_age_hours)


def pending_email_expired(user, max_age_hours=24):
    if not user.pending_email_sent_at:
        return True
    return timestamp_now() - user.pending_email_sent_at > timedelta(hours=max_age_hours)


def create_password_reset_token(user):
    token = secrets.token_urlsafe(32)
    user.password_reset_token_hash = hash_token(token)
    user.password_reset_sent_at = timestamp_now()
    return token


def password_reset_expired(user, max_age_hours=2):
    if not user.password_reset_sent_at:
        return True
    return timestamp_now() - user.password_reset_sent_at > timedelta(hours=max_age_hours)


def mail_configured():
    return bool(current_app.config.get("MAIL_SERVER") and current_app.config.get("MAIL_DEFAULT_SENDER"))


def send_email(to_email, subject, body):
    if not mail_configured():
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = current_app.config["MAIL_DEFAULT_SENDER"]
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(current_app.config["MAIL_SERVER"], current_app.config["MAIL_PORT"], timeout=10) as smtp:
        if current_app.config.get("MAIL_USE_TLS"):
            smtp.starttls()
        if current_app.config.get("MAIL_USERNAME"):
            smtp.login(current_app.config["MAIL_USERNAME"], current_app.config["MAIL_PASSWORD"])
        smtp.send_message(message)
    return True


def build_absolute_url(path):
    return f"{current_app.config.get('APP_BASE_URL', '').rstrip('/')}{path}"


def ensure_account_records(user):
    from extensions import db
    from models import UserProfile, UserSettings

    created = False
    now = timestamp_now()
    if user.profile is None:
        user.profile = UserProfile(
            display_name=user.username,
            bio=user.bio,
            profile_pic=user.profile_pic,
            course=user.course,
            profile_visibility="private",
            created_at=now,
            updated_at=now,
        )
        created = True
    if user.settings is None:
        user.settings = UserSettings(created_at=now, updated_at=now)
        created = True
    if created:
        db.session.add(user)
    return user.profile, user.settings


def log_security_event(user_id, event_type, metadata=None):
    from extensions import db
    from models import SecurityEvent

    ip_address = None
    user_agent = None
    if has_request_context():
        ip_address = request.headers.get("X-Forwarded-For", request.remote_addr)
        if ip_address:
            ip_address = ip_address.split(",", 1)[0].strip()[:64]
        user_agent = (request.headers.get("User-Agent") or "")[:255]

    db.session.add(
        SecurityEvent(
            user_id=user_id,
            event_type=event_type[:64],
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json=json.dumps(metadata or {}, sort_keys=True),
            created_at=timestamp_now(),
        )
    )


def model_to_dict(instance):
    values = {}
    for column in instance.__table__.columns:
        value = getattr(instance, column.name)
        if isinstance(value, (date, datetime)):
            value = value.isoformat()
        values[column.name] = value
    return values


def public_user_export(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "email_verified": bool(user.email_verified),
        "pending_email": user.pending_email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "streak_days": user.streak_days,
        "total_hours": user.total_hours,
    }


def export_user_data(user):
    from models import (
        Achievement,
        Comment,
        Event,
        Flashcard,
        Group,
        GroupMember,
        Like,
        Note,
        Notification,
        Post,
        StudySession,
        Task,
    )

    ensure_account_records(user)
    memberships = GroupMember.query.filter_by(user_id=user.id).all()
    created_groups = Group.query.filter_by(created_by=user.id).all()
    posts = Post.query.filter_by(user_id=user.id).all()
    comments = Comment.query.filter_by(user_id=user.id).all()
    likes = Like.query.filter_by(user_id=user.id).all()

    flashcards = []
    for flashcard in Flashcard.query.filter_by(user_id=user.id).all():
        item = model_to_dict(flashcard)
        item["card"] = model_to_dict(flashcard.card) if flashcard.card else None
        flashcards.append(item)

    return {
        "exported_at": timestamp_now().isoformat(),
        "user": public_user_export(user),
        "profile": model_to_dict(user.profile),
        "settings": model_to_dict(user.settings),
        "notes": [model_to_dict(note) for note in Note.query.filter_by(user_id=user.id).all()],
        "tasks": [model_to_dict(task) for task in Task.query.filter_by(user_id=user.id).all()],
        "events": [model_to_dict(event) for event in Event.query.filter_by(user_id=user.id).all()],
        "study_sessions": [
            model_to_dict(study_session)
            for study_session in StudySession.query.filter_by(user_id=user.id).all()
        ],
        "flashcards": flashcards,
        "achievements": [
            model_to_dict(achievement)
            for achievement in Achievement.query.filter_by(user_id=user.id).all()
        ],
        "notifications": [
            model_to_dict(notification)
            for notification in Notification.query.filter_by(user_id=user.id).all()
        ],
        "groups": {
            "memberships": [model_to_dict(membership) for membership in memberships],
            "created": [model_to_dict(group) for group in created_groups],
        },
        "community": {
            "posts": [model_to_dict(post) for post in posts],
            "comments": [model_to_dict(comment) for comment in comments],
            "note_likes": [model_to_dict(like) for like in likes],
        },
    }


def delete_user_account(user):
    from extensions import db
    from models import (
        Achievement,
        Comment,
        Event,
        Flashcard,
        FlashcardCard,
        Group,
        GroupMember,
        Like,
        Note,
        Notification,
        Post,
        StudySession,
        Task,
        UserProfile,
        UserSettings,
    )

    note_ids = [note_id for (note_id,) in db.session.query(Note.id).filter_by(user_id=user.id).all()]
    flashcard_ids = [
        flashcard_id
        for (flashcard_id,) in db.session.query(Flashcard.id).filter_by(user_id=user.id).all()
    ]
    created_group_ids = [
        group_id for (group_id,) in db.session.query(Group.id).filter_by(created_by=user.id).all()
    ]

    orphaned_group_ids = []
    for group_id in created_group_ids:
        replacement_member = (
            GroupMember.query.filter(GroupMember.group_id == group_id, GroupMember.user_id != user.id)
            .order_by(GroupMember.joined_at.asc())
            .first()
        )
        if replacement_member:
            Group.query.filter_by(id=group_id).update({"created_by": replacement_member.user_id})
        else:
            orphaned_group_ids.append(group_id)

    post_filters = [Post.user_id == user.id]
    if orphaned_group_ids:
        post_filters.append(Post.group_id.in_(orphaned_group_ids))
    post_ids = [
        post_id
        for (post_id,) in db.session.query(Post.id).filter(or_(*post_filters)).all()
    ]

    if post_ids:
        Comment.query.filter(or_(Comment.user_id == user.id, Comment.post_id.in_(post_ids))).delete(
            synchronize_session=False
        )
        Post.query.filter(Post.id.in_(post_ids)).delete(synchronize_session=False)
    else:
        Comment.query.filter_by(user_id=user.id).delete(synchronize_session=False)

    if orphaned_group_ids:
        GroupMember.query.filter(GroupMember.group_id.in_(orphaned_group_ids)).delete(
            synchronize_session=False
        )
        Group.query.filter(Group.id.in_(orphaned_group_ids)).delete(synchronize_session=False)

    GroupMember.query.filter_by(user_id=user.id).delete(synchronize_session=False)

    if note_ids:
        Like.query.filter(or_(Like.user_id == user.id, Like.note_id.in_(note_ids))).delete(
            synchronize_session=False
        )
        Note.query.filter(Note.id.in_(note_ids)).delete(synchronize_session=False)
    else:
        Like.query.filter_by(user_id=user.id).delete(synchronize_session=False)

    if flashcard_ids:
        FlashcardCard.query.filter(FlashcardCard.flashcard_id.in_(flashcard_ids)).delete(
            synchronize_session=False
        )
        Flashcard.query.filter(Flashcard.id.in_(flashcard_ids)).delete(synchronize_session=False)

    Achievement.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    Notification.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    Event.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    StudySession.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    Task.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    UserProfile.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    UserSettings.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.delete(user)
    db.session.commit()


def parse_iso_date(value):
    cleaned = (value or "").strip()
    if not cleaned:
        return None
    try:
        return date.fromisoformat(cleaned)
    except ValueError:
        return None


def paginate_query(query, page, per_page):
    page = max(page or 1, 1)
    per_page = max(per_page or 10, 1)
    total = query.count()
    pages = max(ceil(total / per_page), 1)
    page = min(page, pages)
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": pages,
        "has_prev": page > 1,
        "has_next": page < pages,
        "prev_page": page - 1 if page > 1 else None,
        "next_page": page + 1 if page < pages else None,
    }


def sanitize_plain(value):
    return bleach_clean((value or "").strip(), strip=True)


def sanitize_rich_text(value):
    return bleach_clean(
        (value or "").strip(),
        tags=["b", "i", "u", "ul", "ol", "li", "p", "br"],
        strip=True,
    )


def allowed_file(filename):
    if not filename:
        return False
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", set())
    )


def password_strength_errors(password):
    errors = []
    if len(password or "") < 8:
        errors.append("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password or ""):
        errors.append("Password must include an uppercase letter.")
    if not re.search(r"[a-z]", password or ""):
        errors.append("Password must include a lowercase letter.")
    if not re.search(r"\d", password or ""):
        errors.append("Password must include a number.")
    if not re.search(r"[^A-Za-z0-9]", password or ""):
        errors.append("Password must include a symbol.")
    return errors


def image_signature_mime(header):
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    return None


def validate_image_upload(file_storage):
    if not file_storage or not file_storage.filename:
        return False, "No image selected."
    if not allowed_file(file_storage.filename):
        return False, "Invalid image type. Allowed: png, jpg, jpeg, gif."
    if file_storage.mimetype not in current_app.config.get("ALLOWED_IMAGE_MIME_TYPES", set()):
        return False, "Uploaded file does not look like a supported image."

    position = file_storage.stream.tell()
    header = file_storage.stream.read(16)
    file_storage.stream.seek(position)
    detected_mime = image_signature_mime(header)
    if detected_mime != file_storage.mimetype:
        return False, "Uploaded file content does not match its image type."
    return True, None


def is_safe_pdf_url(url):
    parsed = urlparse((url or "").strip())
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    allowed_domains = current_app.config.get("PDF_ALLOWED_DOMAINS", set())
    hostname = parsed.hostname.lower()
    return hostname in allowed_domains or any(hostname.endswith(f".{domain}") for domain in allowed_domains)


def summarize_text(text):
    if not text:
        return "No content available to summarise."
    cleaned = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    meaningful = [sentence.strip() for sentence in sentences if len(sentence.strip()) > 20]
    if not meaningful:
        return cleaned[:140] + ("..." if len(cleaned) > 140 else "")
    summary = " ".join(meaningful[:2])
    if len(summary) > 220:
        summary = summary[:220].rstrip() + "..."
    return summary
