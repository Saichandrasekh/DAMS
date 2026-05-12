"""Daily database backup script.

Creates a timestamped copy of attendance.db in database/backups/.
Keeps the most recent N days (default 30) and deletes older backups.

Run manually:
    .\\venv\\Scripts\\python.exe backup_db.py

Or schedule it (see backup_schedule.ps1) to run daily.
"""
import os
import sqlite3
import shutil
import datetime
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, 'database', 'attendance.db')
BACKUP_DIR = os.path.join(HERE, 'database', 'backups')
KEEP_DAYS = int(os.environ.get('DAMS_BACKUP_KEEP_DAYS', '30'))


def safe_copy_sqlite(src: str, dst: str) -> None:
    """Use SQLite's BACKUP API for a consistent snapshot even if writers are active."""
    src_conn = sqlite3.connect(src)
    dst_conn = sqlite3.connect(dst)
    try:
        with dst_conn:
            src_conn.backup(dst_conn)
    finally:
        src_conn.close()
        dst_conn.close()


def main() -> int:
    if not os.path.exists(DB_PATH):
        print(f'ERROR: database not found at {DB_PATH}', file=sys.stderr)
        return 1

    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')
    dst = os.path.join(BACKUP_DIR, f'attendance_{ts}.db')

    try:
        safe_copy_sqlite(DB_PATH, dst)
        size_kb = os.path.getsize(dst) / 1024
        print(f'OK  backed up to {dst}  ({size_kb:.0f} KB)')
    except Exception as e:
        # Fall back to plain file copy if SQLite backup API fails for any reason
        try:
            shutil.copy2(DB_PATH, dst)
            print(f'WARN  sqlite backup failed ({e}); used file copy: {dst}')
        except Exception as e2:
            print(f'ERROR  backup failed: {e2}', file=sys.stderr)
            return 2

    cutoff = datetime.datetime.now() - datetime.timedelta(days=KEEP_DAYS)
    deleted = 0
    for name in os.listdir(BACKUP_DIR):
        if not name.startswith('attendance_') or not name.endswith('.db'):
            continue
        path = os.path.join(BACKUP_DIR, name)
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(path))
        if mtime < cutoff:
            try:
                os.remove(path)
                deleted += 1
            except OSError:
                pass
    if deleted:
        print(f'PRUNE  removed {deleted} backup(s) older than {KEEP_DAYS} days')

    total = sum(1 for n in os.listdir(BACKUP_DIR) if n.endswith('.db'))
    print(f'STATUS  {total} backup(s) kept in {BACKUP_DIR}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
