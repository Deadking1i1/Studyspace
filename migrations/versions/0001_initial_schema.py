"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-09 19:55:00.000000

"""
from alembic import op

from models import db


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    db.metadata.create_all(bind=bind)


def downgrade():
    bind = op.get_bind()
    db.metadata.drop_all(bind=bind)
