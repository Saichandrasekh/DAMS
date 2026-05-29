import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'database', 'attendance.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # ─── SCHOOLS (Tenants) ───────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schools (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            code        TEXT UNIQUE NOT NULL,
            address     TEXT,
            phone       TEXT,
            email       TEXT,
            logo        TEXT,
            primary_color TEXT DEFAULT '#4f46e5',
            academic_year TEXT DEFAULT '2025-2026',
            periods_per_day INTEGER DEFAULT 8,
            min_attendance_pct INTEGER DEFAULT 75,
            late_cutoff_time TEXT DEFAULT '09:00',
            allow_qr       INTEGER DEFAULT 1,
            allow_geo      INTEGER DEFAULT 0,
            notify_sms     INTEGER DEFAULT 0,
            notify_email   INTEGER DEFAULT 1,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # ─── USERS ───────────────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            name        TEXT NOT NULL,
            email       TEXT NOT NULL,
            phone       TEXT,
            password    TEXT NOT NULL,
            original_password TEXT,
            role        TEXT NOT NULL CHECK(role IN ('super_admin','admin','teacher','student','parent','principal')),
            gender      TEXT,
            dob         TEXT,
            address     TEXT,
            photo       TEXT,
            is_active   INTEGER DEFAULT 1,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
            UNIQUE(school_id, email)
        )
    ''')

    # ─── CLASSES ─────────────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS classes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            name        TEXT NOT NULL,
            section     TEXT NOT NULL,
            academic_year TEXT,
            class_teacher_id INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(class_teacher_id) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(school_id, name, section, academic_year)
        )
    ''')

    # ─── SUBJECTS ────────────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subjects (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            class_id    INTEGER NOT NULL,
            name        TEXT NOT NULL,
            teacher_id  INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(class_id)  REFERENCES classes(id) ON DELETE CASCADE,
            FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')

    # ─── STUDENT ↔ CLASS MAPPING ─────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_classes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id  INTEGER NOT NULL,
            class_id    INTEGER NOT NULL,
            roll_no     TEXT,
            FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(class_id)   REFERENCES classes(id) ON DELETE CASCADE,
            UNIQUE(student_id, class_id)
        )
    ''')

    # ─── PARENT ↔ STUDENT MAPPING ────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS parent_student (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id   INTEGER NOT NULL,
            student_id  INTEGER NOT NULL,
            relation    TEXT DEFAULT 'Parent',
            FOREIGN KEY(parent_id)  REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(parent_id, student_id)
        )
    ''')

    # ─── HOLIDAYS / CALENDAR ─────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS holidays (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            date        TEXT NOT NULL,
            name        TEXT NOT NULL,
            FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
            UNIQUE(school_id, date)
        )
    ''')

    # ─── TIMETABLE ───────────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timetable (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id    INTEGER NOT NULL,
            subject_id  INTEGER NOT NULL,
            day_of_week TEXT NOT NULL,
            period_no   INTEGER NOT NULL,
            FOREIGN KEY(class_id)   REFERENCES classes(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        )
    ''')

    # ─── STUDENT ATTENDANCE ──────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_attendance (
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

    # ─── STAFF ATTENDANCE ────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS staff_attendance (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id    INTEGER NOT NULL,
            school_id   INTEGER NOT NULL,
            date        TEXT NOT NULL,
            check_in    TEXT,
            check_out   TEXT,
            status      TEXT NOT NULL CHECK(status IN ('present','absent','late','half_day','on_leave')),
            leave_type  TEXT,
            remarks     TEXT,
            marked_by   INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(staff_id)   REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(school_id)  REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(marked_by)  REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(staff_id, date)
        )
    ''')

    # ─── LEAVE REQUESTS ──────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS leave_requests (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            school_id   INTEGER NOT NULL,
            from_date   TEXT NOT NULL,
            to_date     TEXT NOT NULL,
            leave_type  TEXT NOT NULL,
            reason      TEXT,
            status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
            approved_by INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id)    REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(school_id)  REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')

    # ─── AUDIT LOGS ──────────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER,
            user_id     INTEGER,
            action      TEXT NOT NULL,
            details     TEXT,
            ip_address  TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # ─── EXAMS ───────────────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS exams (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            name        TEXT NOT NULL,
            exam_date   TEXT,
            is_published INTEGER DEFAULT 0,
            academic_year TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
        )
    ''')

    # ─── MARKS ───────────────────────────────────────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS marks (
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

    # ─── CLASS PROMOTIONS (audit trail of class changes / year promotions) ──
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS class_promotions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            student_id  INTEGER NOT NULL,
            from_class_id  INTEGER,
            to_class_id    INTEGER,
            from_academic_year TEXT,
            to_academic_year   TEXT,
            old_roll_no TEXT,
            new_roll_no TEXT,
            reason      TEXT,
            promoted_by INTEGER,
            promoted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id)     REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id)    REFERENCES users(id)   ON DELETE CASCADE,
            FOREIGN KEY(from_class_id) REFERENCES classes(id) ON DELETE SET NULL,
            FOREIGN KEY(to_class_id)   REFERENCES classes(id) ON DELETE SET NULL,
            FOREIGN KEY(promoted_by)   REFERENCES users(id)   ON DELETE SET NULL
        )
    ''')

    # ─── DIARY ENTRIES (school announcements + class diary) ─────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS diary_entries (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            scope       TEXT NOT NULL CHECK(scope IN ('school','class')),
            class_id    INTEGER,
            subject_id  INTEGER,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            link        TEXT,
            entry_date  TEXT NOT NULL,
            posted_by   INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id)  REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(class_id)   REFERENCES classes(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
            FOREIGN KEY(posted_by)  REFERENCES users(id) ON DELETE SET NULL
        )
    ''')

    # ─── FEE HEADS (per class / academic year) ───────────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fee_heads (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            class_id    INTEGER NOT NULL,
            academic_year TEXT,
            name        TEXT NOT NULL,
            amount      REAL NOT NULL DEFAULT 0,
            cycle       TEXT NOT NULL DEFAULT 'annual' CHECK(cycle IN ('annual','monthly')),
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(class_id)  REFERENCES classes(id) ON DELETE CASCADE
        )
    ''')

    # ─── FEE PAYMENTS (one row per collection event) ─────────────────────────
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fee_payments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id   INTEGER NOT NULL,
            student_id  INTEGER NOT NULL,
            fee_head_id INTEGER NOT NULL,
            month       TEXT,
            amount      REAL NOT NULL,
            paid_date   TEXT NOT NULL,
            mode        TEXT NOT NULL DEFAULT 'cash' CHECK(mode IN ('cash','upi','cheque','card','bank_transfer','other')),
            receipt_no  TEXT,
            remarks     TEXT,
            collected_by INTEGER,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(school_id)   REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id)  REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(fee_head_id) REFERENCES fee_heads(id) ON DELETE CASCADE,
            FOREIGN KEY(collected_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')

    # ─── INDEXES FOR SCALABILITY (100+ SCHOOLS) ──────────────────────────────
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_school_role ON users(school_id, role)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON student_attendance(class_id, date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON student_attendance(student_id, date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_school ON audit_logs(school_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exams_school ON exams(school_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_marks_exam_subject ON marks(exam_id, subject_id)")
    # One row per (class, day, period) — prevents duplicate timetable entries
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_slot_uniq ON timetable(class_id, day_of_week, period_no)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_promotions_student ON class_promotions(student_id, promoted_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_promotions_school ON class_promotions(school_id, promoted_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fee_heads_school_class ON fee_heads(school_id, class_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id, paid_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fee_payments_school ON fee_payments(school_id, paid_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_fee_payments_head ON fee_payments(fee_head_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_diary_school_date ON diary_entries(school_id, entry_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_diary_class ON diary_entries(class_id, entry_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_diary_posted_by ON diary_entries(posted_by, entry_date)")
    # Roll numbers must be unique within a class (when set — NULLs allowed multiple times)
    cursor.execute('''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_student_classes_class_roll
        ON student_classes(class_id, roll_no)
        WHERE roll_no IS NOT NULL AND roll_no != ''
    ''')

    conn.commit()
    conn.close()
    print("Database initialized successfully.")
