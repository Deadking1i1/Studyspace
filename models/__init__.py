from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# SQLAlchemy application objects.
db = SQLAlchemy()
migrate = Migrate()

from .models import *  # noqa: F401,F403
