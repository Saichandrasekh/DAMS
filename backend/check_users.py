import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'database', 'attendance.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
print("Staff users seeded:")
for r in conn.execute("SELECT email, role, is_active FROM users WHERE role NOT IN ('student','parent')"):
    print(f"Email: {r['email']}, Role: {r['role']}, Active: {r['is_active']}")
conn.close()
