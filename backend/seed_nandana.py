"""Seed Nandana School — full K-12 demo dataset for DAMS.

Creates a complete school with:
  - 1 school (Nandana), 1 principal
  - Classes 6th to 10th, each with sections A & B = 10 classes
  - ~25 students per class = ~250 students
  - ~15 teachers
  - 5 subjects per class (Math, Science, English, Social, Computer)
  - Mon-Sat × 7-period timetable
  - 14 days of past attendance (weekdays only)
  - 1 published Mid-Term exam with marks
  - Fee structure (Tuition monthly + Transport monthly + Exam fee annual + Lab fee annual)
  - Sample fee payments
  - 4 upcoming/past holidays
  - 10 days of staff attendance
  - Class teachers assigned

Idempotent: re-running skips if the Nandana school already exists.
Run:
    .\\venv\\Scripts\\python.exe seed_nandana.py
"""
import os
import random
import sqlite3
import datetime
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from middleware.auth import hash_password  # noqa: E402

random.seed(2024)

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'attendance.db')

# ─── DATA ──────────────────────────────────────────────────────────────────
SCHOOL = {
    'name': 'Nandana School',
    'code': 'NAND',
    'email': 'office@nandana.edu',
    'phone': '+91 866 2234567',
    'address': 'Brindavan Gardens, Vijayawada, Andhra Pradesh 520010',
    'primary_color': '#7c3aed',
    'academic_year': '2025-2026',
    'periods_per_day': 7,
    'min_attendance_pct': 75,
    'late_cutoff_time': '08:45',
}

PRINCIPAL = {
    'name': 'Dr. Lakshmi Devi',
    'email': 'principal@nandana.edu',
    'password': 'nandana123',
    'phone': '+91 9912345670',
    'role': 'admin',
    'gender': 'female',
}

GRADES = ['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade']
SECTIONS = ['A', 'B']

SUBJECTS_BY_GRADE = {
    '6th Grade':  ['Mathematics', 'Science', 'English', 'Social Studies', 'Computer Basics'],
    '7th Grade':  ['Mathematics', 'Science', 'English', 'Social Studies', 'Computer Applications'],
    '8th Grade':  ['Mathematics', 'Science', 'English', 'Social Studies', 'Information Technology'],
    '9th Grade':  ['Mathematics', 'Physics & Chemistry', 'English', 'Social Studies', 'Computer Science'],
    '10th Grade': ['Mathematics', 'Physics & Chemistry', 'English', 'Social Studies', 'Computer Science'],
}

# Fee structure
FEE_HEADS = [
    {'name': 'Tuition Fee',     'cycle': 'monthly', 'amount': 2500.0},
    {'name': 'Transport Fee',   'cycle': 'monthly', 'amount': 1200.0},
    {'name': 'Exam Fee',        'cycle': 'annual',  'amount': 3000.0},
    {'name': 'Lab Fee',         'cycle': 'annual',  'amount': 1500.0},
]

HOLIDAYS = [
    ('2026-01-26', 'Republic Day'),
    ('2026-03-14', 'Holi'),
    ('2026-04-14', 'Dr. Ambedkar Jayanti'),
    ('2026-08-15', 'Independence Day'),
]

