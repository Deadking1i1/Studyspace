import json
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path


TABLES = [
    "users",
    "user_profiles",
    "user_settings",
    "security_events",
    "notes",
    "flashcards",
    "flashcard_cards",
    "study_sessions",
    "groups",
    "group_members",
    "posts",
    "comments",
    "likes",
    "notifications",
    "achievements",
    "events",
    "tasks",
]


def rows_for_table(connection, table):
    cursor = connection.execute(f"select * from {table}")
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "database.db").resolve()
    output = Path(sys.argv[2] if len(sys.argv) > 2 else "migration-data/study-space-sqlite-export.json").resolve()
    payload = {
        "exportedAt": datetime.now(UTC).isoformat(),
        "source": str(source),
        "tables": {},
        "counts": {},
    }
    with sqlite3.connect(source) as connection:
        for table in TABLES:
            rows = rows_for_table(connection, table)
            payload["tables"][table] = rows
            payload["counts"][table] = len(rows)

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Exported {len(TABLES)} tables from {source}")
    print(f"Wrote {output}")
    print(json.dumps(payload["counts"], indent=2))


if __name__ == "__main__":
    main()
