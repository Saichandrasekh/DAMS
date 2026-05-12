import sqlite3
import os

DB_PATH = os.path.join('database', 'attendance.db')
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

def migrate():
    print("🚀 Starting Database Migration for Subject Deletion Flux...")
    
    # 1. TIMETABLE
    print("Migrating timetable...")
    cursor.execute("ALTER TABLE timetable RENAME TO timetable_old")
    cursor.execute('''
        CREATE TABLE timetable (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id    INTEGER NOT NULL,
            subject_id  INTEGER NOT NULL,
            day_of_week TEXT NOT NULL,
            period_no   INTEGER NOT NULL,
            FOREIGN KEY(class_id)   REFERENCES classes(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        )
    ''')
    cursor.execute("INSERT INTO timetable SELECT * FROM timetable_old")
    cursor.execute("DROP TABLE timetable_old")

    # 2. MARKS
    print("Migrating marks...")
    cursor.execute("ALTER TABLE marks RENAME TO marks_old")
    cursor.execute('''
        CREATE TABLE marks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            exam_id     INTEGER NOT NULL,
            student_id  INTEGER NOT NULL,
            subject_id  INTEGER NOT NULL,
            marks_obtained REAL,
            max_marks   REAL DEFAULT 100,
            remarks     TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(exam_id)   REFERENCES exams(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
            UNIQUE(exam_id, student_id, subject_id)
        )
    ''')
    cursor.execute("INSERT INTO marks SELECT * FROM marks_old")
    cursor.execute("DROP TABLE marks_old")

    # 3. STUDENT_ATTENDANCE
    # Even if it has it, let's be sure and standardize it.
    print("Migrating student_attendance...")
    cursor.execute("ALTER TABLE student_attendance RENAME TO student_attendance_old")
    cursor.execute('''
        CREATE TABLE student_attendance (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id  INTEGER NOT NULL,
            class_id    INTEGER NOT NULL,
            subject_id  INTEGER,
            date        TEXT NOT NULL,
            period_no   INTEGER DEFAULT 0,
            status      TEXT NOT NULL CHECK(status IN ('present','absent','late','leave','excused')),
            marked_by   INTEGER NOT NULL,
            remarks     TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(class_id)   REFERENCES classes(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
            FOREIGN KEY(marked_by)  REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(student_id, date, period_no, subject_id)
        )
    ''')
    # Use column names to be safe during copy
    cursor.execute('''
        INSERT INTO student_attendance 
        (id, student_id, class_id, subject_id, date, period_no, status, marked_by, remarks, created_at, updated_at)
        SELECT id, student_id, class_id, subject_id, date, period_no, status, marked_by, remarks, created_at, updated_at
        FROM student_attendance_old
    ''')
    cursor.execute("DROP TABLE student_attendance_old")

    conn.commit()
    print("✅ Migration completed successfully!")

try:
    migrate()
except Exception as e:
    print(f"❌ Migration failed: {e}")
    conn.rollback()
finally:
    conn.close()
