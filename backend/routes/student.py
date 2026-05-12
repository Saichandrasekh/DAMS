from flask import Blueprint, render_template, request, session, jsonify
from database.db import get_db
from middleware.auth import login_required
import datetime

student_bp = Blueprint('student', __name__, url_prefix='/student')

def user_id():
    return session.get('user_id')

@student_bp.route('/dashboard')
@login_required(roles=['student'])
def dashboard():
    uid = user_id()
    db = get_db()
    today = datetime.date.today().isoformat()

    info = db.execute('''
        SELECT u.*, c.name as class_name, c.section, sc.roll_no, sc.class_id, s.name as school_name
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
    if overall['total'] > 0:
        overall_pct = round(100 * overall['present'] / overall['total'], 1)

    # Day name for timetable
    day_name = datetime.datetime.now().strftime('%A')
    schedule = db.execute('''
        SELECT t.period_no, s.name as subject_name, ts.name as teacher_name
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN users ts ON s.teacher_id = ts.id
        WHERE t.class_id = ? AND t.day_of_week = ?
        ORDER BY t.period_no
    ''', (info['class_id'], day_name)).fetchall() if info and info['class_id'] else []

    db.close()
    return render_template('student/dashboard.html',
                           info=info,
                           subject_stats=subject_stats,
                           recent=recent,
                           overall_pct=overall_pct,
                           schedule=schedule,
                           day_name=day_name,
                           today=today)

@student_bp.route('/attendance')
@login_required(roles=['student'])
def attendance():
    uid = user_id()
    month = request.args.get('month', datetime.date.today().strftime('%Y-%m'))
    subject_id = request.args.get('subject_id', '')
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
    return render_template('student/attendance.html',
                           records=records, subjects=subjects,
                           month=month, subject_id=subject_id)

@student_bp.route('/attendance/data')
@login_required(roles=['student'])
def attendance_data():
    uid = user_id()
    from_date = request.args.get('from_date', (datetime.date.today() - datetime.timedelta(days=30)).isoformat())
    to_date = request.args.get('to_date', datetime.date.today().isoformat())
    db = get_db()
    records = db.execute('''
        SELECT date, status, COUNT(*) as count
        FROM student_attendance
        WHERE student_id=? AND date BETWEEN ? AND ?
        GROUP BY date, status ORDER BY date
    ''', (uid, from_date, to_date)).fetchall()
    db.close()
    return jsonify([dict(r) for r in records])
@student_bp.route('/report-card')
@login_required(roles=['student'])
def report_card():
    uid = user_id()
    db = get_db()
    
    # Fetch all published exams for this student's school
    exams = db.execute('''
        SELECT e.* 
        FROM exams e
        JOIN users u ON e.school_id = u.school_id
        WHERE u.id=? AND e.is_published=1
        ORDER BY e.exam_date DESC
    ''', (uid,)).fetchall()
    
    # Process results for each exam
    results = {}
    for exam in exams:
        marks = db.execute('''
            SELECT m.*, s.name as subject_name
            FROM marks m
            JOIN subjects s ON m.subject_id = s.id
            WHERE m.student_id=? AND m.exam_id=?
        ''', (uid, exam['id'])).fetchall()
        results[exam['id']] = marks
        
    db.close()
    return render_template('student/report_card.html', exams=exams, results=results)

@student_bp.route('/timetable')
@login_required(roles=['student'])
def timetable():
    uid = user_id()
    db = get_db()
    
    # Get student info (for class_id)
    info = db.execute('''
        SELECT sc.class_id, c.name as class_name, c.section
        FROM student_classes sc
        JOIN classes c ON sc.class_id = c.id
        WHERE sc.student_id = ?
    ''', (uid,)).fetchone()
    
    if not info:
        db.close()
        return "Class information not found", 404
        
    # Get school settings (periods)
    school = db.execute('''
        SELECT periods_per_day FROM schools 
        WHERE id = (SELECT school_id FROM users WHERE id=?)
    ''', (uid,)).fetchone()
    
    # Get weekly timetable
    records = db.execute('''
        SELECT t.*, s.name as subject_name, ts.name as teacher_name
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN users ts ON s.teacher_id = ts.id
        WHERE t.class_id = ?
    ''', (info['class_id'],)).fetchall()
    
    # Map to {day: {period: data}}
    data = {}
    for r in records:
        key = f"{r['day_of_week']}-{r['period_no']}"
        data[key] = r
        
    db.close()
    return render_template('student/timetable.html', 
                           info=info, 
                           periods=school['periods_per_day'], 
                           data=data)
