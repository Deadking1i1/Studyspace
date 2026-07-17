from flask import Blueprint, flash, redirect, render_template, request, url_for

from auth_helpers import login_required
from extensions import db
from models import Task
from services import current_user_id, paginate_query, parse_iso_date, sanitize_plain, timestamp_now


tasks_bp = Blueprint("tasks", __name__)


@tasks_bp.route("/tasks", methods=["GET", "POST"])
@login_required
def tasks():
    user_id = current_user_id()
    if request.method == "POST":
        task_text = sanitize_plain(request.form.get("task"))
        subject = sanitize_plain(request.form.get("subject"))
        priority = sanitize_plain(request.form.get("priority")) or "medium"
        due_date = parse_iso_date(request.form.get("due"))
        if priority not in {"low", "medium", "high"}:
            priority = "medium"
        if task_text and due_date:
            db.session.add(
                Task(
                    user_id=user_id,
                    task=task_text,
                    subject=subject,
                    priority=priority,
                    due_date=due_date,
                    completed=False,
                    archived=False,
                    created_at=timestamp_now(),
                )
            )
            db.session.commit()
            flash("Task added to your planner.", "success")
        else:
            flash("Task and due date are required.", "error")
        return redirect(url_for("tasks.tasks"))

    status = request.args.get("status", "open")
    priority = request.args.get("priority", "")
    page = request.args.get("page", 1, type=int)
    task_query = Task.query.filter_by(user_id=user_id)
    if status == "completed":
        task_query = task_query.filter_by(completed=True, archived=False)
    elif status == "archived":
        task_query = task_query.filter_by(archived=True)
    else:
        task_query = task_query.filter_by(completed=False, archived=False)
    if priority in {"low", "medium", "high"}:
        task_query = task_query.filter_by(priority=priority)

    paginated_tasks = paginate_query(
        task_query.order_by(Task.due_date.asc(), Task.priority.desc()),
        page,
        12,
    )
    return render_template(
        "tasks.html",
        tasks=paginated_tasks["items"],
        pagination=paginated_tasks,
        status=status,
        priority=priority,
    )


@tasks_bp.route("/tasks/<int:task_id>/complete", methods=["POST"])
@login_required
def complete_task(task_id):
    task = Task.query.filter_by(id=task_id, user_id=current_user_id()).first()
    if not task:
        flash("Task not found.", "error")
        return redirect(url_for("tasks.tasks"))

    task.completed = True
    db.session.commit()
    flash("Task marked complete.", "success")
    return redirect(url_for("tasks.tasks"))


@tasks_bp.route("/tasks/<int:task_id>/<action>", methods=["POST"])
@login_required
def update_task_state(task_id, action):
    task = Task.query.filter_by(id=task_id, user_id=current_user_id()).first()
    if not task:
        flash("Task not found.", "error")
        return redirect(url_for("tasks.tasks"))

    if action == "reopen":
        task.completed = False
        task.archived = False
    elif action == "archive":
        task.archived = True
    elif action == "restore":
        task.archived = False
    elif action == "delete":
        db.session.delete(task)
        db.session.commit()
        flash("Task deleted.", "success")
        return redirect(url_for("tasks.tasks"))
    else:
        flash("Unknown task action.", "error")
        return redirect(url_for("tasks.tasks"))

    db.session.commit()
    flash("Task updated.", "success")
    return redirect(url_for("tasks.tasks"))
