import datetime
from flask import Blueprint, request, jsonify
from database.db import get_db
from middleware.auth import login_required, log_action

api_teacher_bp = Blueprint('api_teacher', __name__, url_prefix='/api/v1/teacher')

ROLES = ['teacher']


def _row(r):
    return dict(r) if r is not None else None


def _rows(rs):
    return [dict(r) for r in rs]


def _sid():
    return request.user['school_id']


def _uid():
    return request.user['user_id']


@api_teacher_bp.route('/dashboard', methods=['GET'])
@login_required(roles=ROLES)
def dashboard():
    sid = _sid()
    uid = _uid()
    today = datetime.date.today().isoformat()
    day_name = datetime.date.today().strftime('%A')
    db = get_db()

    my_classes = db.execute('''
        SELECT DISTINCT c.id, c.name, c.section, s.id as subject_id, s.name as subject_name
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
        ORDER BY c.name, c.section
    ''', (uid, sid)).fetchall()

    today_summary = db.execute('''
        SELECT
            SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN sa.status='absent' THEN 1 ELSE 0 END) as absent,
            COUNT(DISTINCT sa.student_id) as total
        FROM student_attendance sa
        JOIN subjects s ON sa.subject_id=s.id
        WHERE s.teacher_id=? AND sa.date=?
    ''', (uid, today)).fetchone()

    my_schedule = db.execute('''
        SELECT t.period_no, s.name as subject_name, c.name as class_name, c.section
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        JOIN classes c ON t.class_id = c.id
        WHERE s.teacher_id = ? AND t.day_of_week = ?
        ORDER BY t.period_no
    ''', (uid, day_name)).fetchall()

    db.close()
    return jsonify({
        'my_classes': _rows(my_classes),
        'today_summary': _row(today_summary),
        'my_schedule': _rows(my_schedule),
        'today': today,
        'day_name': day_name,
    })


@api_teacher_bp.route('/my-classes', methods=['GET'])
@login_required(roles=ROLES)
def my_classes():
    sid = _sid()
    uid = _uid()
    db = get_db()
    classes = db.execute('''
        SELECT c.id, c.name, c.section, c.academic_year, s.name as subject_name, s.id as subject_id,
               (SELECT COUNT(*) FROM student_classes sc WHERE sc.class_id=c.id) as student_count
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
        ORDER BY c.name, c.section
    ''', (uid, sid)).fetchall()
    db.close()
    return jsonify({'classes': _rows(classes)})


@api_teacher_bp.route('/teaching-assignments', methods=['GET'])
@login_required(roles=ROLES)
def teaching_assignments():
    sid = _sid()
    uid = _uid()
    db = get_db()
    rows = db.execute('''
        SELECT DISTINCT c.id as class_id, c.name as class_name, c.section,
               s.id as subject_id, s.name as subject_name
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
        ORDER BY c.name, c.section
    ''', (uid, sid)).fetchall()
    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    db.close()
    return jsonify({
        'assignments': _rows(rows),
        'periods_per_day': (school['periods_per_day'] if school else 8) or 8,
    })


