"""email change foundation

Revision ID: f7a9b1c3d5e6
Revises: e6f8a0b2c3d5
Create Date: 2026-07-14 01:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "f7a9b1c3d5e6"
down_revision = "e6f8a0b2c3d5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("pending_email", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("pending_email_token_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("pending_email_sent_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("pending_email_sent_at")
        batch_op.drop_column("pending_email_token_hash")
        batch_op.drop_column("pending_email")
