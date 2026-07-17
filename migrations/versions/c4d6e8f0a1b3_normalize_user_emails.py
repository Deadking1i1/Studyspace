"""normalize user emails

Revision ID: c4d6e8f0a1b3
Revises: b3c5d7e9f1a2
Create Date: 2026-07-12 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "c4d6e8f0a1b3"
down_revision = "b3c5d7e9f1a2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    users = bind.execute(sa.text("SELECT id, email FROM users ORDER BY id")).fetchall()
    seen = set()
    for user in users:
        normalized = (user.email or "").strip().lower()
        if normalized in seen:
            local_part, separator, domain = normalized.partition("@")
            normalized = f"{local_part}+user{user.id}{separator}{domain}" if separator else f"{normalized}+user{user.id}"
        seen.add(normalized)
        bind.execute(sa.text("UPDATE users SET email = :email WHERE id = :id"), {"email": normalized, "id": user.id})

    op.execute("UPDATE users SET email = LOWER(TRIM(email))")


def downgrade():
    pass
