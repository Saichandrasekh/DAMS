import sqlite3
import os
import bcrypt
import datetime

# Import hash_password logic directly to avoid Flask context issues
def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

DB_PATH = os.path.join('database', 'attendance.db')

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    print("🌱 Starting Seeding Process...")

    try:
        # 1. Create School
        school_name = "Emerald Heights Academy"
        cursor.execute("INSERT INTO schools (name, code, address, email, periods_per_day) VALUES (?, ?, ?, ?, ?)",
                       (school_name, "EHA", "123 Academic Way", "info@emeraldheights.edu", 8))
        school_id = cursor.lastrowid
        print(f"✅ Created School: {school_name} (ID: {school_id})")

        # 2. Create Admin
        admin_email = "admin_eha@test.com"
        cursor.execute("INSERT INTO users (school_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
                       (school_id, "Principal Evans", admin_email, hash_password("pass123"), "admin"))
        print(f"✅ Created Admin: {admin_email}")

        # 3. Create Classes
        cursor.execute("INSERT INTO classes (school_id, name, section) VALUES (?, ?, ?)", (school_id, "10th Standard", "Section A"))
        class_a_id = cursor.lastrowid
        cursor.execute("INSERT INTO classes (school_id, name, section) VALUES (?, ?, ?)", (school_id, "10th Standard", "Section B"))
        class_b_id = cursor.lastrowid
        print("✅ Created Classes: 10-A and 10-B")

        # 4. Create Teachers
        teachers = [
            ("Prof. Smith", "smith@test.com"),
            ("Ms. Johnson", "johnson@test.com")
        ]
        teacher_ids = []
        for name, email in teachers:
            cursor.execute("INSERT INTO users (school_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
                           (school_id, name, email, hash_password("pass123"), "teacher"))
            teacher_ids.append(cursor.lastrowid)
        print(f"✅ Created {len(teachers)} Teachers")

        # 5. Create Subjects and Link to Teachers
        cursor.execute("INSERT INTO subjects (school_id, name, teacher_id, class_id) VALUES (?, ?, ?, ?)",
                       (school_id, "Mathematics", teacher_ids[0], class_a_id))
        math_id = cursor.lastrowid
        cursor.execute("INSERT INTO subjects (school_id, name, teacher_id, class_id) VALUES (?, ?, ?, ?)",
                       (school_id, "Physics", teacher_ids[1], class_a_id))
        physics_id = cursor.lastrowid
        print("✅ Created Subjects and assigned to Teachers")

        # 6. Create Students and Link to Classes
        students_data = [
            ("Alice Brown", "alice@test.com", "101", class_a_id),
            ("Bob Wilson", "bob@test.com", "102", class_a_id),
            ("Charlie Davis", "charlie@test.com", "201", class_b_id)
        ]
        for name, email, roll, cid in students_data:
            cursor.execute("INSERT INTO users (school_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
                           (school_id, name, email, hash_password("pass123"), "student"))
            sid = cursor.lastrowid
            cursor.execute("INSERT INTO student_classes (student_id, class_id, roll_no) VALUES (?, ?, ?)",
                           (sid, cid, roll))
        print(f"✅ Created {len(students_data)} Students and linked to classes")

        # 7. Seed Timetable for 10-A (Monday)
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        for day in days:
            cursor.execute("INSERT INTO timetable (class_id, subject_id, day_of_week, period_no) VALUES (?, ?, ?, ?)",
                           (class_a_id, math_id, day, 1))
            cursor.execute("INSERT INTO timetable (class_id, subject_id, day_of_week, period_no) VALUES (?, ?, ?, ?)",
                           (class_a_id, physics_id, day, 2))
        print("✅ Seeded Timetable for the whole week (Periods 1 & 2)")

        # 8. Seed an Exam
        cursor.execute("INSERT INTO exams (school_id, name, exam_date, academic_year) VALUES (?, ?, ?, ?)",
                       (school_id, "Mid-Term Examination", "2026-05-15", "2026"))
        exam_id = cursor.lastrowid
        print("✅ Created Mid-Term Exam")

        conn.commit()
        print("\n✨ ALL DUMMY DATA SEEDED SUCCESSFULLY! ✨")
        print(f"Login with: {admin_email} / pass123")
                                                                                                                                                                                                                                                                                                           
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed()
