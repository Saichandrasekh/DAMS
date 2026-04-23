import sqlite3
import os
from middleware.auth import hash_password

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'attendance.db')

def seed():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # 1. Create a System school if not exists
    cursor = conn.execute("SELECT id FROM schools WHERE code='SYSTEM'")
    school = cursor.fetchone()
    if not school:
        cursor = conn.execute(
            "INSERT INTO schools (name, code, primary_color) VALUES (?, ?, ?)",
            ('Platform Admin', 'SYSTEM', '#4f46e5')
        )
        school_id = cursor.lastrowid
        print(f"Created System School with ID: {school_id}")
    else:
        school_id = school['id']
        print(f"System School already exists with ID: {school_id}")
    
    # 2. Create Super Admin if not exists
    cursor = conn.execute("SELECT id FROM users WHERE role='super_admin'")
    if not cursor.fetchone():
        hashed = hash_password('admin123')
        conn.execute(
            "INSERT INTO users (school_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
            (school_id, 'Super Admin', 'superadmin@admin.com', hashed, 'super_admin')
        )
        conn.commit()
        print("Created Super Admin: superadmin@admin.com / admin123")
    else:
        print("Super Admin already exists.")
    
    conn.close()

if __name__ == "__main__":
    seed()
