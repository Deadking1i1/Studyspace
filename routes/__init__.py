from .achievements import achievements_bp
from .assistant import assistant_bp
from .auth import auth_bp
from .dashboard import dashboard_bp
from .feed import feed_bp
from .flashcards import flashcards_bp
from .groups import groups_bp
from .hub import hub_bp
from .notes import notes_bp
from .notifications import notifications_bp
from .profile import profile_bp
from .settings import settings_bp
from .study_sessions import study_sessions_bp
from .tasks import tasks_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(hub_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(flashcards_bp)
    app.register_blueprint(study_sessions_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(feed_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(assistant_bp)
    app.register_blueprint(achievements_bp)
