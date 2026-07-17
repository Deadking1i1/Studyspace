"""email verification foundation

Revision ID: d5e7f9a1b2c4
Revises: c4d6e8f0a1b3
Create Date: 2026-07-12 00:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "d5e7f9a1b2c4"
down_revision = "c4d6e8f0a1b3"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("email_verified", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("email_verification_token_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("email_verification_sent_at", sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("email_verification_sent_at")
        batch_op.drop_column("email_verification_token_hash")
        batch_op.drop_column("email_verified")
