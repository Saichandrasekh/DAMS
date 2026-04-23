from flask import Blueprint, render_template, request, session, jsonify, flash, redirect, url_for
from database.db import get_db
from middleware.auth import login_required, log_action
import datetime

teacher_bp = Blueprint('teacher', __name__, url_prefix='/teacher')

def school_id():
    return session.get('school_id')

def user_id():
    return session.get('user_id')

@teacher_bp.route('/dashboard')
@login_required(roles=['teacher'])
def dashboard():
    sid = school_id()
    uid = user_id()
    today = datetime.date.today().isoformat()
    day_name = datetime.date.today().strftime('%A')
    db = get_db()

    my_classes = db.execute('''
        SELECT DISTINCT c.*, s.name as subject_name, s.id as subject_id
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
        ORDER BY c.name, c.section
    ''', (uid, sid)).fetchall()

    today_summary = db.execute('''
        SELECT
            COUNT(DISTINCT sa.student_id) FILTER(WHERE sa.status='present') as present,
            COUNT(DISTINCT sa.student_id) FILTER(WHERE sa.status='absent') as absent,
            COUNT(DISTINCT sa.student_id) as total
        FROM student_attendance sa
        JOIN classes c ON sa.class_id=c.id
        JOIN subjects s ON sa.subject_id=s.id
        WHERE s.teacher_id=? AND sa.date=?
    ''', (uid, today)).fetchone()

    # Fetch today's schedule from timetable
    my_schedule = db.execute('''
        SELECT t.period_no, s.name as subject_name, c.name as class_name, c.section
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        JOIN classes c ON t.class_id = c.id
        WHERE s.teacher_id = ? AND t.day_of_week = ?
        ORDER BY t.period_no
    ''', (uid, day_name)).fetchall()

    db.close()
    return render_template('teacher/dashboard.html',
                           my_classes=my_classes,
                           today_summary=today_summary,
                           my_schedule=my_schedule,
                           today=today,
                           day_name=day_name)

@teacher_bp.route('/mark-attendance', methods=['GET', 'POST'])
@login_required(roles=['teacher'])
def mark_attendance():
    sid = school_id()
    uid = user_id()
    db = get_db()

    classes = db.execute('''
        SELECT DISTINCT c.id, c.name, c.section, s.id as subject_id, s.name as subject_name
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
        ORDER BY c.name, c.section
    ''', (uid, sid)).fetchall()

    if request.method == 'POST':
        data = request.json
        class_id = data.get('class_id')
        subject_id = data.get('subject_id')
        date = data.get('date')
        period_no = data.get('period_no', 0)
        records = data.get('records', [])  # [{student_id, status, remarks}]

        try:
            for rec in records:
                db.execute('''
                    INSERT OR REPLACE INTO student_attendance
                    (student_id, class_id, subject_id, date, period_no, status, marked_by, remarks)
                    VALUES (?,?,?,?,?,?,?,?)
                ''', (rec['student_id'], class_id, subject_id, date, period_no,
                      rec['status'], uid, rec.get('remarks', '')))
            db.commit()
            log_action(sid, uid, 'MARK_ATTENDANCE', f"Class:{class_id} Subject:{subject_id} Date:{date}")
            db.close()
            return jsonify({'message': f'{len(records)} records saved'})
        except Exception as e:
            db.close()
            return jsonify({'error': str(e)}), 400

    db.close()
    return render_template('teacher/mark_attendance.html', classes=classes)

@teacher_bp.route('/get-students/<int:class_id>/<int:subject_id>')
@login_required(roles=['teacher'])
def get_students(class_id, subject_id):
    date = request.args.get('date', datetime.date.today().isoformat())
    period_no = request.args.get('period', 0)
    db = get_db()
    students = db.execute('''
        SELECT u.id, u.name, u.photo, u.is_active,
               COALESCE(sa.status, 'present') as status,
               sa.remarks
        FROM student_classes sc
        JOIN users u ON sc.student_id = u.id
        LEFT JOIN student_attendance sa ON (sa.student_id=u.id AND sa.class_id=? AND sa.subject_id=? AND sa.date=? AND sa.period_no=?)
        WHERE sc.class_id=?
        ORDER BY sc.roll_no, u.name
    ''', (class_id, subject_id, date, period_no, class_id)).fetchall()
    db.close()
    return jsonify([dict(s) for s in students])

@teacher_bp.route('/my-classes')
@login_required(roles=['teacher'])
def my_classes():
    sid = school_id()
    uid = user_id()
    db = get_db()
    classes = db.execute('''
        SELECT c.*, s.name as subject_name, s.id as subject_id,
               (SELECT COUNT(*) FROM student_classes sc WHERE sc.class_id=c.id) as student_count
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
        ORDER BY c.name, c.section
    ''', (uid, sid)).fetchall()
    db.close()
    return render_template('teacher/my_classes.html', classes=classes)

