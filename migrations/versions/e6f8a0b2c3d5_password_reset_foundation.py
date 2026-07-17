"""password reset foundation

Revision ID: e6f8a0b2c3d5
Revises: d5e7f9a1b2c4
Create Date: 2026-07-14 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "e6f8a0b2c3d5"
down_revision = "d5e7f9a1b2c4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("password_reset_token_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("password_reset_sent_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("password_reset_sent_at")
        batch_op.drop_column("password_reset_token_hash")
