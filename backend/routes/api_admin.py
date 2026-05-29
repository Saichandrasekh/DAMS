import csv
import datetime
import io
from flask import Blueprint, request, jsonify
from database.db import get_db
from middleware.auth import login_required, hash_password, log_action

api_admin_bp = Blueprint('api_admin', __name__, url_prefix='/api/v1/admin')

ROLES = ['admin', 'principal']


def _row(r):
    return dict(r) if r is not None else None


def _rows(rs):
    return [dict(r) for r in rs]


def _sid():
    return request.user['school_id']


def _uid():
    return request.user['user_id']


# ─── DASHBOARD ───────────────────────────────────────────────────────────────
@api_admin_bp.route('/dashboard', methods=['GET'])
@login_required(roles=ROLES)
def dashboard():
    sid = _sid()
    db = get_db()
    today = datetime.date.today().isoformat()
    stats = {
        'students': db.execute("SELECT COUNT(*) c FROM users WHERE school_id=? AND role='student' AND is_active=1", (sid,)).fetchone()['c'],
        'teachers': db.execute("SELECT COUNT(*) c FROM users WHERE school_id=? AND role='teacher' AND is_active=1", (sid,)).fetchone()['c'],
        'classes': db.execute("SELECT COUNT(*) c FROM classes WHERE school_id=?", (sid,)).fetchone()['c'],
        'today_present': db.execute("SELECT COUNT(*) c FROM student_attendance WHERE class_id IN (SELECT id FROM classes WHERE school_id=?) AND date=? AND status='present'", (sid, today)).fetchone()['c'],
        'today_absent': db.execute("SELECT COUNT(*) c FROM student_attendance WHERE class_id IN (SELECT id FROM classes WHERE school_id=?) AND date=? AND status='absent'", (sid, today)).fetchone()['c'],
    }
    recent_logs = db.execute('''
        SELECT l.*, u.name as user_name FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.school_id=? ORDER BY l.created_at DESC LIMIT 10
    ''', (sid,)).fetchall()
    school = db.execute("SELECT * FROM schools WHERE id=?", (sid,)).fetchone()
    db.close()
    return jsonify({'stats': stats, 'recent_logs': _rows(recent_logs), 'school': _row(school)})


# ─── STUDENTS ────────────────────────────────────────────────────────────────
@api_admin_bp.route('/students', methods=['GET'])
@login_required(roles=ROLES)
def list_students():
    sid = _sid()
    db = get_db()
    f_class = request.args.get('class_id')
    f_status = request.args.get('status')
    f_date = request.args.get('date')  # optional YYYY-MM-DD

    query = '''
        SELECT u.id, u.name, u.email, u.phone, u.gender, u.dob, u.address, u.is_active,
               c.id as class_id, c.name as class_name, c.section, sc.roll_no
        FROM users u
        LEFT JOIN student_classes sc ON sc.student_id = u.id
        LEFT JOIN classes c ON c.id = sc.class_id
        WHERE u.school_id=? AND u.role='student'
    '''
    params = [sid]
    if f_class:
        query += " AND sc.class_id = ?"
        params.append(f_class)
    if f_status == 'active':
        query += " AND u.is_active = 1"
    elif f_status == 'inactive':
        query += " AND u.is_active = 0"
    query += " ORDER BY c.name, c.section, sc.roll_no, u.name"

    students = [dict(r) for r in db.execute(query, params).fetchall()]

    # If a date is given, attach per-student attendance summary for that date
    if f_date and students:
        ids = [s['id'] for s in students]
        placeholders = ','.join(['?'] * len(ids))
        att_rows = db.execute(f'''
            SELECT student_id,
                   SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
                   SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late,
                   SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent,
                   COUNT(*) AS marked
            FROM student_attendance
            WHERE date=? AND student_id IN ({placeholders})
            GROUP BY student_id
        ''', (f_date, *ids)).fetchall()
        by_id = {r['student_id']: r for r in att_rows}
        for s in students:
            rec = by_id.get(s['id'])
            if not rec or rec['marked'] == 0:
                s['date_status'] = 'not_marked'
                s['date_present'] = 0
                s['date_late'] = 0
                s['date_absent'] = 0
                s['date_marked'] = 0
            else:
                # Best status across periods: present > late > absent
                if rec['present'] > 0:
                    s['date_status'] = 'present'
                elif rec['late'] > 0:
                    s['date_status'] = 'late'
                else:
                    s['date_status'] = 'absent'
                s['date_present'] = rec['present'] or 0
                s['date_late'] = rec['late'] or 0
                s['date_absent'] = rec['absent'] or 0
                s['date_marked'] = rec['marked'] or 0

    classes = db.execute("SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section", (sid,)).fetchall()
    db.close()
    return jsonify({'students': students, 'classes': _rows(classes), 'date': f_date})


