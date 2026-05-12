"""One-shot migration: wipe plaintext passwords from the users table.

The 'original_password' column was being stored unhashed to support a
"reveal password" feature in Superadmin > Credentials. That's a security
risk: anyone with read access to the DB sees all real passwords.

After this script runs, the column still exists (so SQL queries don't
break) but every value is NULL. The Superadmin Credentials UI now shows
"Reset password" instead of "Show password".

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
    try:
        before = conn.execute(
            "SELECT COUNT(*) FROM users WHERE original_password IS NOT NULL AND original_password != ''"
        ).fetchone()[0]
        if before == 0:
            print('OK  already clean — no plaintext passwords stored')
            return 0
        conn.execute("UPDATE users SET original_password = NULL")
        conn.commit()
        print(f'OK  wiped plaintext from {before} user record(s)')
        print('    Bcrypt-hashed `password` column is unchanged. Existing logins still work.')
        return 0
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
