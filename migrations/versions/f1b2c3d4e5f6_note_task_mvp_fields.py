"""note and task mvp fields

Revision ID: f1b2c3d4e5f6
Revises: ecd2390ffa03
Create Date: 2026-07-09 20:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f1b2c3d4e5f6"
down_revision = "ecd2390ffa03"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.add_column(sa.Column("subject", sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column("tags", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("is_favorite", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("is_archived", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("is_pinned", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.create_index("ix_notes_user_archived_pinned", ["user_id", "is_archived", "is_pinned"], unique=False)

    with op.batch_alter_table("tasks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("subject", sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column("priority", sa.String(length=32), nullable=True, server_default="medium"))
        batch_op.add_column(sa.Column("reminder_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("archived", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.create_index("ix_tasks_user_archived_priority", ["user_id", "archived", "priority"], unique=False)


def downgrade():
    with op.batch_alter_table("tasks", schema=None) as batch_op:
        batch_op.drop_index("ix_tasks_user_archived_priority")
        batch_op.drop_column("archived")
        batch_op.drop_column("created_at")
        batch_op.drop_column("reminder_at")
        batch_op.drop_column("priority")
        batch_op.drop_column("subject")

    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.drop_index("ix_notes_user_archived_pinned")
        batch_op.drop_column("is_pinned")
        batch_op.drop_column("is_archived")
        batch_op.drop_column("is_favorite")
        batch_op.drop_column("updated_at")
        batch_op.drop_column("tags")
        batch_op.drop_column("subject")
