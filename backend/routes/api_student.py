import datetime
from flask import Blueprint, request, jsonify
from database.db import get_db
from middleware.auth import login_required

api_student_bp = Blueprint('api_student', __name__, url_prefix='/api/v1/student')

ROLES = ['student']


def _row(r):
    return dict(r) if r is not None else None


def _rows(rs):
    return [dict(r) for r in rs]


def _uid():
    return request.user['user_id']


@api_student_bp.route('/dashboard', methods=['GET'])
@login_required(roles=ROLES)
def dashboard():
    uid = _uid()
    db = get_db()
    today = datetime.date.today().isoformat()

    info = db.execute('''
        SELECT u.id, u.name, u.email, u.phone, u.gender, u.dob,
               c.name as class_name, c.section, sc.roll_no, sc.class_id,
               s.name as school_name, s.logo as school_logo
        FROM users u
        LEFT JOIN student_classes sc ON sc.student_id=u.id
        LEFT JOIN classes c ON c.id=sc.class_id
        LEFT JOIN schools s ON s.id=u.school_id
        WHERE u.id=?
    ''', (uid,)).fetchone()

    subject_stats = db.execute('''
        SELECT sub.name as subject_name,
               COUNT(sa.id) as total,
               SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) as present,
               ROUND(100.0 * SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) / MAX(COUNT(sa.id),1), 1) as pct
        FROM subjects sub
        JOIN student_classes sc ON sc.class_id=sub.class_id
        LEFT JOIN student_attendance sa ON (sa.student_id=? AND sa.subject_id=sub.id)
        WHERE sc.student_id=?
        GROUP BY sub.id ORDER BY sub.name
    ''', (uid, uid)).fetchall()

    recent = db.execute('''
        SELECT sa.date, sa.status, sub.name as subject_name, sa.period_no
        FROM student_attendance sa
        LEFT JOIN subjects sub ON sub.id=sa.subject_id
        WHERE sa.student_id=?
        ORDER BY sa.date DESC, sa.period_no DESC LIMIT 30
    ''', (uid,)).fetchall()

    overall = db.execute('''
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present
        FROM student_attendance WHERE student_id=?
    ''', (uid,)).fetchone()
    overall_pct = 0
    if overall and overall['total']:
        overall_pct = round(100 * overall['present'] / overall['total'], 1)

    day_name = datetime.datetime.now().strftime('%A')
    schedule = []
    if info and info['class_id']:
        schedule = db.execute('''
            SELECT t.period_no, s.name as subject_name, ts.name as teacher_name
            FROM timetable t
            JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN users ts ON s.teacher_id = ts.id
            WHERE t.class_id = ? AND t.day_of_week = ?
            ORDER BY t.period_no
        ''', (info['class_id'], day_name)).fetchall()

    db.close()
    return jsonify({
        'info': _row(info),
        'subject_stats': _rows(subject_stats),
        'recent': _rows(recent),
        'overall_pct': overall_pct,
        'schedule': _rows(schedule),
        'day_name': day_name,
        'today': today,
    })


@api_student_bp.route('/attendance', methods=['GET'])
@login_required(roles=ROLES)
def attendance():
    uid = _uid()
    month = request.args.get('month') or datetime.date.today().strftime('%Y-%m')
    subject_id = request.args.get('subject_id', type=int)
    db = get_db()

    subjects = db.execute('''
        SELECT DISTINCT sub.id, sub.name
        FROM subjects sub
        JOIN student_classes sc ON sc.class_id=sub.class_id
        WHERE sc.student_id=?
    ''', (uid,)).fetchall()

    query = '''
        SELECT sa.date, sa.status, sa.period_no, sub.name as subject_name
        FROM student_attendance sa
        LEFT JOIN subjects sub ON sub.id=sa.subject_id
        WHERE sa.student_id=? AND sa.date LIKE ?
    '''
    params = [uid, f'{month}%']
    if subject_id:
        query += ' AND sa.subject_id=?'
        params.append(subject_id)
    query += ' ORDER BY sa.date, sa.period_no'

    records = db.execute(query, params).fetchall()
    db.close()
    return jsonify({'records': _rows(records), 'subjects': _rows(subjects), 'month': month, 'subject_id': subject_id})


@api_student_bp.route('/report-card', methods=['GET'])
@login_required(roles=ROLES)
def report_card():
    uid = _uid()
    db = get_db()
    exams = db.execute('''
        SELECT e.*
        FROM exams e
        JOIN users u ON e.school_id = u.school_id
        WHERE u.id=? AND e.is_published=1
        ORDER BY e.exam_date DESC
    ''', (uid,)).fetchall()

    results = {}
    for exam in exams:
        marks = db.execute('''
            SELECT m.marks_obtained, m.remarks, s.name as subject_name
            FROM marks m
            JOIN subjects s ON m.subject_id = s.id
            WHERE m.student_id=? AND m.exam_id=?
        ''', (uid, exam['id'])).fetchall()
        results[exam['id']] = _rows(marks)
    db.close()
    return jsonify({'exams': _rows(exams), 'results': results})


@api_student_bp.route('/timetable', methods=['GET'])
@login_required(roles=ROLES)
def timetable():
    uid = _uid()
    db = get_db()
    info = db.execute('''
        SELECT sc.class_id, c.name as class_name, c.section
        FROM student_classes sc
        JOIN classes c ON sc.class_id = c.id
        WHERE sc.student_id = ?
    ''', (uid,)).fetchone()
    if not info:
        db.close()
        return jsonify({'error': 'No class assigned'}), 404
    school = db.execute('''
        SELECT periods_per_day FROM schools
        WHERE id = (SELECT school_id FROM users WHERE id=?)
    ''', (uid,)).fetchone()
    records = db.execute('''
        SELECT t.day_of_week, t.period_no, s.name as subject_name, ts.name as teacher_name
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN users ts ON s.teacher_id = ts.id
        WHERE t.class_id = ?
    ''', (info['class_id'],)).fetchall()
    data = {}
    for r in records:
        data[f"{r['day_of_week']}-{r['period_no']}"] = {
            'subject_name': r['subject_name'],
            'teacher_name': r['teacher_name'],
        }
    db.close()
    return jsonify({
        'info': _row(info),
        'periods': school['periods_per_day'] if school else 8,
        'data': data,
    })