FIRST_NAMES_M = [
    'Aarav', 'Aditya', 'Ajay', 'Akhil', 'Anil', 'Arjun', 'Bharath', 'Charan', 'Deepak',
    'Dinesh', 'Eswar', 'Ganesh', 'Gopi', 'Harish', 'Harsha', 'Hemanth', 'Jagadish',
    'Karthik', 'Kiran', 'Krishna', 'Lokesh', 'Madhav', 'Mahesh', 'Manoj', 'Naveen',
    'Nikhil', 'Pavan', 'Phani', 'Praveen', 'Rahul', 'Rajesh', 'Ramesh', 'Ravi',
    'Rohit', 'Sai', 'Santosh', 'Sasank', 'Satish', 'Sharath', 'Sridhar', 'Srinivas',
    'Suresh', 'Surya', 'Tarun', 'Teja', 'Uday', 'Varun', 'Venkatesh', 'Vijay', 'Vinay',
    'Vishal', 'Yashwanth', 'Yogesh',
]
FIRST_NAMES_F = [
    'Aishwarya', 'Akshara', 'Ananya', 'Anjali', 'Anusha', 'Aparna', 'Bhavana', 'Chaitra',
    'Charitha', 'Deepika', 'Divya', 'Gayatri', 'Geetha', 'Greeshma', 'Haritha', 'Indira',
    'Jhansi', 'Kalyani', 'Kavya', 'Keerthi', 'Lakshmi', 'Lalitha', 'Madhuri', 'Manasa',
    'Meghana', 'Mounika', 'Navya', 'Niharika', 'Nikitha', 'Padma', 'Pavani', 'Pooja',
    'Prasanna', 'Priya', 'Ramya', 'Rani', 'Saanvi', 'Sahithi', 'Sanjana', 'Saritha',
    'Shreya', 'Sireesha', 'Sneha', 'Soumya', 'Sravani', 'Sruthi', 'Sunitha', 'Swathi',
    'Tejaswini', 'Uma', 'Vaishnavi', 'Varsha', 'Vijaya', 'Vineetha',
]
LAST_NAMES = [
    'Reddy', 'Naidu', 'Rao', 'Chowdary', 'Gupta', 'Sharma', 'Varma', 'Kumar',
    'Patnaik', 'Sastry', 'Murthy', 'Ramana', 'Krishna', 'Prasad', 'Mohan',
    'Goud', 'Pillai', 'Achari', 'Iyer', 'Shastri', 'Bhaskara', 'Madhav',
    'Yadav', 'Choudhary', 'Mishra', 'Verma', 'Pandey', 'Singh', 'Joshi',
]


def random_phone():
    return '+91 9' + ''.join(str(random.randint(0, 9)) for _ in range(9))


def gen_name(gender):
    first = random.choice(FIRST_NAMES_M if gender == 'male' else FIRST_NAMES_F)
    last = random.choice(LAST_NAMES)
    return f'{first} {last}'


def roll_no(grade_idx, section, roll):
    """e.g. N6A01 = Nandana, Grade 6, Section A, Roll 01."""
    grade_num = grade_idx + 6  # 6th..10th
    return f'N{grade_num}{section}{roll:02d}'


def upsert_user(conn, school_id, name, email, password, role, gender=None, phone=None):
    existing = conn.execute(
        "SELECT id FROM users WHERE school_id=? AND email=?",
        (school_id, email)
    ).fetchone()
    if existing:
        return existing[0]
    cur = conn.execute(
        '''INSERT INTO users (school_id, name, email, phone, password, role, gender, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)''',
        (school_id, name, email, phone, hash_password(password), role, gender)
    )
    return cur.lastrowid


