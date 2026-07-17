"""security event log

Revision ID: b3c5d7e9f1a2
Revises: a2d4e6f8b0c1
Create Date: 2026-07-11 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "b3c5d7e9f1a2"
down_revision = "a2d4e6f8b0c1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("security_events"):
        return

    op.create_table(
        "security_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_security_events_user_created",
        "security_events",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_security_events_type_created",
        "security_events",
        ["event_type", "created_at"],
        unique=False,
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("security_events"):
        return

    op.drop_index("ix_security_events_type_created", table_name="security_events")
    op.drop_index("ix_security_events_user_created", table_name="security_events")
    op.drop_table("security_events")