@teacher_bp.route('/attendance-report')
@login_required(roles=['teacher'])
def attendance_report():
    sid = school_id()
    uid = user_id()
    class_id = request.args.get('class_id')
    subject_id = request.args.get('subject_id')
    from_date = request.args.get('from_date', (datetime.date.today() - datetime.timedelta(days=30)).isoformat())
    to_date = request.args.get('to_date', datetime.date.today().isoformat())

    db = get_db()
    classes = db.execute('''
        SELECT DISTINCT c.id, c.name, c.section, s.id as subject_id, s.name as subject_name
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
    ''', (uid, sid)).fetchall()

    report = []
    if class_id and subject_id:
        report = db.execute('''
            SELECT u.name, u.id as student_id, u.is_active,
                COUNT(sa.id) as total_classes,
                SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN sa.status='absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN sa.status='late' THEN 1 ELSE 0 END) as late,
                ROUND(100.0 * SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) / NULLIF(COUNT(sa.id), 0), 1) as percentage
            FROM student_classes sc
            JOIN users u ON sc.student_id=u.id
            LEFT JOIN student_attendance sa ON (sa.student_id=u.id AND sa.class_id=? AND sa.subject_id=? AND sa.date BETWEEN ? AND ?)
            WHERE sc.class_id=?
            GROUP BY u.id ORDER BY u.name
        ''', (class_id, subject_id, from_date, to_date, class_id)).fetchall()

    db.close()
    return render_template('teacher/attendance_report.html',
                           classes=classes, report=report,
                           class_id=class_id, subject_id=subject_id,
                           from_date=from_date, to_date=to_date)

@teacher_bp.route('/staff-checkin', methods=['POST'])
@login_required(roles=['teacher'])
def staff_checkin():
    sid = school_id()
    uid = user_id()
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now().strftime('%H:%M')
    db = get_db()
    existing = db.execute("SELECT * FROM staff_attendance WHERE staff_id=? AND date=?", (uid, today)).fetchone()
    if existing:
        db.execute("UPDATE staff_attendance SET check_out=?, status='present' WHERE staff_id=? AND date=?", (now, uid, today))
    else:
        db.execute("INSERT INTO staff_attendance (staff_id, school_id, date, check_in, status, marked_by) VALUES (?,?,?,?,?,?)",
                   (uid, sid, today, now, 'present', uid))
    db.commit()
    db.close()
    return jsonify({'message': 'Check-in recorded', 'time': now})
@teacher_bp.route('/marks-entry', methods=['GET', 'POST'])
@login_required(roles=['teacher'])
def marks_entry():
    sid = school_id()
    uid = user_id()
    db = get_db()

    # Fetch classes and subjects assigned to this teacher
    classes = db.execute('''
        SELECT DISTINCT c.id, c.name, c.section, s.id as subject_id, s.name as subject_name
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
        ORDER BY c.name, c.section
    ''', (uid, sid)).fetchall()

    # Fetch current exams for this school
    exams = db.execute("SELECT * FROM exams WHERE school_id=? ORDER BY created_at DESC", (sid,)).fetchall()

    if request.method == 'POST':
        data = request.json
        exam_id = data.get('exam_id')
        subject_id = data.get('subject_id')
        records = data.get('records', []) # [{student_id, marks, remarks}]

        try:
            for rec in records:
                db.execute('''
                    INSERT OR REPLACE INTO marks (school_id, exam_id, student_id, subject_id, marks_obtained, remarks)
                    VALUES (?,?,?,?,?,?)
                ''', (sid, exam_id, rec['student_id'], subject_id, rec['marks'], rec.get('remarks', '')))
            db.commit()
            log_action(sid, uid, 'ENTER_MARKS', f"Exam:{exam_id} Subject:{subject_id}")
            db.close()
            return jsonify({'message': f'Marks for {len(records)} students saved successfully'})
        except Exception as e:
            db.close()
            return jsonify({'error': str(e)}), 400

    db.close()
    return render_template('teacher/marks_entry.html', classes=classes, exams=exams)

@teacher_bp.route('/get-exam-students/<int:class_id>/<int:subject_id>/<int:exam_id>')
@login_required(roles=['teacher'])
def get_exam_students(class_id, subject_id, exam_id):
    db = get_db()
    # Fetch students in the class and join with existing marks if any
    students = db.execute('''
        SELECT u.id, u.name, u.photo, sc.roll_no,
               COALESCE(m.marks_obtained, '') as marks,
               COALESCE(m.remarks, '') as remarks
        FROM student_classes sc
        JOIN users u ON sc.student_id = u.id
        LEFT JOIN marks m ON (m.student_id=u.id AND m.exam_id=? AND m.subject_id=?)
        WHERE sc.class_id=? AND u.is_active=1
        ORDER BY sc.roll_no, u.name
    ''', (exam_id, subject_id, class_id)).fetchall()
    db.close()
    return jsonify([dict(s) for s in students])

@teacher_bp.route('/timetable')
@login_required(roles=['teacher'])
def timetable():
    uid = user_id()
    sid = school_id()
    db = get_db()
    
    # Get school settings (periods)
    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    
    # Get teacher's weekly timetable
    records = db.execute('''
        SELECT t.*, s.name as subject_name, c.name as class_name, c.section
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        JOIN classes c ON t.class_id = c.id
        WHERE s.teacher_id = ?
    ''', (uid,)).fetchall()
    
    # Map to {day: {period: data}}
    data = {}
    for r in records:
        key = f"{r['day_of_week']}-{r['period_no']}"
        data[key] = r
        
    db.close()
    return render_template('teacher/timetable.html', 
                           periods=school['periods_per_day'], 
                           data=data)