@api_admin_bp.route('/students', methods=['POST'])
@login_required(roles=ROLES)
def add_student():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not all([name, email, password]):
        return jsonify({'error': 'name, email, password are required'}), 400

    db = get_db()
    try:
        cursor = db.execute('''
            INSERT INTO users (school_id, name, email, phone, password, original_password, role, gender, dob, address)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(school_id, email) DO UPDATE SET
                name=excluded.name, phone=excluded.phone, password=excluded.password,
                original_password=excluded.original_password, role=excluded.role,
                gender=excluded.gender, dob=excluded.dob, address=excluded.address, is_active=1
        ''', (sid, name, email, data.get('phone'), hash_password(password), None,
              'student', data.get('gender'), data.get('dob'), data.get('address')))
        student_id = cursor.lastrowid or db.execute("SELECT id FROM users WHERE school_id=? AND email=?", (sid, email)).fetchone()['id']
        if data.get('class_id'):
            db.execute("INSERT OR REPLACE INTO student_classes (student_id, class_id, roll_no) VALUES (?,?,?)",
                       (student_id, data['class_id'], data.get('roll_no')))
        db.commit()
        log_action(sid, _uid(), 'ADD_STUDENT', name + ' (api)')
        return jsonify({'id': student_id, 'message': 'Student added'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/students/<int:student_id>', methods=['GET'])
@login_required(roles=ROLES)
def get_student(student_id):
    sid = _sid()
    db = get_db()
    student = db.execute("SELECT * FROM users WHERE id=? AND school_id=? AND role='student'", (student_id, sid)).fetchone()
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404
    current_class = db.execute("SELECT * FROM student_classes WHERE student_id=?", (student_id,)).fetchone()
    classes = db.execute("SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section", (sid,)).fetchall()
    db.close()
    return jsonify({'student': _row(student), 'current_class': _row(current_class), 'classes': _rows(classes)})


@api_admin_bp.route('/students/<int:student_id>/details', methods=['GET'])
@login_required(roles=ROLES)
def student_details(student_id):
    """Full profile view: personal info + class + attendance summary + recent + marks."""
    sid = _sid()
    db = get_db()

    info = db.execute('''
        SELECT u.id, u.name, u.email, u.phone, u.gender, u.dob, u.address, u.is_active, u.created_at,
               c.id as class_id, c.name as class_name, c.section, c.academic_year,
               sc.roll_no
        FROM users u
        LEFT JOIN student_classes sc ON sc.student_id = u.id
        LEFT JOIN classes c ON c.id = sc.class_id
        WHERE u.id=? AND u.school_id=? AND u.role='student'
    ''', (student_id, sid)).fetchone()
    if not info:
        db.close()
        return jsonify({'error': 'Student not found'}), 404

    subject_stats = db.execute('''
        SELECT sub.name as subject_name,
               COUNT(sa.id) as total,
               SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) as present,
               SUM(CASE WHEN sa.status='absent' THEN 1 ELSE 0 END) as absent,
               SUM(CASE WHEN sa.status='late' THEN 1 ELSE 0 END) as late,
               ROUND(100.0 * SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END) / MAX(COUNT(sa.id),1), 1) as pct
        FROM subjects sub
        JOIN student_classes sc ON sc.class_id = sub.class_id
        LEFT JOIN student_attendance sa ON (sa.student_id=? AND sa.subject_id=sub.id)
        WHERE sc.student_id=?
        GROUP BY sub.id ORDER BY sub.name
    ''', (student_id, student_id)).fetchall()

    overall = db.execute('''
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
               SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent,
               SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late
        FROM student_attendance WHERE student_id=?
    ''', (student_id,)).fetchone()
    total = overall['total'] or 0
    present = overall['present'] or 0
    overall_pct = round(100 * present / total, 1) if total else 0

    recent = db.execute('''
        SELECT sa.date, sa.status, sa.period_no, sa.remarks, sub.name as subject_name
        FROM student_attendance sa
        LEFT JOIN subjects sub ON sub.id=sa.subject_id
        WHERE sa.student_id=?
        ORDER BY sa.date DESC, sa.period_no DESC LIMIT 50
    ''', (student_id,)).fetchall()

    marks = db.execute('''
        SELECT m.marks_obtained, m.remarks, s.name as subject_name,
               e.id as exam_id, e.name as exam_name, e.exam_date, e.is_published
        FROM marks m
        JOIN subjects s ON m.subject_id = s.id
        JOIN exams e ON m.exam_id = e.id
        WHERE m.student_id=? AND e.school_id=?
        ORDER BY e.exam_date DESC, s.name
    ''', (student_id, sid)).fetchall()
    # Group marks by exam
    by_exam = {}
    for m in marks:
        ex_id = m['exam_id']
        if ex_id not in by_exam:
            by_exam[ex_id] = {
                'exam_id': ex_id,
                'exam_name': m['exam_name'],
                'exam_date': m['exam_date'],
                'is_published': m['is_published'],
                'subjects': [],
            }
        by_exam[ex_id]['subjects'].append({
            'subject_name': m['subject_name'],
            'marks_obtained': m['marks_obtained'],
            'remarks': m['remarks'],
        })

    parents = db.execute('''
        SELECT p.id, p.name, p.email, p.phone
        FROM parent_student ps JOIN users p ON p.id = ps.parent_id
        WHERE ps.student_id=?
    ''', (student_id,)).fetchall()

    db.close()
    return jsonify({
        'info': _row(info),
        'overall': {'total': total, 'present': present,
                    'absent': overall['absent'] or 0, 'late': overall['late'] or 0,
                    'percentage': overall_pct},
        'subject_stats': _rows(subject_stats),
        'recent': _rows(recent),
        'exams': list(by_exam.values()),
        'parents': _rows(parents),
    })


@api_admin_bp.route('/students/<int:student_id>/day', methods=['GET'])
@login_required(roles=ROLES)
def student_day_detail(student_id):
    """One student's period-by-period attendance for a specific date.
    Useful for 'check who was absent in which periods' from the student detail page.
    """
    sid = _sid()
    date = request.args.get('date') or datetime.date.today().isoformat()
    db = get_db()

    student = db.execute('''
        SELECT u.id, u.name, sc.roll_no,
               c.id AS class_id, c.name AS class_name, c.section
        FROM users u
        LEFT JOIN student_classes sc ON sc.student_id = u.id
        LEFT JOIN classes c ON c.id = sc.class_id
        WHERE u.id=? AND u.school_id=? AND u.role='student'
    ''', (student_id, sid)).fetchone()
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404

    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    periods = (school['periods_per_day'] if school and school['periods_per_day'] else 8)

    # All recorded attendance for that student on that date
    rec_rows = db.execute('''
        SELECT sa.period_no, sa.status, sa.remarks, sa.subject_id,
               s.name AS subject_name, u.name AS marked_by_name
        FROM student_attendance sa
        LEFT JOIN subjects s ON s.id = sa.subject_id
        LEFT JOIN users u ON u.id = sa.marked_by
        WHERE sa.student_id=? AND sa.date=?
    ''', (student_id, date)).fetchall()
    by_period = {r['period_no']: r for r in rec_rows}

    # Today's timetable for context (so unmarked periods show the expected subject)
    day_name = datetime.date.fromisoformat(date).strftime('%A')
    tt_rows = []
    if student['class_id']:
        tt_rows = db.execute('''
            SELECT t.period_no, s.name AS subject_name, u.name AS teacher_name
            FROM timetable t
            JOIN subjects s ON s.id = t.subject_id
            LEFT JOIN users u ON u.id = s.teacher_id
            WHERE t.class_id=? AND t.day_of_week=?
            ORDER BY t.period_no
        ''', (student['class_id'], day_name)).fetchall()
    timetable_by_period = {r['period_no']: r for r in tt_rows}

    period_list = []
    counts = {'present': 0, 'late': 0, 'absent': 0, 'not_marked': 0}
    for p in range(1, periods + 1):
        rec = by_period.get(p)
        tt = timetable_by_period.get(p)
        status = (rec['status'] if rec else None) or 'not_marked'
        period_list.append({
            'period_no': p,
            'status': status,
            'subject_name': (rec['subject_name'] if rec else None) or (tt['subject_name'] if tt else None),
            'teacher_name': (tt['teacher_name'] if tt else None),
            'remarks': rec['remarks'] if rec else None,
            'marked_by_name': rec['marked_by_name'] if rec else None,
        })
        if status in counts:
            counts[status] += 1
        else:
            counts['not_marked'] += 1

    db.close()
    return jsonify({
        'student': _row(student),
        'date': date,
        'day_name': day_name,
        'periods': periods,
        'period_list': period_list,
        'counts': counts,
    })


@api_admin_bp.route('/students/<int:student_id>', methods=['PUT'])
@login_required(roles=ROLES)
def update_student(student_id):
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        db.execute(
            "UPDATE users SET name=?, email=?, phone=?, gender=?, dob=?, address=?, is_active=? WHERE id=? AND school_id=?",
            (data.get('name'), (data.get('email') or '').lower(), data.get('phone'), data.get('gender'),
             data.get('dob'), data.get('address'), 1 if data.get('is_active', True) else 0, student_id, sid)
        )
        if data.get('new_password'):
            db.execute("UPDATE users SET password=?, original_password=NULL WHERE id=?",
                       (hash_password(data['new_password']), student_id))
        if data.get('class_id'):
            db.execute("INSERT OR REPLACE INTO student_classes (student_id, class_id, roll_no) VALUES (?,?,?)",
                       (student_id, data['class_id'], data.get('roll_no')))
        db.commit()
        log_action(sid, _uid(), 'UPDATE_STUDENT', f'Updated student {student_id} (api)')
        return jsonify({'message': 'Student updated'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/students/<int:student_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_student(student_id):
    sid = _sid()
    db = get_db()
    student = db.execute("SELECT name, is_active FROM users WHERE id=? AND school_id=?", (student_id, sid)).fetchone()
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404
    if student['is_active']:
        db.execute("UPDATE users SET is_active=0 WHERE id=? AND school_id=?", (student_id, sid))
        log_action(sid, _uid(), 'ARCHIVE_STUDENT', student['name'] + ' (api)')
        msg = f"Student '{student['name']}' archived"
    else:
        db.execute("DELETE FROM users WHERE id=? AND school_id=?", (student_id, sid))
        log_action(sid, _uid(), 'PERMANENT_DELETE_STUDENT', student['name'] + ' (api)')
        msg = f"Student '{student['name']}' permanently deleted"
    db.commit()
    db.close()
    return jsonify({'message': msg})


# ─── TEACHERS ────────────────────────────────────────────────────────────────
@api_admin_bp.route('/teachers', methods=['GET'])
@login_required(roles=ROLES)
def list_teachers():
    sid = _sid()
    db = get_db()
    teachers = db.execute('''
        SELECT u.id, u.name, u.email, u.phone, u.gender, u.is_active,
               (SELECT GROUP_CONCAT(DISTINCT s.name)
                  FROM subjects s WHERE s.teacher_id=u.id) AS subjects,
               (SELECT COUNT(DISTINCT s.class_id)
                  FROM subjects s WHERE s.teacher_id=u.id) AS class_count
        FROM users u WHERE u.school_id=? AND u.role='teacher'
        ORDER BY u.name
    ''', (sid,)).fetchall()
    db.close()
    return jsonify({'teachers': _rows(teachers)})


@api_admin_bp.route('/teachers', methods=['POST'])
@login_required(roles=ROLES)
def add_teacher():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not all([name, email, password]):
        return jsonify({'error': 'name, email, password are required'}), 400
    db = get_db()
    try:
        db.execute('''
            INSERT INTO users (school_id, name, email, phone, password, original_password, role, gender)
            VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(school_id, email) DO UPDATE SET
                name=excluded.name, phone=excluded.phone, password=excluded.password,
                original_password=excluded.original_password, role=excluded.role,
                gender=excluded.gender, is_active=1
        ''', (sid, name, email, data.get('phone'), hash_password(password), None, 'teacher', data.get('gender')))
        db.commit()
        log_action(sid, _uid(), 'ADD_TEACHER', name + ' (api)')
        return jsonify({'message': 'Teacher added'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/teachers/<int:teacher_id>', methods=['PUT'])
@login_required(roles=ROLES)
def update_teacher(teacher_id):
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        db.execute(
            "UPDATE users SET name=?, email=?, phone=?, gender=?, is_active=? WHERE id=? AND school_id=?",
            (data.get('name'), (data.get('email') or '').lower(), data.get('phone'),
             data.get('gender'), 1 if data.get('is_active', True) else 0, teacher_id, sid)
        )
        if data.get('new_password'):
            db.execute("UPDATE users SET password=?, original_password=NULL WHERE id=?",
                       (hash_password(data['new_password']), teacher_id))
        db.commit()
        return jsonify({'message': 'Teacher updated'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/teachers/<int:teacher_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_teacher(teacher_id):
    sid = _sid()
    db = get_db()
    db.execute("UPDATE users SET is_active=0 WHERE id=? AND school_id=? AND role='teacher'", (teacher_id, sid))
    db.commit()
    db.close()
    return jsonify({'message': 'Teacher deactivated'})


# ─── CLASSES ─────────────────────────────────────────────────────────────────
@api_admin_bp.route('/classes', methods=['GET'])
@login_required(roles=ROLES)
def list_classes():
    sid = _sid()
    db = get_db()
    classes = db.execute('''
        SELECT c.*, u.name as class_teacher_name,
               (SELECT COUNT(*) FROM student_classes sc WHERE sc.class_id=c.id) as student_count,
               (SELECT COUNT(*) FROM subjects s WHERE s.class_id=c.id) as subject_count
        FROM classes c LEFT JOIN users u ON c.class_teacher_id=u.id
        WHERE c.school_id=? ORDER BY c.name, c.section
    ''', (sid,)).fetchall()
    teachers = db.execute("SELECT id, name FROM users WHERE school_id=? AND role='teacher' AND is_active=1 ORDER BY name", (sid,)).fetchall()
    db.close()
    return jsonify({'classes': _rows(classes), 'teachers': _rows(teachers)})


@api_admin_bp.route('/classes', methods=['POST'])
@login_required(roles=ROLES)
def add_class():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    section = (data.get('section') or '').strip()
    if not all([name, section]):
        return jsonify({'error': 'name and section are required'}), 400
    db = get_db()
    try:
        db.execute(
            "INSERT INTO classes (school_id, name, section, academic_year, class_teacher_id) VALUES (?,?,?,?,?)",
            (sid, name, section, data.get('academic_year'), data.get('class_teacher_id') or None)
        )
        db.commit()
        return jsonify({'message': 'Class added'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/classes/<int:class_id>', methods=['PUT'])
@login_required(roles=ROLES)
def update_class(class_id):
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        db.execute('''
            UPDATE classes SET name=?, section=?, academic_year=?, class_teacher_id=?
            WHERE id=? AND school_id=?
        ''', (data.get('name'), data.get('section'), data.get('academic_year'),
              data.get('class_teacher_id') or None, class_id, sid))
        db.commit()
        return jsonify({'message': 'Class updated'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/classes/<int:class_id>/roster', methods=['GET'])
@login_required(roles=ROLES)
def class_roster(class_id):
    """Students currently in this class — for the Promote modal."""
    sid = _sid()
    db = get_db()
    cls = db.execute("SELECT id, name, section, academic_year FROM classes WHERE id=? AND school_id=?",
                     (class_id, sid)).fetchone()
    if not cls:
        db.close()
        return jsonify({'error': 'Class not found'}), 404
    students = db.execute('''
        SELECT u.id, u.name, u.email, u.is_active, sc.roll_no
        FROM student_classes sc
        JOIN users u ON u.id = sc.student_id
        WHERE sc.class_id=? AND u.school_id=?
        ORDER BY sc.roll_no, u.name
    ''', (class_id, sid)).fetchall()
    db.close()
    return jsonify({'class': _row(cls), 'students': _rows(students)})


@api_admin_bp.route('/classes/promote', methods=['POST'])
@login_required(roles=ROLES)
def promote_class():
    """Bulk move students from one class to another (or to graduated state).

    Body:
      from_class_id: int (required) — source class
      to_class_id:   int | null     — destination; null = graduate (archive students)
      student_ids:   int[]          — empty = promote all students in source class
      keep_roll_nos: bool (default true)
      reason:        str (optional)
    """
    sid = _sid()
    uid = _uid()
    data = request.get_json(silent=True) or {}
    from_class_id = data.get('from_class_id')
    to_class_id = data.get('to_class_id')  # None = graduate
    student_ids = data.get('student_ids') or []
    keep_rolls = data.get('keep_roll_nos', True)
    reason = (data.get('reason') or '').strip() or None

    if not from_class_id:
        return jsonify({'error': 'from_class_id is required'}), 400
    if to_class_id == from_class_id:
        return jsonify({'error': 'Source and destination cannot be the same class'}), 400

    db = get_db()
    src = db.execute("SELECT id, name, section, academic_year FROM classes WHERE id=? AND school_id=?",
                     (from_class_id, sid)).fetchone()
    if not src:
        db.close()
        return jsonify({'error': 'Source class not found'}), 404

    dst = None
    if to_class_id is not None:
        dst = db.execute("SELECT id, name, section, academic_year FROM classes WHERE id=? AND school_id=?",
                         (to_class_id, sid)).fetchone()
        if not dst:
            db.close()
            return jsonify({'error': 'Destination class not found'}), 404

    # Resolve the list of students to promote
    if student_ids:
        placeholders = ','.join(['?'] * len(student_ids))
        roster = db.execute(f'''
            SELECT sc.student_id, sc.roll_no, u.name
            FROM student_classes sc
            JOIN users u ON u.id = sc.student_id
            WHERE sc.class_id=? AND sc.student_id IN ({placeholders})
        ''', (from_class_id, *student_ids)).fetchall()
    else:
        roster = db.execute('''
            SELECT sc.student_id, sc.roll_no, u.name
            FROM student_classes sc
            JOIN users u ON u.id = sc.student_id
            WHERE sc.class_id=?
        ''', (from_class_id,)).fetchall()

    if not roster:
        db.close()
        return jsonify({'error': 'No students to promote'}), 400

    # Detect roll-number collisions against the destination class
    if to_class_id is not None and keep_rolls:
        incoming_rolls = {(r['roll_no'] or '').strip() for r in roster if (r['roll_no'] or '').strip()}
        if incoming_rolls:
            placeholders = ','.join(['?'] * len(incoming_rolls))
            existing = db.execute(
                f"SELECT roll_no FROM student_classes WHERE class_id=? AND roll_no IN ({placeholders})",
                (to_class_id, *incoming_rolls)
            ).fetchall()
            if existing:
                colliding = sorted({(e['roll_no'] or '').strip() for e in existing})
                db.close()
                return jsonify({
                    'error': f"Roll-number conflict in destination class: {', '.join(colliding)}. "
                             'Empty the target class first, or uncheck "Keep current roll numbers".',
                    'conflicting_rolls': colliding,
                }), 409

    promoted = 0
    try:
        for r in roster:
            sid_student = r['student_id']
            old_roll = r['roll_no']
            new_roll = old_roll if keep_rolls else None

            # Record the transition in history
            db.execute('''
                INSERT INTO class_promotions
                (school_id, student_id, from_class_id, to_class_id,
                 from_academic_year, to_academic_year, old_roll_no, new_roll_no,
                 reason, promoted_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (sid, sid_student, from_class_id, to_class_id,
                  src['academic_year'], dst['academic_year'] if dst else None,
                  old_roll, new_roll, reason, uid))

            # Apply the change
            if to_class_id is None:
                # Graduate: remove from class + archive
                db.execute("DELETE FROM student_classes WHERE student_id=? AND class_id=?",
                           (sid_student, from_class_id))
                db.execute("UPDATE users SET is_active=0 WHERE id=? AND school_id=?",
                           (sid_student, sid))
            else:
                # Promote: remove old enrollment, insert new
                db.execute("DELETE FROM student_classes WHERE student_id=?", (sid_student,))
                db.execute("INSERT INTO student_classes (student_id, class_id, roll_no) VALUES (?,?,?)",
                           (sid_student, to_class_id, new_roll))
            promoted += 1

        db.commit()
        action = 'GRADUATE_STUDENTS' if to_class_id is None else 'PROMOTE_STUDENTS'
        details = f"{promoted} student(s) from {src['name']}-{src['section']}"
        if dst:
            details += f" -> {dst['name']}-{dst['section']}"
        else:
            details += ' (graduated)'
        log_action(sid, uid, action, details + ' (api)')
        return jsonify({
            'promoted': promoted,
            'graduated': to_class_id is None,
            'message': f'{promoted} student(s) ' + ('graduated' if to_class_id is None else f"promoted to {dst['name']}-{dst['section']}"),
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/students/<int:student_id>/history', methods=['GET'])
@login_required(roles=ROLES)
def student_history(student_id):
    """Promotion / class-change history for one student."""
    sid = _sid()
    db = get_db()
    # Ensure the student is in this school
    student = db.execute(
        "SELECT id FROM users WHERE id=? AND school_id=? AND role='student'",
        (student_id, sid)
    ).fetchone()
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404
    rows = db.execute('''
        SELECT cp.*,
               cf.name as from_class_name, cf.section as from_section,
               ct.name as to_class_name,   ct.section as to_section,
               u.name  as promoted_by_name
        FROM class_promotions cp
        LEFT JOIN classes cf ON cf.id = cp.from_class_id
        LEFT JOIN classes ct ON ct.id = cp.to_class_id
        LEFT JOIN users   u  ON u.id  = cp.promoted_by
        WHERE cp.student_id=? AND cp.school_id=?
        ORDER BY cp.promoted_at DESC
    ''', (student_id, sid)).fetchall()
    db.close()
    return jsonify({'history': _rows(rows)})


@api_admin_bp.route('/classes/<int:class_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_class(class_id):
    sid = _sid()
    db = get_db()
    try:
        has_students = db.execute("SELECT COUNT(*) c FROM student_classes WHERE class_id=?", (class_id,)).fetchone()['c']
        if has_students > 0:
            return jsonify({'error': 'Cannot delete: class has assigned students. Reassign first.'}), 409
        db.execute("DELETE FROM classes WHERE id=? AND school_id=?", (class_id, sid))
        db.commit()
        return jsonify({'message': 'Class deleted'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ─── SUBJECTS ────────────────────────────────────────────────────────────────
@api_admin_bp.route('/subjects', methods=['GET'])
@login_required(roles=ROLES)
def list_subjects():
    sid = _sid()
    db = get_db()
    subjects = db.execute('''
        SELECT s.*, c.name as class_name, c.section, u.name as teacher_name
        FROM subjects s
        JOIN classes c ON s.class_id=c.id
        LEFT JOIN users u ON s.teacher_id=u.id
        WHERE s.school_id=? ORDER BY c.name, c.section, s.name
    ''', (sid,)).fetchall()
    classes = db.execute("SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section", (sid,)).fetchall()
    teachers = db.execute("SELECT id, name FROM users WHERE school_id=? AND role='teacher' AND is_active=1 ORDER BY name", (sid,)).fetchall()
    db.close()
    return jsonify({'subjects': _rows(subjects), 'classes': _rows(classes), 'teachers': _rows(teachers)})


@api_admin_bp.route('/subjects', methods=['POST'])
@login_required(roles=ROLES)
def add_subject():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    class_id = data.get('class_id')
    if not all([name, class_id]):
        return jsonify({'error': 'name and class_id are required'}), 400
    db = get_db()
    try:
        db.execute(
            "INSERT INTO subjects (school_id, class_id, name, teacher_id) VALUES (?,?,?,?)",
            (sid, class_id, name, data.get('teacher_id') or None)
        )
        db.commit()
        return jsonify({'message': 'Subject added'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/subjects/<int:subject_id>', methods=['PUT'])
@login_required(roles=ROLES)
def update_subject(subject_id):
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        db.execute('''UPDATE subjects SET name=?, class_id=?, teacher_id=? WHERE id=? AND school_id=?''',
                   (data.get('name'), data.get('class_id'), data.get('teacher_id') or None, subject_id, sid))
        db.commit()
        return jsonify({'message': 'Subject updated'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/subjects/<int:subject_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_subject(subject_id):
    sid = _sid()
    db = get_db()
    try:
        db.execute("DELETE FROM subjects WHERE id=? AND school_id=?", (subject_id, sid))
        db.commit()
        return jsonify({'message': 'Subject deleted'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ─── ATTENDANCE OVERVIEW (school-wide present/absent for any date) ──────────
@api_admin_bp.route('/attendance-overview', methods=['GET'])
@login_required(roles=ROLES)
def attendance_overview():
    """Per-class present/absent/late/not-marked counts for a given date."""
    sid = _sid()
    date = request.args.get('date') or datetime.date.today().isoformat()
    db = get_db()

    # Status code: 3=present (best), 2=late, 1=absent, 0=not marked. Take the
    # max over all periods so a student is "present" if they were present in
    # at least one period.
    rows = db.execute('''
        WITH per_student AS (
            SELECT sc.class_id, sc.student_id,
                   COALESCE(MAX(CASE
                       WHEN sa.status='present' THEN 3
                       WHEN sa.status='late'    THEN 2
                       WHEN sa.status='absent'  THEN 1
                   END), 0) AS code
            FROM student_classes sc
            LEFT JOIN student_attendance sa
              ON sa.student_id = sc.student_id
             AND sa.class_id   = sc.class_id
             AND sa.date       = ?
            JOIN classes c ON c.id = sc.class_id
            JOIN users   u ON u.id = sc.student_id
            WHERE c.school_id = ? AND u.is_active = 1
            GROUP BY sc.class_id, sc.student_id
        )
        SELECT c.id, c.name, c.section, c.academic_year,
               COUNT(p.student_id)                                AS enrolled,
               SUM(CASE WHEN p.code = 3 THEN 1 ELSE 0 END)         AS present,
               SUM(CASE WHEN p.code = 2 THEN 1 ELSE 0 END)         AS late,
               SUM(CASE WHEN p.code = 1 THEN 1 ELSE 0 END)         AS absent,
               SUM(CASE WHEN p.code = 0 THEN 1 ELSE 0 END)         AS not_marked
        FROM classes c
        LEFT JOIN per_student p ON p.class_id = c.id
        WHERE c.school_id = ?
        GROUP BY c.id
        ORDER BY c.name, c.section
    ''', (date, sid, sid)).fetchall()

    classes = _rows(rows)
    totals = {
        'enrolled':   sum(c.get('enrolled')   or 0 for c in classes),
        'present':    sum(c.get('present')    or 0 for c in classes),
        'late':       sum(c.get('late')       or 0 for c in classes),
        'absent':     sum(c.get('absent')     or 0 for c in classes),
        'not_marked': sum(c.get('not_marked') or 0 for c in classes),
    }
    totals['marked'] = totals['present'] + totals['late'] + totals['absent']
    totals['attendance_pct'] = (
        round(100.0 * totals['present'] / totals['enrolled'], 1)
        if totals['enrolled'] else 0
    )
    db.close()
    return jsonify({'date': date, 'classes': classes, 'totals': totals})


@api_admin_bp.route('/attendance-overview/class/<int:class_id>', methods=['GET'])
@login_required(roles=ROLES)
def attendance_overview_class(class_id):
    """Per-student list grouped by status + per-period grid for one class on a date."""
    sid = _sid()
    date = request.args.get('date') or datetime.date.today().isoformat()
    db = get_db()

    cls = db.execute(
        "SELECT id, name, section FROM classes WHERE id=? AND school_id=?",
        (class_id, sid)
    ).fetchone()
    if not cls:
        db.close()
        return jsonify({'error': 'Class not found'}), 404

    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    periods = (school['periods_per_day'] if school and school['periods_per_day'] else 8)

    rows = db.execute('''
        SELECT u.id, u.name, sc.roll_no, u.phone,
               COALESCE(MAX(CASE
                   WHEN sa.status='present' THEN 3
                   WHEN sa.status='late'    THEN 2
                   WHEN sa.status='absent'  THEN 1
               END), 0) AS code,
               (SELECT GROUP_CONCAT(remarks, ' | ')
                FROM student_attendance
                WHERE student_id=u.id AND class_id=sc.class_id AND date=?
                  AND remarks IS NOT NULL AND remarks != '') AS remarks
        FROM student_classes sc
        JOIN users u ON u.id = sc.student_id
        LEFT JOIN student_attendance sa
          ON sa.student_id = u.id
         AND sa.class_id   = sc.class_id
         AND sa.date       = ?
        WHERE sc.class_id = ? AND u.is_active = 1
        GROUP BY u.id
        ORDER BY sc.roll_no, u.name
    ''', (date, date, class_id)).fetchall()

    # Per-student per-period detail
    period_rows = db.execute('''
        SELECT sa.student_id, sa.period_no, sa.status, sa.subject_id, sa.remarks,
               s.name AS subject_name
        FROM student_attendance sa
        LEFT JOIN subjects s ON s.id = sa.subject_id
        WHERE sa.class_id=? AND sa.date=?
    ''', (class_id, date)).fetchall()

    by_student_period = {}
    for r in period_rows:
        key = (r['student_id'], r['period_no'])
        by_student_period[key] = {
            'status': r['status'],
            'subject_name': r['subject_name'],
            'remarks': r['remarks'],
        }

    # Today's timetable so we know which subject is in each period
    day_name = datetime.date.fromisoformat(date).strftime('%A')
    tt_rows = db.execute('''
        SELECT t.period_no, s.name AS subject_name
        FROM timetable t
        JOIN subjects s ON s.id = t.subject_id
        WHERE t.class_id=? AND t.day_of_week=?
        ORDER BY t.period_no
    ''', (class_id, day_name)).fetchall()
    timetable_by_period = {r['period_no']: r['subject_name'] for r in tt_rows}

    students = []
    buckets = {'present': [], 'late': [], 'absent': [], 'not_marked': []}
    for r in rows:
        bucket = (
            'present'    if r['code'] == 3 else
            'late'       if r['code'] == 2 else
            'absent'     if r['code'] == 1 else
            'not_marked'
        )
        student_entry = {
            'id': r['id'], 'name': r['name'], 'roll_no': r['roll_no'],
            'phone': r['phone'], 'remarks': r['remarks'],
        }
        buckets[bucket].append(student_entry)

        # Build per-period array
        per_period = []
        per_period_counts = {'present': 0, 'late': 0, 'absent': 0, 'not_marked': 0}
        for p in range(1, periods + 1):
            rec = by_student_period.get((r['id'], p))
            status = (rec['status'] if rec else None) or 'not_marked'
            per_period.append({
                'period_no': p,
                'status': status,
                'subject_name': (rec['subject_name'] if rec else None) or timetable_by_period.get(p),
                'remarks': rec['remarks'] if rec else None,
            })
            if status in per_period_counts:
                per_period_counts[status] += 1
            else:
                per_period_counts['not_marked'] += 1
        students.append({
            **student_entry,
            'overall_status': bucket,
            'periods': per_period,
            'present_count': per_period_counts['present'],
            'late_count': per_period_counts['late'],
            'absent_count': per_period_counts['absent'],
            'not_marked_count': per_period_counts['not_marked'],
        })

    db.close()
    return jsonify({
        'class': _row(cls),
        'date': date,
        'periods': periods,
        'timetable': timetable_by_period,
        'buckets': buckets,
        'students': students,
    })


@api_admin_bp.route('/attendance-overview/staff', methods=['GET'])
@login_required(roles=ROLES)
def attendance_overview_staff():
    """All active staff with today's attendance status (joined view, for inline display)."""
    sid = _sid()
    date = request.args.get('date') or datetime.date.today().isoformat()
    db = get_db()
    rows = db.execute('''
        SELECT u.id AS staff_id, u.name AS staff_name, u.role, u.phone,
               sa.status, sa.check_in, sa.check_out, sa.remarks, sa.leave_type
        FROM users u
        LEFT JOIN staff_attendance sa
          ON sa.staff_id = u.id AND sa.date = ? AND sa.school_id = u.school_id
        WHERE u.school_id=? AND u.role IN ('teacher','admin','principal') AND u.is_active=1
        ORDER BY u.role, u.name
    ''', (date, sid)).fetchall()
    rows = _rows(rows)
    totals = {'total': len(rows), 'present': 0, 'late': 0, 'absent': 0,
              'on_leave': 0, 'half_day': 0, 'not_marked': 0}
    for r in rows:
        s = r.get('status') or 'not_marked'
        if s in totals:
            totals[s] += 1
        else:
            totals['not_marked'] += 1
    db.close()
    return jsonify({'date': date, 'staff': rows, 'totals': totals})


# ─── BATCHES (group students by academic year) ──────────────────────────────
@api_admin_bp.route('/batches', methods=['GET'])
@login_required(roles=ROLES)
def list_batches():
    """One row per distinct academic_year in this school's classes.

    Each row includes class count, student count, and average attendance %.
    """
    sid = _sid()
    db = get_db()
    rows = db.execute('''
        SELECT
            COALESCE(NULLIF(c.academic_year, ''), '(none)') AS academic_year,
            COUNT(DISTINCT c.id)                             AS class_count,
            COUNT(DISTINCT sc.student_id)                    AS student_count
        FROM classes c
        LEFT JOIN student_classes sc ON sc.class_id = c.id
        WHERE c.school_id = ?
        GROUP BY COALESCE(NULLIF(c.academic_year, ''), '(none)')
        ORDER BY academic_year DESC
    ''', (sid,)).fetchall()

    batches = []
    for r in rows:
        year = r['academic_year']
        # Average attendance % across all students in this year's classes
        stat = db.execute('''
            SELECT
                COUNT(sa.id)                                                   AS total,
                SUM(CASE WHEN sa.status='present' THEN 1 ELSE 0 END)            AS present,
                COUNT(DISTINCT sa.student_id)                                  AS marked_students
            FROM student_attendance sa
            JOIN classes c ON c.id = sa.class_id
            WHERE c.school_id = ? AND COALESCE(NULLIF(c.academic_year, ''), '(none)') = ?
        ''', (sid, year)).fetchone()
        total = stat['total'] or 0
        present = stat['present'] or 0
        pct = round(100.0 * present / total, 1) if total else 0
        batches.append({
            'academic_year': None if year == '(none)' else year,
            'class_count': r['class_count'],
            'student_count': r['student_count'],
            'attendance_total': total,
            'attendance_present': present,
            'attendance_pct': pct,
        })

    db.close()
    return jsonify({'batches': batches})


@api_admin_bp.route('/graduates', methods=['GET'])
@login_required(roles=ROLES)
def list_graduates():
    """All students who have been graduated, grouped by graduation year.

    A graduation row is a class_promotions entry where to_class_id IS NULL.
    Uses the most-recent graduation row per student (in case a student was
    re-enrolled and re-graduated).
    """
    sid = _sid()
    db = get_db()
    rows = db.execute('''
        WITH grad AS (
            SELECT student_id, MAX(promoted_at) AS promoted_at
            FROM class_promotions
            WHERE school_id=? AND to_class_id IS NULL
            GROUP BY student_id
        )
        SELECT
            u.id, u.name, u.email, u.phone, u.gender, u.is_active,
            cp.from_class_id, cp.from_academic_year,
            cp.old_roll_no, cp.reason, cp.promoted_at,
            pb.name AS promoted_by_name,
            fc.name AS from_class_name, fc.section AS from_section
        FROM grad g
        JOIN class_promotions cp
          ON cp.student_id = g.student_id
         AND cp.promoted_at = g.promoted_at
         AND cp.to_class_id IS NULL
        JOIN users u ON u.id = g.student_id
        LEFT JOIN classes fc ON fc.id = cp.from_class_id
        LEFT JOIN users pb ON pb.id = cp.promoted_by
        WHERE cp.school_id=?
        ORDER BY cp.promoted_at DESC, u.name
    ''', (sid, sid)).fetchall()

    graduates = _rows(rows)

    # Bucket by graduation year (extracted from from_academic_year, falling back to promoted_at year)
    grouped = {}
    for g in graduates:
        year = g.get('from_academic_year') or (
            (g.get('promoted_at') or '')[:4] if g.get('promoted_at') else None
        )
        key = year or '(unknown)'
        grouped.setdefault(key, []).append(g)

    groups = []
    for year, students in sorted(grouped.items(), reverse=True):
        groups.append({
            'academic_year': None if year == '(unknown)' else year,
            'count': len(students),
            'students': students,
        })

    db.close()
    return jsonify({'groups': groups, 'total': len(graduates)})


@api_admin_bp.route('/graduates/<int:student_id>/reactivate', methods=['POST'])
@login_required(roles=ROLES)
def reactivate_graduate(student_id):
    """Reactivate a graduated student account (sets is_active=1).
    Does NOT re-enroll them in a class — admin must assign a class via the Students page.
    """
    sid = _sid()
    db = get_db()
    student = db.execute(
        "SELECT id, name FROM users WHERE id=? AND school_id=? AND role='student'",
        (student_id, sid),
    ).fetchone()
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404
    db.execute("UPDATE users SET is_active=1 WHERE id=? AND school_id=?", (student_id, sid))
    db.commit()
    db.close()
    log_action(sid, _uid(), 'REACTIVATE_GRADUATE', f"{student['name']} (api)")
    return jsonify({'message': f"{student['name']} reactivated. Assign them to a class from the Students page."})


@api_admin_bp.route('/batches/<path:year>', methods=['GET'])
@login_required(roles=ROLES)
def batch_detail(year):
    """All classes + all students in one academic year, with each student's
    current attendance summary.
    """
    sid = _sid()
    db = get_db()

    # Match the literal year, treating "(none)" as either NULL or empty-string
    if year == '(none)':
        year_clause = "(c.academic_year IS NULL OR c.academic_year = '')"
        params = (sid,)
    else:
        year_clause = "c.academic_year = ?"
        params = (sid, year)

    classes = db.execute(f'''
        SELECT c.id, c.name, c.section, c.academic_year, c.class_teacher_id,
               u.name as class_teacher_name,
               (SELECT COUNT(*) FROM student_classes sc WHERE sc.class_id=c.id) AS student_count
        FROM classes c
        LEFT JOIN users u ON u.id = c.class_teacher_id
        WHERE c.school_id = ? AND {year_clause}
        ORDER BY c.name, c.section
    ''', params).fetchall()

    students = db.execute(f'''
        SELECT u.id, u.name, u.email, u.is_active,
               c.id AS class_id, c.name AS class_name, c.section,
               sc.roll_no,
               (SELECT COUNT(*) FROM student_attendance sa WHERE sa.student_id=u.id) AS total,
               (SELECT COUNT(*) FROM student_attendance sa WHERE sa.student_id=u.id AND sa.status='present') AS present,
               (SELECT COUNT(*) FROM student_attendance sa WHERE sa.student_id=u.id AND sa.status='absent') AS absent,
               (SELECT COUNT(*) FROM student_attendance sa WHERE sa.student_id=u.id AND sa.status='late') AS late
        FROM student_classes sc
        JOIN users u ON u.id = sc.student_id
        JOIN classes c ON c.id = sc.class_id
        WHERE c.school_id = ? AND {year_clause}
        ORDER BY c.name, c.section, sc.roll_no, u.name
    ''', params).fetchall()

    student_list = []
    for s in students:
        total = s['total'] or 0
        present = s['present'] or 0
        pct = round(100.0 * present / total, 1) if total else 0
        student_list.append({
            'id': s['id'], 'name': s['name'], 'email': s['email'], 'is_active': s['is_active'],
            'class_id': s['class_id'], 'class_name': s['class_name'], 'section': s['section'],
            'roll_no': s['roll_no'],
            'total': total, 'present': present, 'absent': s['absent'] or 0, 'late': s['late'] or 0,
            'pct': pct,
        })

    db.close()
    return jsonify({
        'academic_year': None if year == '(none)' else year,
        'classes': _rows(classes),
        'students': student_list,
    })


# ─── SETTINGS ────────────────────────────────────────────────────────────────
@api_admin_bp.route('/settings', methods=['GET'])
@login_required(roles=ROLES)
def get_settings():
    sid = _sid()
    db = get_db()
    school = db.execute("SELECT * FROM schools WHERE id=?", (sid,)).fetchone()
    db.close()
    return jsonify({'school': _row(school)})


@api_admin_bp.route('/settings', methods=['PUT'])
@login_required(roles=ROLES)
def update_settings():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        db.execute('''UPDATE schools SET primary_color=?, academic_year=?, periods_per_day=?,
                      min_attendance_pct=?, late_cutoff_time=?, phone=?, email=?, address=?
                      WHERE id=?''',
                   (data.get('primary_color', '#4f46e5'),
                    data.get('academic_year'), data.get('periods_per_day', 8),
                    data.get('min_attendance_pct', 75), data.get('late_cutoff_time', '09:00'),
                    data.get('phone'), data.get('email'), data.get('address'), sid))
        db.commit()
        log_action(sid, _uid(), 'UPDATE_SETTINGS', 'School settings updated (api)')
        return jsonify({'message': 'Settings saved'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ─── HOLIDAYS ────────────────────────────────────────────────────────────────
@api_admin_bp.route('/holidays', methods=['GET'])
@login_required(roles=ROLES)
def list_holidays():
    sid = _sid()
    db = get_db()
    rows = db.execute("SELECT * FROM holidays WHERE school_id=? ORDER BY date", (sid,)).fetchall()
    db.close()
    return jsonify({'holidays': _rows(rows)})


@api_admin_bp.route('/holidays', methods=['POST'])
@login_required(roles=ROLES)
def add_holiday():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    date = (data.get('date') or '').strip()
    if not all([name, date]):
        return jsonify({'error': 'name and date are required'}), 400
    db = get_db()
    try:
        db.execute("INSERT OR REPLACE INTO holidays (school_id, date, name) VALUES (?,?,?)", (sid, date, name))
        db.commit()
        return jsonify({'message': 'Holiday added'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/holidays/<int:hid>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_holiday(hid):
    sid = _sid()
    db = get_db()
    db.execute("DELETE FROM holidays WHERE id=? AND school_id=?", (hid, sid))
    db.commit()
    db.close()
    return jsonify({'message': 'Holiday removed'})


# ─── EXAMS ───────────────────────────────────────────────────────────────────
@api_admin_bp.route('/exams', methods=['GET'])
@login_required(roles=ROLES)
def list_exams():
    sid = _sid()
    db = get_db()
    rows = db.execute("SELECT * FROM exams WHERE school_id=? ORDER BY created_at DESC", (sid,)).fetchall()
    db.close()
    return jsonify({'exams': _rows(rows)})


@api_admin_bp.route('/exams', methods=['POST'])
@login_required(roles=ROLES)
def add_exam():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    exam_date = data.get('exam_date')
    if not all([name, exam_date]):
        return jsonify({'error': 'name and exam_date are required'}), 400
    db = get_db()
    try:
        db.execute(
            "INSERT INTO exams (school_id, name, exam_date, academic_year) VALUES (?,?,?,?)",
            (sid, name, exam_date, data.get('academic_year', '2025-2026'))
        )
        db.commit()
        log_action(sid, _uid(), 'ADD_EXAM', name + ' (api)')
        return jsonify({'message': 'Exam created'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/exams/<int:exam_id>', methods=['PUT'])
@login_required(roles=ROLES)
def update_exam(exam_id):
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        db.execute(
            "UPDATE exams SET name=?, exam_date=?, academic_year=? WHERE id=? AND school_id=?",
            (data.get('name'), data.get('exam_date'), data.get('academic_year'), exam_id, sid)
        )
        db.commit()
        return jsonify({'message': 'Exam updated'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_admin_bp.route('/exams/<int:exam_id>/toggle-publish', methods=['POST'])
@login_required(roles=ROLES)
def toggle_exam_publish(exam_id):
    sid = _sid()
    db = get_db()
    exam = db.execute("SELECT is_published FROM exams WHERE id=? AND school_id=?", (exam_id, sid)).fetchone()
    if not exam:
        db.close()
        return jsonify({'error': 'Exam not found'}), 404
    new_status = 0 if exam['is_published'] else 1
    db.execute("UPDATE exams SET is_published=? WHERE id=? AND school_id=?", (new_status, exam_id, sid))
    db.commit()
    db.close()
    return jsonify({'is_published': bool(new_status)})


@api_admin_bp.route('/exams/<int:exam_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_exam(exam_id):
    sid = _sid()
    db = get_db()
    db.execute("DELETE FROM exams WHERE id=? AND school_id=?", (exam_id, sid))
    db.commit()
    db.close()
    return jsonify({'message': 'Exam deleted'})


# ─── STAFF ATTENDANCE ────────────────────────────────────────────────────────
@api_admin_bp.route('/staff-attendance', methods=['GET'])
@login_required(roles=ROLES)
def staff_attendance():
    sid = _sid()
    date_filter = request.args.get('date') or datetime.date.today().isoformat()
    db = get_db()
    records = db.execute('''
        SELECT sa.*, u.name as staff_name, u.role
        FROM staff_attendance sa
        JOIN users u ON sa.staff_id = u.id
        WHERE sa.school_id=? AND sa.date=?
        ORDER BY u.role, u.name
    ''', (sid, date_filter)).fetchall()
    all_staff = db.execute(
        "SELECT id, name, role FROM users WHERE school_id=? AND role IN ('teacher','admin','principal') AND is_active=1 ORDER BY role, name",
        (sid,)
    ).fetchall()
    db.close()
    return jsonify({'records': _rows(records), 'all_staff': _rows(all_staff), 'date': date_filter})


@api_admin_bp.route('/staff-attendance/mark', methods=['POST'])
@login_required(roles=ROLES)
def mark_staff_attendance():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    try:
        db.execute('''
            INSERT OR REPLACE INTO staff_attendance
            (staff_id, school_id, date, status, check_in, check_out, remarks, marked_by)
            VALUES (?,?,?,?,?,?,?,?)
        ''', (data['staff_id'], sid, data['date'], data['status'],
              data.get('check_in'), data.get('check_out'),
              data.get('remarks'), _uid()))
        db.commit()
        return jsonify({'message': 'Saved'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()


# ─── TEACHERS ATTENDANCE REPORT (per-teacher summary + detail) ──────────────
@api_admin_bp.route('/teachers-attendance-report', methods=['GET'])
@login_required(roles=ROLES)
def teachers_attendance_report():
    """Per-teacher attendance summary over a date range. Defaults to current month."""
    sid = _sid()
    today = datetime.date.today()
    default_from = today.replace(day=1).isoformat()
    from_date = request.args.get('from_date') or default_from
    to_date = request.args.get('to_date') or today.isoformat()
    teacher_id = request.args.get('teacher_id', type=int)

    db = get_db()
    teachers = db.execute(
        "SELECT id, name, email, phone FROM users WHERE school_id=? AND role='teacher' AND is_active=1 ORDER BY name",
        (sid,),
    ).fetchall()

    # Working days in range = total dates minus holidays. Sundays are also excluded.
    holidays = {h['date'] for h in db.execute(
        "SELECT date FROM holidays WHERE school_id=? AND date BETWEEN ? AND ?",
        (sid, from_date, to_date),
    ).fetchall()}
    try:
        d_from = datetime.date.fromisoformat(from_date)
        d_to = datetime.date.fromisoformat(to_date)
    except ValueError:
        db.close()
        return jsonify({'error': 'invalid date format (use YYYY-MM-DD)'}), 400
    if d_from > d_to:
        db.close()
        return jsonify({'error': 'from_date must be <= to_date'}), 400

    working_days = 0
    d = d_from
    while d <= d_to:
        if d.weekday() != 6 and d.isoformat() not in holidays:  # 6 = Sunday
            working_days += 1
        d += datetime.timedelta(days=1)

    summaries = []
    for t in teachers:
        row = db.execute(
            '''SELECT
                  COUNT(*) AS marked,
                  SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
                  SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) AS late,
                  SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) AS absent,
                  SUM(CASE WHEN status='on_leave' THEN 1 ELSE 0 END) AS on_leave,
                  SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END) AS half_day,
                  MAX(date) AS last_date
               FROM staff_attendance
               WHERE staff_id=? AND school_id=? AND date BETWEEN ? AND ?''',
            (t['id'], sid, from_date, to_date),
        ).fetchone()
        present = (row['present'] or 0) + (row['late'] or 0)  # late still counts as present
        marked = row['marked'] or 0
        # Attendance % = present (incl. late) / days where attendance was actually recorded.
        # "Not marked" days are tracked separately as a data-quality signal, not a penalty.
        pct = round(100.0 * present / marked, 1) if marked else 0.0
        # Coverage % = how completely is this teacher's attendance being tracked?
        coverage = round(100.0 * marked / working_days, 1) if working_days else 0.0
        summaries.append({
            'id': t['id'],
            'name': t['name'],
            'email': t['email'],
            'phone': t['phone'],
            'marked': marked,
            'present': row['present'] or 0,
            'late': row['late'] or 0,
            'absent': row['absent'] or 0,
            'on_leave': row['on_leave'] or 0,
            'half_day': row['half_day'] or 0,
            'not_marked': max(0, working_days - marked),
            'pct': pct,
            'coverage': coverage,
            'last_date': row['last_date'],
        })

    detail = None
    if teacher_id:
        records = db.execute(
            '''SELECT date, check_in, check_out, status, remarks
               FROM staff_attendance
               WHERE staff_id=? AND school_id=? AND date BETWEEN ? AND ?
               ORDER BY date DESC''',
            (teacher_id, sid, from_date, to_date),
        ).fetchall()
        teacher = db.execute(
            "SELECT id, name, email, phone FROM users WHERE id=? AND school_id=?",
            (teacher_id, sid),
        ).fetchone()
        detail = {
            'teacher': _row(teacher),
            'records': _rows(records),
        }

    db.close()
    return jsonify({
        'from_date': from_date,
        'to_date': to_date,
        'working_days': working_days,
        'summaries': summaries,
        'detail': detail,
    })


# ─── TIMETABLE ───────────────────────────────────────────────────────────────
@api_admin_bp.route('/timetable', methods=['GET'])
@login_required(roles=ROLES)
def timetable():
    sid = _sid()
    class_id = request.args.get('class_id')
    db = get_db()
    classes = db.execute("SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name", (sid,)).fetchall()
    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    subjects = []
    timetable_data = {}
    if class_id:
        subjects = db.execute("SELECT id, name FROM subjects WHERE class_id=?", (class_id,)).fetchall()
        records = db.execute("SELECT * FROM timetable WHERE class_id=?", (class_id,)).fetchall()
        for r in records:
            timetable_data[f"{r['day_of_week']}-{r['period_no']}"] = r['subject_id']
    db.close()
    return jsonify({
        'classes': _rows(classes),
        'subjects': _rows(subjects),
        'periods': school['periods_per_day'] if school else 8,
        'data': timetable_data,
        'class_id': int(class_id) if class_id else None,
    })


@api_admin_bp.route('/timetable/update', methods=['POST'])
@login_required(roles=ROLES)
def update_timetable():
    data = request.get_json(silent=True) or {}
    class_id = data.get('class_id')
    day = data.get('day')
    period = data.get('period')
    subject_id = data.get('subject_id')
    if class_id is None or not day or period is None:
        return jsonify({'error': 'class_id, day, period required'}), 400
    db = get_db()
    try:
        # Always wipe the slot first — guarantees one row per (class, day, period)
        # even if the unique index is missing.
        db.execute("DELETE FROM timetable WHERE class_id=? AND day_of_week=? AND period_no=?",
                   (class_id, day, period))
        if subject_id:
            db.execute('''
                INSERT INTO timetable (class_id, subject_id, day_of_week, period_no)
                VALUES (?,?,?,?)
            ''', (class_id, subject_id, day, period))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()


# ─── CSV STUDENT IMPORT ──────────────────────────────────────────────────────
@api_admin_bp.route('/students/import', methods=['POST'])
@login_required(roles=ROLES)
def import_students():
    sid = _sid()
    file = request.files.get('csv_file')
    if not file:
        return jsonify({'error': 'No file uploaded (field name: csv_file)'}), 400

    try:
        stream = io.StringIO(file.stream.read().decode('utf-8-sig'))
        reader = csv.DictReader(stream)
    except Exception as e:
        return jsonify({'error': f'Cannot read CSV: {e}'}), 400

    db = get_db()
    classes_raw = db.execute("SELECT id, name, section FROM classes WHERE school_id=?", (sid,)).fetchall()
    classes_map = {}
    for c in classes_raw:
        classes_map[c['name'].lower().strip()] = c['id']
        classes_map[f"{c['name']} - {c['section']}".lower().strip()] = c['id']
        classes_map[f"{c['name']}-{c['section']}".lower().strip()] = c['id']

    success = 0
    errors = []
    for line_idx, row in enumerate(reader, start=2):
        n_row = {(k or '').lower().strip().replace(' ', '_'): (v or '').strip() for k, v in row.items()}
        try:
            name = n_row.get('name')
            email = (n_row.get('email') or '').lower()
            password = n_row.get('password') or 'Student@123'
            if not name or not email:
                errors.append(f"Row {line_idx}: missing name or email")
                continue

            class_id = n_row.get('class_id') or None
            if not class_id and n_row.get('class'):
                cn = n_row['class'].lower()
                class_id = classes_map.get(cn)
                if not class_id:
                    for k, cid in classes_map.items():
                        if k in cn or cn in k:
                            class_id = cid
                            break

            cursor = db.execute('''
                INSERT INTO users (school_id, name, email, phone, password, original_password, role, gender)
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(school_id, email) DO UPDATE SET
                    name=excluded.name, phone=excluded.phone, password=excluded.password,
                    original_password=excluded.original_password, role=excluded.role, is_active=1
            ''', (sid, name, email, n_row.get('phone'), hash_password(password), None,
                  'student', n_row.get('gender')))
            uid = cursor.lastrowid or db.execute(
                "SELECT id FROM users WHERE school_id=? AND email=?", (sid, email)
            ).fetchone()['id']
            if class_id:
                db.execute(
                    "INSERT OR REPLACE INTO student_classes (student_id, class_id, roll_no) VALUES (?,?,?)",
                    (uid, class_id, n_row.get('roll_number') or n_row.get('roll_no'))
                )
            success += 1
        except Exception as e:
            errors.append(f"Row {line_idx}: {e}")

    db.commit()
    db.close()
    log_action(sid, _uid(), 'IMPORT_STUDENTS', f'Imported {success} students, {len(errors)} errors (api)')
    return jsonify({
        'success': success,
        'errors': errors[:20],
        'error_count': len(errors),
        'message': f'Imported {success} students' + (f' with {len(errors)} errors' if errors else ''),
    })


# ─── PURGE INACTIVE STUDENTS ─────────────────────────────────────────────────
@api_admin_bp.route('/students/purge-inactive', methods=['POST'])
@login_required(roles=ROLES)
def purge_inactive_students():
    sid = _sid()
    db = get_db()
    count = db.execute("SELECT COUNT(*) c FROM users WHERE school_id=? AND role='student' AND is_active=0", (sid,)).fetchone()['c']
    if count > 0:
        db.execute("DELETE FROM users WHERE school_id=? AND role='student' AND is_active=0", (sid,))
        db.commit()
        log_action(sid, _uid(), 'PURGE_INACTIVE_STUDENTS', f'Removed {count} students (api)')
    db.close()
    return jsonify({'count': count, 'message': f'Removed {count} inactive students'})


# ─── DIARY: school-wide announcements + oversight ───────────────────────────
@api_admin_bp.route('/diary', methods=['GET'])
@login_required(roles=ROLES)
def list_diary():
    """List diary entries. Filters: scope, class_id, from_date, to_date, posted_by_me.
    Admin sees all (school + class). Use scope=school to see only announcements.
    """
    sid = _sid()
    scope = request.args.get('scope')
    class_id = request.args.get('class_id', type=int)
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')

    db = get_db()
    query = '''
        SELECT d.id, d.scope, d.class_id, d.subject_id, d.title, d.content, d.link,
               d.entry_date, d.posted_by, d.created_at, d.updated_at,
               c.name AS class_name, c.section,
               s.name AS subject_name,
               u.name AS posted_by_name, u.role AS posted_by_role
        FROM diary_entries d
        LEFT JOIN classes c ON c.id = d.class_id
        LEFT JOIN subjects s ON s.id = d.subject_id
        LEFT JOIN users u ON u.id = d.posted_by
        WHERE d.school_id=?
    '''
    params = [sid]
    if scope in ('school', 'class'):
        query += ' AND d.scope=?'
        params.append(scope)
    if class_id:
        query += ' AND d.class_id=?'
        params.append(class_id)
    if from_date:
        query += ' AND d.entry_date>=?'
        params.append(from_date)
    if to_date:
        query += ' AND d.entry_date<=?'
        params.append(to_date)
    query += ' ORDER BY d.entry_date DESC, d.id DESC'

    rows = db.execute(query, params).fetchall()
    classes = db.execute(
        "SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section",
        (sid,),
    ).fetchall()
    db.close()
    return jsonify({'entries': _rows(rows), 'classes': _rows(classes)})


@api_admin_bp.route('/diary', methods=['POST'])
@login_required(roles=ROLES)
def add_diary():
    """Admin/principal posts. Defaults to scope='school' (announcement).
    Can also post a class-level entry by providing class_id.
    """
    sid = _sid()
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    content = (data.get('content') or '').strip()
    if not title or not content:
        return jsonify({'error': 'title and content are required'}), 400

    class_id = data.get('class_id')
    scope = 'class' if class_id else 'school'
    entry_date = (data.get('entry_date') or datetime.date.today().isoformat()).strip()
    link = (data.get('link') or '').strip() or None

    db = get_db()
    if class_id:
        cls = db.execute('SELECT id FROM classes WHERE id=? AND school_id=?',
                         (class_id, sid)).fetchone()
        if not cls:
            db.close()
            return jsonify({'error': 'Class not found'}), 404

    cursor = db.execute('''
        INSERT INTO diary_entries (school_id, scope, class_id, subject_id, title, content, link, entry_date, posted_by)
        VALUES (?,?,?,?,?,?,?,?,?)
    ''', (sid, scope, class_id, data.get('subject_id'), title, content, link, entry_date, _uid()))
    db.commit()
    new_id = cursor.lastrowid
    db.close()
    log_action(sid, _uid(), 'ADD_DIARY', f'[{scope}] {title}')
    return jsonify({'id': new_id, 'message': 'Posted'}), 201


@api_admin_bp.route('/diary/<int:entry_id>', methods=['PUT'])
@login_required(roles=ROLES)
def update_diary(entry_id):
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    entry = db.execute('SELECT * FROM diary_entries WHERE id=? AND school_id=?',
                       (entry_id, sid)).fetchone()
    if not entry:
        db.close()
        return jsonify({'error': 'Entry not found'}), 404
    title = (data.get('title') or entry['title']).strip()
    content = (data.get('content') or entry['content']).strip()
    link = data.get('link', entry['link'])
    entry_date = data.get('entry_date', entry['entry_date'])
    db.execute('''
        UPDATE diary_entries SET title=?, content=?, link=?, entry_date=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND school_id=?
    ''', (title, content, link, entry_date, entry_id, sid))
    db.commit()
    db.close()
    return jsonify({'message': 'Updated'})


@api_admin_bp.route('/diary/<int:entry_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_diary(entry_id):
    sid = _sid()
    db = get_db()
    entry = db.execute('SELECT title FROM diary_entries WHERE id=? AND school_id=?',
                       (entry_id, sid)).fetchone()
    if not entry:
        db.close()
        return jsonify({'error': 'Entry not found'}), 404
    db.execute('DELETE FROM diary_entries WHERE id=? AND school_id=?', (entry_id, sid))
    db.commit()
    db.close()
    log_action(sid, _uid(), 'DELETE_DIARY', entry['title'])
    return jsonify({'message': 'Deleted'})


# ─── FEES: HEADS (per class / academic year) ─────────────────────────────────
@api_admin_bp.route('/fees/heads', methods=['GET'])
@login_required(roles=ROLES)
def list_fee_heads():
    sid = _sid()
    class_id = request.args.get('class_id')
    db = get_db()
    query = '''
        SELECT h.id, h.class_id, h.academic_year, h.name, h.amount, h.cycle, h.created_at,
               c.name AS class_name, c.section
        FROM fee_heads h
        JOIN classes c ON c.id = h.class_id
        WHERE h.school_id=?
    '''
    params = [sid]
    if class_id:
        query += ' AND h.class_id=?'
        params.append(class_id)
    query += ' ORDER BY c.name, c.section, h.cycle, h.name'
    heads = db.execute(query, params).fetchall()
    classes = db.execute(
        "SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section",
        (sid,),
    ).fetchall()
    db.close()
    return jsonify({'heads': _rows(heads), 'classes': _rows(classes)})


@api_admin_bp.route('/fees/heads', methods=['POST'])
@login_required(roles=ROLES)
def add_fee_head():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    class_id = data.get('class_id')
    cycle = (data.get('cycle') or 'annual').strip()
    try:
        amount = float(data.get('amount') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': 'amount must be a number'}), 400
    if not name or not class_id:
        return jsonify({'error': 'name and class_id are required'}), 400
    if cycle not in ('annual', 'monthly'):
        return jsonify({'error': "cycle must be 'annual' or 'monthly'"}), 400
    if amount < 0:
        return jsonify({'error': 'amount must be >= 0'}), 400

    db = get_db()
    # Sanity check: class belongs to this school
    cls = db.execute('SELECT id, academic_year FROM classes WHERE id=? AND school_id=?',
                     (class_id, sid)).fetchone()
    if not cls:
        db.close()
        return jsonify({'error': 'Class not found'}), 404
    academic_year = (data.get('academic_year') or cls['academic_year'] or '').strip() or None
    cursor = db.execute('''
        INSERT INTO fee_heads (school_id, class_id, academic_year, name, amount, cycle)
        VALUES (?,?,?,?,?,?)
    ''', (sid, class_id, academic_year, name, amount, cycle))
    db.commit()
    new_id = cursor.lastrowid
    db.close()
    log_action(sid, _uid(), 'ADD_FEE_HEAD', f'{name} ({cycle}) ₹{amount} (api)')
    return jsonify({'id': new_id, 'message': 'Fee head added'}), 201


@api_admin_bp.route('/fees/heads/<int:head_id>', methods=['PUT'])
@login_required(roles=ROLES)
def update_fee_head(head_id):
    sid = _sid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    head = db.execute('SELECT * FROM fee_heads WHERE id=? AND school_id=?',
                      (head_id, sid)).fetchone()
    if not head:
        db.close()
        return jsonify({'error': 'Fee head not found'}), 404
    name = (data.get('name') or head['name']).strip()
    cycle = (data.get('cycle') or head['cycle']).strip()
    if cycle not in ('annual', 'monthly'):
        db.close()
        return jsonify({'error': "cycle must be 'annual' or 'monthly'"}), 400
    try:
        amount = float(data.get('amount')) if 'amount' in data else head['amount']
    except (TypeError, ValueError):
        db.close()
        return jsonify({'error': 'amount must be a number'}), 400
    academic_year = data.get('academic_year', head['academic_year'])
    db.execute('''
        UPDATE fee_heads SET name=?, amount=?, cycle=?, academic_year=?
        WHERE id=? AND school_id=?
    ''', (name, amount, cycle, academic_year, head_id, sid))
    db.commit()
    db.close()
    log_action(sid, _uid(), 'UPDATE_FEE_HEAD', f'{name} (api)')
    return jsonify({'message': 'Fee head updated'})


@api_admin_bp.route('/fees/heads/<int:head_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_fee_head(head_id):
    sid = _sid()
    db = get_db()
    head = db.execute('SELECT name FROM fee_heads WHERE id=? AND school_id=?',
                      (head_id, sid)).fetchone()
    if not head:
        db.close()
        return jsonify({'error': 'Fee head not found'}), 404
    paid_count = db.execute('SELECT COUNT(*) c FROM fee_payments WHERE fee_head_id=?',
                            (head_id,)).fetchone()['c']
    if paid_count > 0:
        db.close()
        return jsonify({'error': f'Cannot delete — {paid_count} payment(s) recorded against this head. Delete payments first.'}), 400
    db.execute('DELETE FROM fee_heads WHERE id=? AND school_id=?', (head_id, sid))
    db.commit()
    db.close()
    log_action(sid, _uid(), 'DELETE_FEE_HEAD', f"{head['name']} (api)")
    return jsonify({'message': 'Fee head deleted'})


def _months_in_year(academic_year):
    """Return list of YYYY-MM strings covering an academic year (e.g. '2025-2026' -> Jun 2025 .. May 2026).
    Falls back to a 12-month window starting at the current month if academic_year is malformed."""
    try:
        start_year, _ = academic_year.split('-', 1)
        start_year = int(start_year)
        return [f"{start_year + (m >= 12)}-{((m % 12) + 1):02d}" for m in range(5, 17)]  # Jun..May
    except Exception:
        today = datetime.date.today()
        return [f"{today.year + ((today.month - 1 + i) // 12)}-{(((today.month - 1 + i) % 12) + 1):02d}" for i in range(12)]


def _student_fee_breakdown(db, sid, student_id):
    """Compute per-head dues and payments for one student. Returns dict with heads, payments, totals."""
    # Find student's current class
    row = db.execute('''
        SELECT sc.class_id, c.academic_year
        FROM student_classes sc
        JOIN classes c ON c.id = sc.class_id
        WHERE sc.student_id=? AND c.school_id=?
        LIMIT 1
    ''', (student_id, sid)).fetchone()
    if not row:
        return {'heads': [], 'payments': [], 'totals': {'total': 0, 'paid': 0, 'due': 0}, 'class_id': None}

    class_id = row['class_id']
    academic_year = row['academic_year']
    heads = db.execute('''
        SELECT id, name, amount, cycle, academic_year
        FROM fee_heads WHERE school_id=? AND class_id=?
        ORDER BY cycle, name
    ''', (sid, class_id)).fetchall()

    payments = db.execute('''
        SELECT p.id, p.fee_head_id, p.month, p.amount, p.paid_date, p.mode, p.receipt_no, p.remarks, p.created_at,
               h.name AS head_name, h.cycle AS head_cycle,
               u.name AS collected_by_name
        FROM fee_payments p
        JOIN fee_heads h ON h.id = p.fee_head_id
        LEFT JOIN users u ON u.id = p.collected_by
        WHERE p.school_id=? AND p.student_id=?
        ORDER BY p.paid_date DESC, p.id DESC
    ''', (sid, student_id)).fetchall()

    # Build per-head summary
    months = _months_in_year(academic_year) if academic_year else _months_in_year('')
    head_summaries = []
    grand_total = 0.0
    grand_paid = 0.0
    for h in heads:
        head_dict = dict(h)
        head_payments = [p for p in payments if p['fee_head_id'] == h['id']]
        if h['cycle'] == 'monthly':
            total = float(h['amount']) * 12
            month_rows = []
            for m in months:
                m_paid = sum(float(p['amount']) for p in head_payments if p['month'] == m)
                month_rows.append({
                    'month': m,
                    'amount': float(h['amount']),
                    'paid': m_paid,
                    'due': max(0.0, float(h['amount']) - m_paid),
                    'status': 'paid' if m_paid >= float(h['amount']) else ('partial' if m_paid > 0 else 'pending'),
                })
            paid = sum(r['paid'] for r in month_rows)
            head_dict['months'] = month_rows
        else:
            total = float(h['amount'])
            paid = sum(float(p['amount']) for p in head_payments if (p['month'] is None or p['month'] == ''))
            head_dict['months'] = None
        head_dict['amount'] = float(h['amount'])
        head_dict['total'] = total
        head_dict['paid'] = paid
        head_dict['due'] = max(0.0, total - paid)
        head_dict['status'] = 'paid' if paid >= total else ('partial' if paid > 0 else 'pending')
        head_summaries.append(head_dict)
        grand_total += total
        grand_paid += paid

    return {
        'heads': head_summaries,
        'payments': _rows(payments),
        'class_id': class_id,
        'academic_year': academic_year,
        'totals': {
            'total': grand_total,
            'paid': grand_paid,
            'due': max(0.0, grand_total - grand_paid),
        },
    }


# ─── FEES: STUDENTS LIST WITH DUES SUMMARY ───────────────────────────────────
@api_admin_bp.route('/fees/students', methods=['GET'])
@login_required(roles=ROLES)
def list_fee_students():
    sid = _sid()
    class_id = request.args.get('class_id')
    db = get_db()
    query = '''
        SELECT u.id, u.name, u.email, u.phone,
               c.id AS class_id, c.name AS class_name, c.section, sc.roll_no
        FROM users u
        JOIN student_classes sc ON sc.student_id = u.id
        JOIN classes c ON c.id = sc.class_id
        WHERE u.school_id=? AND u.role='student' AND u.is_active=1
    '''
    params = [sid]
    if class_id:
        query += ' AND c.id=?'
        params.append(class_id)
    query += ' ORDER BY c.name, c.section, sc.roll_no, u.name'
    students = db.execute(query, params).fetchall()

    # For each student, compute totals (light query — sums)
    result = []
    for s in students:
        bk = _student_fee_breakdown(db, sid, s['id'])
        row = dict(s)
        row['total'] = bk['totals']['total']
        row['paid'] = bk['totals']['paid']
        row['due'] = bk['totals']['due']
        row['status'] = 'paid' if row['due'] <= 0 and row['total'] > 0 else ('partial' if row['paid'] > 0 else ('pending' if row['total'] > 0 else 'no_dues'))
        result.append(row)

    classes = db.execute(
        "SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section",
        (sid,),
    ).fetchall()
    db.close()
    return jsonify({'students': result, 'classes': _rows(classes)})


@api_admin_bp.route('/fees/students/<int:student_id>', methods=['GET'])
@login_required(roles=ROLES)
def fee_student_detail(student_id):
    sid = _sid()
    db = get_db()
    student = db.execute('''
        SELECT u.id, u.name, u.email, u.phone, u.gender, u.dob, u.address,
               c.id AS class_id, c.name AS class_name, c.section, c.academic_year, sc.roll_no,
               sch.name AS school_name, sch.address AS school_address, sch.phone AS school_phone, sch.logo AS school_logo
        FROM users u
        LEFT JOIN student_classes sc ON sc.student_id = u.id
        LEFT JOIN classes c ON c.id = sc.class_id
        LEFT JOIN schools sch ON sch.id = u.school_id
        WHERE u.id=? AND u.school_id=? AND u.role='student'
    ''', (student_id, sid)).fetchone()
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404
    breakdown = _student_fee_breakdown(db, sid, student_id)
    db.close()
    return jsonify({'student': _row(student), **breakdown})


# ─── FEES: RECORD PAYMENT ────────────────────────────────────────────────────
@api_admin_bp.route('/fees/payments', methods=['POST'])
@login_required(roles=ROLES)
def add_fee_payment():
    sid = _sid()
    data = request.get_json(silent=True) or {}
    student_id = data.get('student_id')
    fee_head_id = data.get('fee_head_id')
    month = (data.get('month') or '').strip() or None
    mode = (data.get('mode') or 'cash').strip()
    paid_date = (data.get('paid_date') or datetime.date.today().isoformat()).strip()
    remarks = (data.get('remarks') or '').strip() or None
    try:
        amount = float(data.get('amount') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': 'amount must be a number'}), 400
    if not student_id or not fee_head_id:
        return jsonify({'error': 'student_id and fee_head_id are required'}), 400
    if amount <= 0:
        return jsonify({'error': 'amount must be greater than 0'}), 400
    if mode not in ('cash', 'upi', 'cheque', 'card', 'bank_transfer', 'other'):
        return jsonify({'error': 'invalid mode'}), 400

    db = get_db()
    # Sanity: student + head belong to this school
    head = db.execute('SELECT * FROM fee_heads WHERE id=? AND school_id=?',
                      (fee_head_id, sid)).fetchone()
    if not head:
        db.close()
        return jsonify({'error': 'Fee head not found'}), 404
    student = db.execute("SELECT id FROM users WHERE id=? AND school_id=? AND role='student'",
                         (student_id, sid)).fetchone()
    if not student:
        db.close()
        return jsonify({'error': 'Student not found'}), 404
    if head['cycle'] == 'monthly' and not month:
        db.close()
        return jsonify({'error': 'month is required for monthly fee heads (format YYYY-MM)'}), 400
    if head['cycle'] == 'annual':
        month = None

    cursor = db.execute('''
        INSERT INTO fee_payments (school_id, student_id, fee_head_id, month, amount, paid_date, mode, receipt_no, remarks, collected_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    ''', (sid, student_id, fee_head_id, month, amount, paid_date, mode, None, remarks, _uid()))
    pid = cursor.lastrowid
    receipt_no = f"RC-{sid}-{datetime.date.today().strftime('%Y%m%d')}-{pid}"
    db.execute('UPDATE fee_payments SET receipt_no=? WHERE id=?', (receipt_no, pid))
    db.commit()
    payment = db.execute('''
        SELECT p.*, h.name AS head_name, h.cycle AS head_cycle, u.name AS collected_by_name
        FROM fee_payments p
        JOIN fee_heads h ON h.id = p.fee_head_id
        LEFT JOIN users u ON u.id = p.collected_by
        WHERE p.id=?
    ''', (pid,)).fetchone()
    db.close()
    log_action(sid, _uid(), 'ADD_FEE_PAYMENT', f'₹{amount} for student #{student_id} head {head["name"]} (receipt {receipt_no})')
    return jsonify({'payment': _row(payment), 'message': 'Payment recorded'}), 201


@api_admin_bp.route('/fees/payments/<int:payment_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def delete_fee_payment(payment_id):
    sid = _sid()
    db = get_db()
    p = db.execute('SELECT * FROM fee_payments WHERE id=? AND school_id=?',
                   (payment_id, sid)).fetchone()
    if not p:
        db.close()
        return jsonify({'error': 'Payment not found'}), 404
    db.execute('DELETE FROM fee_payments WHERE id=? AND school_id=?', (payment_id, sid))
    db.commit()
    db.close()
    log_action(sid, _uid(), 'DELETE_FEE_PAYMENT', f'Receipt {p["receipt_no"]} (₹{p["amount"]}) reversed (api)')
    return jsonify({'message': 'Payment reversed'})


# ─── FEES: REPORTS (collection + defaulters) ─────────────────────────────────
@api_admin_bp.route('/fees/reports', methods=['GET'])
@login_required(roles=ROLES)
def fee_reports():
    sid = _sid()
    db = get_db()
    today = datetime.date.today()
    month_start = today.replace(day=1).isoformat()
    year_start = today.replace(month=1, day=1).isoformat()

    totals = {
        'today': db.execute(
            "SELECT COALESCE(SUM(amount),0) v FROM fee_payments WHERE school_id=? AND paid_date=?",
            (sid, today.isoformat()),
        ).fetchone()['v'],
        'this_month': db.execute(
            "SELECT COALESCE(SUM(amount),0) v FROM fee_payments WHERE school_id=? AND paid_date>=?",
            (sid, month_start),
        ).fetchone()['v'],
        'this_year': db.execute(
            "SELECT COALESCE(SUM(amount),0) v FROM fee_payments WHERE school_id=? AND paid_date>=?",
            (sid, year_start),
        ).fetchone()['v'],
        'all_time': db.execute(
            "SELECT COALESCE(SUM(amount),0) v FROM fee_payments WHERE school_id=?",
            (sid,),
        ).fetchone()['v'],
    }

    by_mode = db.execute('''
        SELECT mode, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
        FROM fee_payments WHERE school_id=?
        GROUP BY mode ORDER BY total DESC
    ''', (sid,)).fetchall()

    by_class = db.execute('''
        SELECT c.id, c.name, c.section,
               COUNT(DISTINCT p.id) AS payment_count,
               COALESCE(SUM(p.amount),0) AS collected
        FROM classes c
        LEFT JOIN fee_heads h ON h.class_id = c.id
        LEFT JOIN fee_payments p ON p.fee_head_id = h.id
        WHERE c.school_id=?
        GROUP BY c.id ORDER BY c.name, c.section
    ''', (sid,)).fetchall()

    recent = db.execute('''
        SELECT p.id, p.amount, p.paid_date, p.mode, p.receipt_no,
               u.name AS student_name, h.name AS head_name,
               c.name AS class_name, c.section
        FROM fee_payments p
        JOIN users u ON u.id = p.student_id
        JOIN fee_heads h ON h.id = p.fee_head_id
        LEFT JOIN student_classes sc ON sc.student_id = p.student_id
        LEFT JOIN classes c ON c.id = sc.class_id
        WHERE p.school_id=?
        ORDER BY p.paid_date DESC, p.id DESC LIMIT 20
    ''', (sid,)).fetchall()

    # Defaulters — compute via _student_fee_breakdown for each active student. May be slow on huge schools;
    # acceptable for typical SMB scale (a few hundred students).
    students = db.execute('''
        SELECT u.id, u.name, u.phone, c.name AS class_name, c.section, sc.roll_no
        FROM users u
        JOIN student_classes sc ON sc.student_id = u.id
        JOIN classes c ON c.id = sc.class_id
        WHERE u.school_id=? AND u.role='student' AND u.is_active=1
    ''', (sid,)).fetchall()
    defaulters = []
    for s in students:
        bk = _student_fee_breakdown(db, sid, s['id'])
        if bk['totals']['due'] > 0:
            d = dict(s)
            d['total'] = bk['totals']['total']
            d['paid'] = bk['totals']['paid']
            d['due'] = bk['totals']['due']
            defaulters.append(d)
    defaulters.sort(key=lambda x: -x['due'])

    db.close()
    return jsonify({
        'totals': totals,
        'by_mode': _rows(by_mode),
        'by_class': _rows(by_class),
        'recent': _rows(recent),
        'defaulters': defaulters[:100],
    })