def main():
    if not os.path.exists(DB):
        print('ERROR: database not found at', DB, file=sys.stderr)
        return 1

    conn = sqlite3.connect(DB)

    # Skip if already seeded
    existing_school = conn.execute(
        "SELECT id FROM schools WHERE code=?", (SCHOOL['code'],)
    ).fetchone()
    if existing_school:
        print(f"Nandana already exists (school_id={existing_school[0]}) — nothing to do.")
        print("To re-seed: log in as super-admin and delete the Nandana school first.")
        conn.close()
        return 0

    # ─── 1) School + principal ────────────────────────────────────────────
    cur = conn.execute(
        '''INSERT INTO schools (name, code, email, phone, address, primary_color,
                                academic_year, periods_per_day, min_attendance_pct, late_cutoff_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (SCHOOL['name'], SCHOOL['code'], SCHOOL['email'], SCHOOL['phone'],
         SCHOOL['address'], SCHOOL['primary_color'], SCHOOL['academic_year'],
         SCHOOL['periods_per_day'], SCHOOL['min_attendance_pct'], SCHOOL['late_cutoff_time'])
    )
    school_id = cur.lastrowid
    print(f'OK  created school id={school_id}: {SCHOOL["name"]} ({SCHOOL["code"]})')

    principal_id = upsert_user(conn, school_id,
        PRINCIPAL['name'], PRINCIPAL['email'], PRINCIPAL['password'],
        PRINCIPAL['role'], PRINCIPAL['gender'], PRINCIPAL['phone'])
    print(f'OK  principal id={principal_id}  ({PRINCIPAL["email"]} / {PRINCIPAL["password"]})')

    # ─── 2) Teachers (~15) ────────────────────────────────────────────────
    teachers = []
    # Subject-specialist teachers — 3 per subject area
    SUBJECT_AREAS = ['Maths', 'Science', 'English', 'Social', 'Computer']
    for area in SUBJECT_AREAS:
        for i in range(3):
            gender = random.choice(['male', 'female'])
            full = gen_name(gender)
            tag = full.split()[0].lower()
            email = f"{tag}.{area.lower()}@nandana.edu"
            suffix = 0
            while conn.execute("SELECT 1 FROM users WHERE school_id=? AND email=?",
                               (school_id, email)).fetchone():
                suffix += 1
                email = f"{tag}{suffix}.{area.lower()}@nandana.edu"
            tid = upsert_user(conn, school_id, f"{full}", email, 'teacher123',
                              'teacher', gender, random_phone())
            teachers.append({'id': tid, 'area': area, 'name': full, 'email': email})
    print(f'OK  {len(teachers)} teachers created (password: teacher123)')

    # ─── 3) Classes (10) + class teachers ──────────────────────────────────
    classes = []
    for grade_idx, grade in enumerate(GRADES):
        for section in SECTIONS:
            ct = random.choice(teachers)
            cur = conn.execute(
                '''INSERT INTO classes (school_id, name, section, academic_year, class_teacher_id)
                   VALUES (?, ?, ?, ?, ?)''',
                (school_id, grade, section, SCHOOL['academic_year'], ct['id'])
            )
            classes.append({
                'id': cur.lastrowid, 'name': grade, 'section': section,
                'grade_idx': grade_idx,
            })
    print(f'OK  {len(classes)} classes created (6th-10th × A,B)')

    # ─── 4) Subjects (5 per class) ────────────────────────────────────────
    subjects_by_class = {}
    SUBJECT_TO_AREA = {
        'Mathematics': 'Maths',
        'Science': 'Science',
        'Physics & Chemistry': 'Science',
        'English': 'English',
        'Social Studies': 'Social',
        'Computer Basics': 'Computer',
        'Computer Applications': 'Computer',
        'Information Technology': 'Computer',
        'Computer Science': 'Computer',
    }
    for cls in classes:
        names = SUBJECTS_BY_GRADE[cls['name']]
        cls_subjects = []
        for sub_name in names:
            area = SUBJECT_TO_AREA.get(sub_name, 'Maths')
            pool = [t for t in teachers if t['area'] == area]
            teacher = random.choice(pool) if pool else random.choice(teachers)
            cur = conn.execute(
                "INSERT INTO subjects (school_id, class_id, name, teacher_id) VALUES (?, ?, ?, ?)",
                (school_id, cls['id'], sub_name, teacher['id'])
            )
            cls_subjects.append({'id': cur.lastrowid, 'name': sub_name, 'teacher_id': teacher['id']})
        subjects_by_class[cls['id']] = cls_subjects
    total_subjects = sum(len(v) for v in subjects_by_class.values())
    print(f'OK  {total_subjects} subjects created')

    # ─── 5) Students (~25 per class = ~250) ───────────────────────────────
    students_by_class = {}
    for cls in classes:
        students_in_class = []
        for roll in range(1, 26):
            gender = random.choices(['male', 'female'], weights=[5, 5])[0]
            name = gen_name(gender)
            rno = roll_no(cls['grade_idx'], cls['section'], roll)
            email = f"{rno.lower()}@nandana.edu"
            sid = upsert_user(conn, school_id, name, email, 'student123',
                              'student', gender, random_phone())
            conn.execute(
                "INSERT INTO student_classes (student_id, class_id, roll_no) VALUES (?, ?, ?)",
                (sid, cls['id'], rno)
            )
            students_in_class.append({'id': sid, 'name': name, 'roll_no': rno})
        students_by_class[cls['id']] = students_in_class
    total_students = sum(len(v) for v in students_by_class.values())
    print(f'OK  {total_students} students enrolled (password: student123)')

    # ─── 6) Timetable (Mon-Sat × 7 periods) ───────────────────────────────
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    timetable_rows = 0
    for cls in classes:
        subs = subjects_by_class[cls['id']]
        if not subs:
            continue
        for day in days:
            for period in range(1, SCHOOL['periods_per_day'] + 1):
                sub = subs[(period + days.index(day)) % len(subs)]
                conn.execute(
                    '''INSERT OR REPLACE INTO timetable (class_id, subject_id, day_of_week, period_no)
                       VALUES (?, ?, ?, ?)''',
                    (cls['id'], sub['id'], day, period)
                )
                timetable_rows += 1
    print(f'OK  {timetable_rows} timetable slots filled')

    # ─── 7) Past attendance — 14 weekdays ─────────────────────────────────
    today = datetime.date.today()
    attendance_rows = 0
    for d_offset in range(1, 20):
        if attendance_rows > 0 and d_offset > 14:
            break
        date = today - datetime.timedelta(days=d_offset)
        if date.weekday() == 6:  # Sunday
            continue
        day_name = date.strftime('%A')
        for cls in classes:
            subs = subjects_by_class[cls['id']]
            for period in range(1, SCHOOL['periods_per_day'] + 1):
                sub = subs[(period + days.index(day_name) if day_name in days else 0) % len(subs)]
                for stu in students_by_class[cls['id']]:
                    r = random.random()
                    if r < 0.88:    status = 'present'
                    elif r < 0.96:  status = 'absent'
                    else:           status = 'late'
                    conn.execute(
                        '''INSERT OR REPLACE INTO student_attendance
                           (student_id, class_id, subject_id, date, period_no, status, marked_by)
                           VALUES (?, ?, ?, ?, ?, ?, ?)''',
                        (stu['id'], cls['id'], sub['id'], date.isoformat(),
                         period, status, sub['teacher_id'])
                    )
                    attendance_rows += 1
        if d_offset % 3 == 0:
            conn.commit()
            print(f'    progress: {attendance_rows} attendance rows...')
    print(f'OK  {attendance_rows} attendance records (last 14 weekdays)')

    # ─── 8) Mid-Term exam + marks ─────────────────────────────────────────
    cur = conn.execute(
        '''INSERT INTO exams (school_id, name, exam_date, academic_year, is_published)
           VALUES (?, ?, ?, ?, 1)''',
        (school_id, 'Mid-Term Examination', (today - datetime.timedelta(days=15)).isoformat(),
         SCHOOL['academic_year'])
    )
    exam_id = cur.lastrowid
    marks_rows = 0
    for cls in classes:
        for stu in students_by_class[cls['id']]:
            for sub in subjects_by_class[cls['id']]:
                marks = random.choices(
                    [random.randint(70, 95),
                     random.randint(50, 80),
                     random.randint(30, 60)],
                    weights=[5, 4, 2]
                )[0]
                conn.execute(
                    '''INSERT INTO marks (school_id, exam_id, student_id, subject_id, marks_obtained, max_marks)
                       VALUES (?, ?, ?, ?, ?, 100)''',
                    (school_id, exam_id, stu['id'], sub['id'], marks)
                )
                marks_rows += 1
    print(f'OK  exam created + {marks_rows} marks records')

    # ─── 9) Holidays ──────────────────────────────────────────────────────
    for d, name in HOLIDAYS:
        conn.execute(
            "INSERT OR IGNORE INTO holidays (school_id, date, name) VALUES (?, ?, ?)",
            (school_id, d, name)
        )
    print(f'OK  {len(HOLIDAYS)} holidays added')

    # ─── 10) Fee structure (each head × each class) ───────────────────────
    fee_heads_by_class = {}
    for cls in classes:
        cls_heads = []
        for h in FEE_HEADS:
            cur = conn.execute(
                '''INSERT INTO fee_heads (school_id, class_id, academic_year, name, amount, cycle)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (school_id, cls['id'], SCHOOL['academic_year'],
                 h['name'], h['amount'], h['cycle'])
            )
            cls_heads.append({'id': cur.lastrowid, **h})
        fee_heads_by_class[cls['id']] = cls_heads
    total_fee_heads = sum(len(v) for v in fee_heads_by_class.values())
    print(f'OK  {total_fee_heads} fee heads created')

    # ─── 11) Sample payments — 60% students made at least 1 payment ───────
    payment_rows = 0
    payment_counter = 0
    paid_date = (today - datetime.timedelta(days=10)).isoformat()
    months_in_ay = ['2025-06', '2025-07', '2025-08', '2025-09', '2025-10']
    for cls in classes:
        heads = fee_heads_by_class[cls['id']]
        for stu in students_by_class[cls['id']]:
            if random.random() > 0.6:
                continue  # 40% have unpaid dues for variety
            # Pay annual fees fully (exam + lab)
            for h in heads:
                if h['cycle'] == 'annual' and random.random() < 0.7:
                    payment_counter += 1
                    receipt = f"RC-{school_id}-{paid_date.replace('-', '')}-{payment_counter}"
                    conn.execute(
                        '''INSERT INTO fee_payments
                           (school_id, student_id, fee_head_id, month, amount, paid_date, mode, receipt_no, collected_by)
                           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)''',
                        (school_id, stu['id'], h['id'], h['amount'], paid_date,
                         random.choice(['cash', 'upi', 'bank_transfer']),
                         receipt, principal_id)
                    )
                    payment_rows += 1
                elif h['cycle'] == 'monthly':
                    # Pay first 2-3 months of monthly fees
                    pay_count = random.choice([1, 2, 3])
                    for m in months_in_ay[:pay_count]:
                        payment_counter += 1
                        receipt = f"RC-{school_id}-{paid_date.replace('-', '')}-{payment_counter}"
                        conn.execute(
                            '''INSERT INTO fee_payments
                               (school_id, student_id, fee_head_id, month, amount, paid_date, mode, receipt_no, collected_by)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                            (school_id, stu['id'], h['id'], m, h['amount'], paid_date,
                             random.choice(['cash', 'upi', 'cheque']),
                             receipt, principal_id)
                        )
                        payment_rows += 1
    print(f'OK  {payment_rows} fee payments recorded')

    # ─── 12) Staff attendance — last 10 weekdays ──────────────────────────
    staff_att_rows = 0
    for d_offset in range(1, 15):
        date = today - datetime.timedelta(days=d_offset)
        if date.weekday() == 6:
            continue
        for t in teachers:
            r = random.random()
            if r < 0.85:
                status = 'present'
                check_in = f'{8 + random.randint(0, 0):02d}:{random.randint(30, 55):02d}'
                check_out = f'{16}:{random.randint(0, 30):02d}'
            elif r < 0.92:
                status = 'late'
                check_in = f'09:{random.randint(0, 30):02d}'
                check_out = f'{16}:{random.randint(0, 30):02d}'
            elif r < 0.97:
                status = 'on_leave'
                check_in = None
                check_out = None
            else:
                status = 'absent'
                check_in = None
                check_out = None
            conn.execute(
                '''INSERT OR REPLACE INTO staff_attendance
                   (staff_id, school_id, date, check_in, check_out, status, marked_by)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (t['id'], school_id, date.isoformat(), check_in, check_out, status, principal_id)
            )
            staff_att_rows += 1
        if d_offset >= 10:
            break
    print(f'OK  {staff_att_rows} staff attendance records (last 10 weekdays)')

    conn.commit()
    conn.close()
    print()
    print('=' * 70)
    print(f' {SCHOOL["name"]} seeded successfully!')
    print('=' * 70)
    print(f'  Principal login   :  {PRINCIPAL["email"]} / {PRINCIPAL["password"]}')
    print(f'  Sample teacher    :  any teacher email like aarav.maths@nandana.edu')
    print(f'                       password: teacher123')
    print(f'  Sample student    :  any roll-number email like n6a01@nandana.edu')
    print(f'                       password: student123')
    print('=' * 70)
    return 0


if __name__ == '__main__':
    sys.exit(main())
