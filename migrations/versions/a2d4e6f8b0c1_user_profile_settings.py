"""user profile and settings foundation

Revision ID: a2d4e6f8b0c1
Revises: f1b2c3d4e5f6
Create Date: 2026-07-09 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "a2d4e6f8b0c1"
down_revision = "f1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("user_profiles"):
        op.create_table(
            "user_profiles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("display_name", sa.String(length=128), nullable=True),
            sa.Column("bio", sa.Text(), nullable=True),
            sa.Column("profile_pic", sa.String(length=255), nullable=True),
            sa.Column("course", sa.String(length=128), nullable=True),
            sa.Column("institution", sa.String(length=255), nullable=True),
            sa.Column("education_level", sa.String(length=128), nullable=True),
            sa.Column("field_of_study", sa.String(length=128), nullable=True),
            sa.Column("country", sa.String(length=128), nullable=True),
            sa.Column("profile_visibility", sa.String(length=32), nullable=True, server_default="private"),
            sa.Column("show_email", sa.Boolean(), nullable=True, server_default=sa.text("0")),
            sa.Column("show_academic_profile", sa.Boolean(), nullable=True, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", name="uq_user_profiles_user_id"),
        )
        op.create_index("ix_user_profiles_user", "user_profiles", ["user_id"], unique=False)
        op.create_index("ix_user_profiles_visibility", "user_profiles", ["profile_visibility"], unique=False)

    if not inspector.has_table("user_settings"):
        op.create_table(
            "user_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("theme", sa.String(length=32), nullable=True, server_default="dark"),
            sa.Column("language", sa.String(length=16), nullable=True, server_default="en"),
            sa.Column("timezone", sa.String(length=64), nullable=True, server_default="UTC"),
            sa.Column("reduced_motion", sa.Boolean(), nullable=True, server_default=sa.text("0")),
            sa.Column("high_contrast", sa.Boolean(), nullable=True, server_default=sa.text("0")),
            sa.Column("email_notifications", sa.Boolean(), nullable=True, server_default=sa.text("1")),
            sa.Column("study_reminders", sa.Boolean(), nullable=True, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", name="uq_user_settings_user_id"),
        )
        op.create_index("ix_user_settings_user", "user_settings", ["user_id"], unique=False)

    op.execute(
        """
        INSERT INTO user_profiles (
            user_id, display_name, bio, profile_pic, course, profile_visibility,
            show_email, show_academic_profile, created_at, updated_at
        )
        SELECT
            users.id, users.username, users.bio, users.profile_pic, users.course,
            'private', 0, 0, users.created_at, users.created_at
        FROM users
        WHERE NOT EXISTS (
            SELECT 1 FROM user_profiles WHERE user_profiles.user_id = users.id
        )
        """
    )
    op.execute(
        """
        INSERT INTO user_settings (
            user_id, theme, language, timezone, reduced_motion, high_contrast,
            email_notifications, study_reminders, created_at, updated_at
        )
        SELECT
            users.id, 'dark', 'en', 'UTC', 0, 0, 1, 1, users.created_at, users.created_at
        FROM users
        WHERE NOT EXISTS (
            SELECT 1 FROM user_settings WHERE user_settings.user_id = users.id
        )
        """
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("user_settings"):
        op.drop_index("ix_user_settings_user", table_name="user_settings")
        op.drop_table("user_settings")
    if inspector.has_table("user_profiles"):
        op.drop_index("ix_user_profiles_visibility", table_name="user_profiles")
        op.drop_index("ix_user_profiles_user", table_name="user_profiles")
        op.drop_table("user_profiles")
