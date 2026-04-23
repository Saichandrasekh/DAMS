import os
import sys
from datetime import date, timedelta

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.db import get_db, init_db
from middleware.auth import hash_password

def seed():
    print("🌱 Seeding dummy data...")
    init_db()
    db = get_db()

    # 1. Clear existing data (optional but cleaner for seeding)
    db.execute("DELETE FROM student_attendance")
    db.execute("DELETE FROM student_classes")
    db.execute("DELETE FROM parent_student")
    db.execute("DELETE FROM subjects")
    db.execute("DELETE FROM classes")
    db.execute("DELETE FROM users")
    db.execute("DELETE FROM schools")
    db.commit()

    # 2. Create School
    db.execute('''
        INSERT INTO schools (id, name, code, email, primary_color, academic_year) 
        VALUES (1, 'DAMS Academy', 'DAMS01', 'info@dams.edu', '#4f46e5', '2025-2026')
    ''')

    # 3. Create Users
    # Super Admin
    db.execute('''
        INSERT INTO users (school_id, name, email, password, role) 
        VALUES (1, 'Super Admin', 'superadmin@admin.com', ?, 'super_admin')
    ''', (hash_password('admin123'),))

    # School Admin
    db.execute('''
        INSERT INTO users (school_id, name, email, password, role) 
        VALUES (1, 'School Principal', 'admin@school.com', ?, 'admin')
    ''', (hash_password('admin123'),))

    # Teachers
    db.execute('''
        INSERT INTO users (id, school_id, name, email, password, role) 
        VALUES (10, 1, 'John Doe (Maths)', 'john@teacher.com', ?, 'teacher')
    ''', (hash_password('teacher123'),))
    
    db.execute('''
        INSERT INTO users (id, school_id, name, email, password, role) 
        VALUES (11, 1, 'Jane Smith (English)', 'jane@teacher.com', ?, 'teacher')
    ''', (hash_password('teacher123'),))

    # Student
    db.execute('''
        INSERT INTO users (id, school_id, name, email, password, role) 
        VALUES (100, 1, 'Alice Student', 'alice@student.com', ?, 'student')
    ''', (hash_password('student123'),))

    # 4. Create Classes
    db.execute('''
        INSERT INTO classes (id, school_id, name, section, academic_year, class_teacher_id)
        VALUES (1, 1, 'Grade 10', 'A', '2025-2026', 10)
    ''')

    # 5. Create Subjects
    db.execute('''
        INSERT INTO subjects (id, school_id, class_id, name, teacher_id)
        VALUES (1, 1, 1, 'Mathematics', 10)
    ''')
    db.execute('''
        INSERT INTO subjects (id, school_id, class_id, name, teacher_id)
        VALUES (2, 1, 1, 'English', 11)
    ''')

    # 6. Map Student to Class
    db.execute('''
        INSERT INTO student_classes (student_id, class_id, roll_no)
        VALUES (100, 1, '10A01')
    ''')

    # 7. Add Some Attendance history
    today = date.today()
    for i in range(1, 6):
        d = (today - timedelta(days=i)).isoformat()
        db.execute('''
            INSERT INTO student_attendance (student_id, class_id, subject_id, date, status, marked_by)
            VALUES (100, 1, 1, ?, 'present', 10)
        ''', (d,))

    db.commit()
    db.close()
    print("✅ Dummy data seeded successfully!")
    print("\nLogins:")
    print("Super Admin: superadmin@admin.com / admin123")
    print("School Admin: admin@school.com / admin123")
    print("Teacher: john@teacher.com / teacher123")
    print("Student: alice@student.com / student123")

if __name__ == "__main__":
    seed()
