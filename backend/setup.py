import os
import sys

# Add the current directory to sys.path so we can import modules from 'backend'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.db import init_db, get_db
from middleware.auth import hash_password

def setup():
    print("Starting DAMS Setup...")
    
    # 1. Initialize Database Structure
    init_db()
    
    db = get_db()
    
    # 2. Check if Super Admin exists
    existing = db.execute("SELECT * FROM users WHERE role = 'super_admin'").fetchone()
    
    if not existing:
        print("Creating Super Admin account...")
        
        # Create a dummy school for Super Admin (id=1)
        db.execute('''
            INSERT INTO schools (name, code, email, primary_color) 
            VALUES (?, ?, ?, ?)
        ''', ("DAMS Central", "SYSTEM", "admin@dams.app", "#4f46e5"))
        
        school_id = 1
        
        # Create Super Admin User
        admin_email = "superadmin@admin.com"
        admin_pass = "admin123"
        
        db.execute('''
            INSERT INTO users (school_id, name, email, password, role) 
            VALUES (?, ?, ?, ?, ?)
        ''', (school_id, "Platform Admin", admin_email, hash_password(admin_pass), "super_admin"))
        
        db.commit()
        print(f"\nSetup Complete!")
        print(f"---------------------------------")
        print(f"Email:    {admin_email}")
        print(f"Password: {admin_pass}")
        print(f"Role:     Super Admin")
        print(f"---------------------------------")
        print("Keep these credentials safe. You can login and start adding schools.")
    else:
        print("Super Admin already exists.")
    
    db.close()

if __name__ == "__main__":
    setup()
