"""Seed Sri Mittapalli College of Engineering — full demo dataset.

Creates a complete B.Tech college:
  - 1 school (SMCE), 1 principal
  - 4 branches x 4 years = 16 classes
  - 25 students per class = 400 students with JNTUK-style roll numbers
  - 32 faculty members
  - 5 subjects per class
  - Full weekly timetable
  - 14 days of past attendance
  - 1 published Mid-Term exam with marks

Idempotent: re-running will skip if the SMCE school already exists.
Run with:
    .\\venv\\Scripts\\python.exe seed_smce.py
"""
import os
import random
import sqlite3
import datetime
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from middleware.auth import hash_password  # noqa: E402

random.seed(7741)

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'attendance.db')

# ─── DATA ──────────────────────────────────────────────────────────────────
SCHOOL = {
    'name': 'Sri Mittapalli College of Engineering',
    'code': 'SMCE',
    'email': 'office@smce.edu',
    'phone': '+91 863 2345678',
    'address': 'Tummalapalem, Guntur, Andhra Pradesh 522233',
    'primary_color': '#1d4ed8',
    'academic_year': '2025-2026',
    'periods_per_day': 6,
    'min_attendance_pct': 75,
    'late_cutoff_time': '09:15',
}

PRINCIPAL = {
    'name': 'Dr. Ramesh Mittapalli',
    'email': 'principal@smce.edu',
    'password': 'smce123',
    'phone': '+91 9876543210',
    'role': 'admin',
    'gender': 'male',
}

BRANCHES = [
    {'code': 'CSE',  'name': 'Computer Science & Engineering'},
    {'code': 'ECE',  'name': 'Electronics & Communication Engg.'},
    {'code': 'EEE',  'name': 'Electrical & Electronics Engg.'},
    {'code': 'MECH', 'name': 'Mechanical Engineering'},
]
YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

# Branch + year -> 5 subject names
SUBJECTS = {
    ('CSE', '1st Year'): ['Engineering Mathematics-I', 'Engineering Physics', 'Programming for Problem Solving', 'Engineering Drawing', 'Communication Skills'],
    ('CSE', '2nd Year'): ['Discrete Mathematics', 'Data Structures', 'Digital Logic Design', 'Object Oriented Programming', 'Computer Organization'],
    ('CSE', '3rd Year'): ['Database Management Systems', 'Operating Systems', 'Computer Networks', 'Software Engineering', 'Theory of Computation'],
    ('CSE', '4th Year'): ['Compiler Design', 'Machine Learning', 'Cloud Computing', 'Cyber Security', 'Project Work'],

    ('ECE', '1st Year'): ['Engineering Mathematics-I', 'Engineering Physics', 'Programming for Problem Solving', 'Engineering Drawing', 'Basic Electronics'],
    ('ECE', '2nd Year'): ['Electronic Devices & Circuits', 'Network Theory', 'Signals & Systems', 'Digital Electronics', 'Electromagnetic Fields'],
    ('ECE', '3rd Year'): ['Analog Communications', 'Digital Communications', 'Microprocessors', 'Linear Integrated Circuits', 'VLSI Design'],
    ('ECE', '4th Year'): ['Embedded Systems', 'Wireless Communications', 'Optical Communications', 'Antenna Theory', 'Project Work'],

    ('EEE', '1st Year'): ['Engineering Mathematics-I', 'Engineering Physics', 'Programming for Problem Solving', 'Engineering Drawing', 'Basic Electrical Engg.'],
    ('EEE', '2nd Year'): ['Electrical Circuits', 'Electrical Machines-I', 'Electromagnetic Theory', 'Analog Electronics', 'Measurement Techniques'],
    ('EEE', '3rd Year'): ['Power Systems-I', 'Control Systems', 'Power Electronics', 'Electrical Machines-II', 'Microcontrollers'],
    ('EEE', '4th Year'): ['Switchgear & Protection', 'Renewable Energy Systems', 'Power System Operation', 'Electric Drives', 'Project Work'],

    ('MECH', '1st Year'): ['Engineering Mathematics-I', 'Engineering Physics', 'Programming for Problem Solving', 'Engineering Drawing', 'Workshop Practice'],
    ('MECH', '2nd Year'): ['Engineering Mechanics', 'Thermodynamics', 'Material Science', 'Manufacturing Processes', 'Fluid Mechanics'],
    ('MECH', '3rd Year'): ['Design of Machine Elements', 'Heat Transfer', 'Theory of Machines', 'IC Engines', 'Metrology'],
    ('MECH', '4th Year'): ['Operations Research', 'Refrigeration & Air Conditioning', 'CAD/CAM', 'Industrial Engineering', 'Project Work'],
}

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
    'Bhatt', 'Agarwal', 'Mehta',
]


