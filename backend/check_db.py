import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'attendance.db')

def check():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    with open('log_db.txt', 'w') as f:
        f.write("--- Users ---\n")
        users = conn.execute("SELECT id, email, role, school_id, is_active FROM users").fetchall()
        for u in users:
            f.write(f"ID: {u['id']}, Email: {u['email']}, Role: {u['role']}, School ID: {u['school_id']}, Active: {u['is_active']}\n")
        
        f.write("\n--- Schools ---\n")
        schools = conn.execute("SELECT id, name, code FROM schools").fetchall()
        for s in schools:
            f.write(f"ID: {s['id']}, Name: {s['name']}, Code: {s['code']}\n")
        
        f.write("\n--- Admins/Supers ---\n")
        admins = conn.execute("SELECT id, email, role, school_id FROM users WHERE role IN ('super_admin', 'admin')").fetchall()
        for a in admins:
            f.write(f"ID: {a['id']}, Email: {a['email']}, Role: {a['role']}, School ID: {a['school_id']}\n")
    
    conn.close()

if __name__ == "__main__":
    check()
