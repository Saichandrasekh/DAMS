"""One-shot migration: remove duplicate timetable rows + add UNIQUE index.

A bug let the timetable table accumulate multiple rows for the same
(class_id, day_of_week, period_no) when a user changed the subject for a slot.
This script:
  1. Identifies duplicate groups
  2. Keeps the highest-id row in each group (most recent edit)
  3. Adds a UNIQUE index so future edits replace cleanly

Idempotent — safe to run multiple times.
"""
import os
import sqlite3
import sys

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'attendance.db')


def main() -> int:
    if not os.path.exists(DB):
        print(f'ERROR: database not found at {DB}', file=sys.stderr)
        return 1

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        # 1) Show dupes before
        dupes = conn.execute('''
            SELECT class_id, day_of_week, period_no, COUNT(*) c, GROUP_CONCAT(id) ids
            FROM timetable
            GROUP BY class_id, day_of_week, period_no
            HAVING c > 1
        ''').fetchall()

        if not dupes:
            print('OK  no duplicate timetable rows found')
        else:
            print(f'Found {len(dupes)} duplicate slot(s):')
            for d in dupes:
                print(f"   class_id={d['class_id']} {d['day_of_week']} P{d['period_no']}  rows={d['ids']}")

            # 2) Delete dupes — keep the row with the highest id (most recent)
            deleted = conn.execute('''
                DELETE FROM timetable
                WHERE id NOT IN (
                    SELECT MAX(id) FROM timetable
                    GROUP BY class_id, day_of_week, period_no
                )
            ''').rowcount
            conn.commit()
            print(f'OK  deleted {deleted} duplicate row(s)')

        # 3) Add the unique index so this can't happen again
        existing = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_timetable_slot_uniq'"
        ).fetchone()
        if existing:
            print('OK  unique index already exists')
        else:
            conn.execute('''
                CREATE UNIQUE INDEX idx_timetable_slot_uniq
                ON timetable (class_id, day_of_week, period_no)
            ''')
            conn.commit()
            print('OK  created unique index on (class_id, day_of_week, period_no)')

        return 0
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