def random_phone():
    return '+91 9' + ''.join(str(random.randint(0, 9)) for _ in range(9))


def gen_name(gender):
    first = random.choice(FIRST_NAMES_M if gender == 'male' else FIRST_NAMES_F)
    last  = random.choice(LAST_NAMES)
    return f'{first} {last}'


# Branch code -> JNTUK numeric code
BRANCH_NUM = {'CSE': '05', 'ECE': '04', 'EEE': '02', 'MECH': '03'}


def roll_no(year_idx, branch_code, section, roll):
    """JNTUK-style roll: 22B81A0501 (year + collegecode + section + branchcode + roll)."""
    admission_year = 25 - year_idx  # 4th year admitted in 2022 (25-3=22)
    return f'{admission_year:02d}B81{section}{BRANCH_NUM[branch_code]}{roll:02d}'


def upsert_user(conn, school_id, name, email, password, role, gender=None, phone=None):
    """Insert user, return id. If email exists in this school, return existing id."""
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
        print(f"SMCE already exists (school_id={existing_school[0]}) — nothing to do.")
        print("To re-seed, delete the school from Superadmin > Schools first.")
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
    print(f'OK  created school id={school_id}')

    principal_id = upsert_user(conn, school_id,
        PRINCIPAL['name'], PRINCIPAL['email'], PRINCIPAL['password'],
        PRINCIPAL['role'], PRINCIPAL['gender'], PRINCIPAL['phone'])
    print(f'OK  principal id={principal_id}  ({PRINCIPAL["email"]} / {PRINCIPAL["password"]})')

    # ─── 2) Faculty pool ──────────────────────────────────────────────────
    faculty_ids = []
    # 8 faculty per branch = 32 total
    for branch in BRANCHES:
        for i in range(8):
            gender = random.choice(['male', 'male', 'female'])
            full = gen_name(gender)
            tag  = full.split()[0].lower()
            email = f"{tag}.{branch['code'].lower()}@smce.edu"
            # avoid collision
            suffix = 0
            while conn.execute("SELECT 1 FROM users WHERE school_id=? AND email=?",
                               (school_id, email)).fetchone():
                suffix += 1
                email = f"{tag}{suffix}.{branch['code'].lower()}@smce.edu"
            fid = upsert_user(conn, school_id, f"Prof. {full}", email, 'faculty123',
                              'teacher', gender, random_phone())
            faculty_ids.append({'id': fid, 'branch': branch['code'], 'name': f"Prof. {full}", 'email': email})
    print(f'OK  {len(faculty_ids)} faculty created (password: faculty123)')

    # ─── 3) Classes (16) + class-teachers ─────────────────────────────────
    classes = []
    for branch in BRANCHES:
        for year_idx, year in enumerate(YEARS):
            # Pick a class teacher from this branch
            branch_faculty = [f for f in faculty_ids if f['branch'] == branch['code']]
            class_teacher = random.choice(branch_faculty)
            cur = conn.execute(
                '''INSERT INTO classes (school_id, name, section, academic_year, class_teacher_id)
                   VALUES (?, ?, ?, ?, ?)''',
                (school_id, f"{branch['code']} {year}", 'A',
                 SCHOOL['academic_year'], class_teacher['id'])
            )
            class_id = cur.lastrowid
            classes.append({
                'id': class_id, 'branch': branch['code'], 'year': year,
                'year_idx': year_idx, 'section': 'A',
            })
    print(f'OK  {len(classes)} classes created')

    # ─── 4) Subjects (5 per class) ────────────────────────────────────────
    subjects_by_class = {}
    for cls in classes:
        names = SUBJECTS.get((cls['branch'], cls['year']), [])
        cls_subjects = []
        branch_faculty = [f for f in faculty_ids if f['branch'] == cls['branch']]
        for sub_name in names:
            teacher = random.choice(branch_faculty)
            cur = conn.execute(
                "INSERT INTO subjects (school_id, class_id, name, teacher_id) VALUES (?, ?, ?, ?)",
                (school_id, cls['id'], sub_name, teacher['id'])
            )
            cls_subjects.append({'id': cur.lastrowid, 'name': sub_name, 'teacher_id': teacher['id']})
        subjects_by_class[cls['id']] = cls_subjects
    total_subjects = sum(len(v) for v in subjects_by_class.values())
    print(f'OK  {total_subjects} subjects created')

    # ─── 5) Students (25 per class = 400) ─────────────────────────────────
    students_by_class = {}
    for cls in classes:
        students_in_class = []
        for roll in range(1, 26):
            gender = random.choices(['male', 'female'], weights=[6, 4])[0]
            name = gen_name(gender)
            rno  = roll_no(cls['year_idx'], cls['branch'], cls['section'], roll)
            email = f"{rno.lower()}@smce.edu"
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

    # ─── 6) Timetable (Mon–Sat × 6 periods, every class) ──────────────────
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    timetable_rows = 0
    for cls in classes:
        subs = subjects_by_class[cls['id']]
        if not subs:
            continue
        for day in days:
            for period in range(1, SCHOOL['periods_per_day'] + 1):
                # Rotate through subjects so they're spread evenly
                sub = subs[(period + days.index(day)) % len(subs)]
                conn.execute(
                    '''INSERT OR REPLACE INTO timetable (class_id, subject_id, day_of_week, period_no)
                       VALUES (?, ?, ?, ?)''',
                    (cls['id'], sub['id'], day, period)
                )
                timetable_rows += 1
    print(f'OK  {timetable_rows} timetable slots filled')

    # ─── 7) Past attendance — 14 days, weekdays only ──────────────────────
    today = datetime.date.today()
    attendance_rows = 0
    for d_offset in range(1, 15):  # 14 days back
        date = today - datetime.timedelta(days=d_offset)
        if date.weekday() == 6:  # Sunday
            continue
        day_name = date.strftime('%A')
        for cls in classes:
            # which subjects this day?
            day_periods = [(p, s) for p, s in [
                (period, subjects_by_class[cls['id']][(period + days.index(day_name) if day_name in days else 0) % len(subjects_by_class[cls['id']])])
                for period in range(1, SCHOOL['periods_per_day'] + 1)
            ]]
            for period, sub in day_periods:
                for stu in students_by_class[cls['id']]:
                    r = random.random()
                    if r < 0.88:    status = 'present'
                    elif r < 0.97:  status = 'absent'
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
            conn.commit()  # checkpoint
            print(f'    progress: {attendance_rows} attendance rows...')
    print(f'OK  {attendance_rows} attendance records (last 14 days)')

    # ─── 8) Exam + marks ──────────────────────────────────────────────────
    cur = conn.execute(
        '''INSERT INTO exams (school_id, name, exam_date, academic_year, is_published)
           VALUES (?, ?, ?, ?, 1)''',
        (school_id, 'Mid-Term Examination I', (today - datetime.timedelta(days=20)).isoformat(),
         SCHOOL['academic_year'])
    )
    exam_id = cur.lastrowid
    marks_rows = 0
    for cls in classes:
        for stu in students_by_class[cls['id']]:
            for sub in subjects_by_class[cls['id']]:
                marks = random.choices(
                    [random.randint(60, 95),  # good students
                     random.randint(40, 75),  # average
                     random.randint(25, 55)], # struggling
                    weights=[5, 4, 2]
                )[0]
                conn.execute(
                    '''INSERT INTO marks (school_id, exam_id, student_id, subject_id, marks_obtained, max_marks)
                       VALUES (?, ?, ?, ?, ?, 100)''',
                    (school_id, exam_id, stu['id'], sub['id'], marks)
                )
                marks_rows += 1
    print(f'OK  exam created + {marks_rows} marks records')

    conn.commit()
    conn.close()
    print()
    print('=' * 70)
    print(' SMCE seeded successfully!')
    print('=' * 70)
    print(f'  Principal login   :  {PRINCIPAL["email"]} / {PRINCIPAL["password"]}')
    print(f'  Sample faculty    :  use Admin > Credentials > Reset to set passwords')
    print(f'                       or login via Principal account')
    print(f'  Sample student    :  any roll-number email like 22b81a0501@smce.edu')
    print(f'                       password: student123')
    print(f'  Sample faculty    :  emails like aditya.cse@smce.edu / faculty123')
    print('=' * 70)
    return 0


if __name__ == '__main__':
    sys.exit(main())