@api_teacher_bp.route('/attendance/students', methods=['GET'])
@login_required(roles=ROLES)
def attendance_students():
    class_id = request.args.get('class_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    date = request.args.get('date') or datetime.date.today().isoformat()
    period_no = request.args.get('period', default=0, type=int)
    if not class_id or not subject_id:
        return jsonify({'error': 'class_id and subject_id required'}), 400
    db = get_db()
    students = db.execute('''
        SELECT u.id, u.name, sc.roll_no,
               COALESCE(sa.status, '') as status,
               COALESCE(sa.remarks, '') as remarks
        FROM student_classes sc
        JOIN users u ON sc.student_id = u.id
        LEFT JOIN student_attendance sa ON (sa.student_id=u.id AND sa.class_id=? AND sa.subject_id=? AND sa.date=? AND sa.period_no=?)
        WHERE sc.class_id=? AND u.is_active=1
        ORDER BY sc.roll_no, u.name
    ''', (class_id, subject_id, date, period_no, class_id)).fetchall()
    db.close()
    return jsonify({'students': _rows(students)})


@api_teacher_bp.route('/attendance/mark', methods=['POST'])
@login_required(roles=ROLES)
def mark_attendance():
    sid = _sid()
    uid = _uid()
    data = request.get_json(silent=True) or {}
    class_id = data.get('class_id')
    subject_id = data.get('subject_id')
    date = data.get('date')
    period_no = data.get('period_no', 0)
    records = data.get('records', [])
    if not all([class_id, subject_id, date]):
        return jsonify({'error': 'class_id, subject_id, date required'}), 400

    db = get_db()
    try:
        for rec in records:
            db.execute('''
                INSERT OR REPLACE INTO student_attendance
                (student_id, class_id, subject_id, date, period_no, status, marked_by, remarks)
                VALUES (?,?,?,?,?,?,?,?)
            ''', (rec['student_id'], class_id, subject_id, date, period_no,
                  rec['status'], uid, rec.get('remarks', '')))
        db.commit()
        log_action(sid, uid, 'MARK_ATTENDANCE', f"Class:{class_id} Subject:{subject_id} Date:{date} (api)")
        return jsonify({'message': f'{len(records)} records saved'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()


@api_teacher_bp.route('/attendance-report', methods=['GET'])
@login_required(roles=ROLES)
def attendance_report():
    sid = _sid()
    uid = _uid()
    class_id = request.args.get('class_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    from_date = request.args.get('from_date') or (datetime.date.today() - datetime.timedelta(days=30)).isoformat()
    to_date = request.args.get('to_date') or datetime.date.today().isoformat()

    db = get_db()
    classes = db.execute('''
        SELECT DISTINCT c.id, c.name, c.section, s.id as subject_id, s.name as subject_name
        FROM subjects s JOIN classes c ON s.class_id=c.id
        WHERE s.teacher_id=? AND c.school_id=?
    ''', (uid, sid)).fetchall()

    report = []
    if class_id and subject_id:
        report = db.execute('''
            SELECT u.name, u.id as student_id, u.is_active, sc.roll_no,
                COUNT(sa.id) as total_classes,
                SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN sa.status='absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN sa.status='late' THEN 1 ELSE 0 END) as late,
                ROUND(100.0 * SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) / NULLIF(COUNT(sa.id), 0), 1) as percentage
            FROM student_classes sc
            JOIN users u ON sc.student_id=u.id
            LEFT JOIN student_attendance sa ON (sa.student_id=u.id AND sa.class_id=? AND sa.subject_id=? AND sa.date BETWEEN ? AND ?)
            WHERE sc.class_id=?
            GROUP BY u.id ORDER BY sc.roll_no, u.name
        ''', (class_id, subject_id, from_date, to_date, class_id)).fetchall()
    db.close()
    return jsonify({
        'classes': _rows(classes),
        'report': _rows(report),
        'filters': {'class_id': class_id, 'subject_id': subject_id, 'from_date': from_date, 'to_date': to_date},
    })


@api_teacher_bp.route('/staff-checkin', methods=['POST'])
@login_required(roles=ROLES)
def staff_checkin():
    sid = _sid()
    uid = _uid()
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


@api_teacher_bp.route('/marks/exams', methods=['GET'])
@login_required(roles=ROLES)
def marks_exams():
    sid = _sid()
    db = get_db()
    exams = db.execute("SELECT * FROM exams WHERE school_id=? ORDER BY created_at DESC", (sid,)).fetchall()
    db.close()
    return jsonify({'exams': _rows(exams)})


@api_teacher_bp.route('/marks/students', methods=['GET'])
@login_required(roles=ROLES)
def marks_students():
    class_id = request.args.get('class_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    exam_id = request.args.get('exam_id', type=int)
    if not all([class_id, subject_id, exam_id]):
        return jsonify({'error': 'class_id, subject_id, exam_id required'}), 400
    db = get_db()
    students = db.execute('''
        SELECT u.id, u.name, sc.roll_no,
               COALESCE(m.marks_obtained, '') as marks,
               COALESCE(m.remarks, '') as remarks
        FROM student_classes sc
        JOIN users u ON sc.student_id = u.id
        LEFT JOIN marks m ON (m.student_id=u.id AND m.exam_id=? AND m.subject_id=?)
        WHERE sc.class_id=? AND u.is_active=1
        ORDER BY sc.roll_no, u.name
    ''', (exam_id, subject_id, class_id)).fetchall()
    db.close()
    return jsonify({'students': _rows(students)})


@api_teacher_bp.route('/marks', methods=['POST'])
@login_required(roles=ROLES)
def save_marks():
    sid = _sid()
    uid = _uid()
    data = request.get_json(silent=True) or {}
    exam_id = data.get('exam_id')
    subject_id = data.get('subject_id')
    records = data.get('records', [])
    if not all([exam_id, subject_id]):
        return jsonify({'error': 'exam_id and subject_id required'}), 400

    db = get_db()
    try:
        for rec in records:
            db.execute('''
                INSERT OR REPLACE INTO marks (school_id, exam_id, student_id, subject_id, marks_obtained, remarks)
                VALUES (?,?,?,?,?,?)
            ''', (sid, exam_id, rec['student_id'], subject_id, rec.get('marks'), rec.get('remarks', '')))
        db.commit()
        log_action(sid, uid, 'ENTER_MARKS', f"Exam:{exam_id} Subject:{subject_id} (api)")
        return jsonify({'message': f'Marks for {len(records)} students saved'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()


@api_teacher_bp.route('/timetable', methods=['GET'])
@login_required(roles=ROLES)
def teacher_timetable():
    sid = _sid()
    uid = _uid()
    db = get_db()
    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    records = db.execute('''
        SELECT t.day_of_week, t.period_no, s.name as subject_name, c.name as class_name, c.section
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        JOIN classes c ON t.class_id = c.id
        WHERE s.teacher_id = ?
    ''', (uid,)).fetchall()
    data = {}
    for r in records:
        data[f"{r['day_of_week']}-{r['period_no']}"] = {
            'subject_name': r['subject_name'],
            'class_name': r['class_name'],
            'section': r['section'],
        }
    db.close()
    return jsonify({'periods': school['periods_per_day'] if school else 8, 'data': data})
