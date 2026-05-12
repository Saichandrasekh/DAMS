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

    students = db.execute(query, params).fetchall()
    classes = db.execute("SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name, section", (sid,)).fetchall()
    db.close()
    return jsonify({'students': _rows(students), 'classes': _rows(classes)})


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
               (SELECT GROUP_CONCAT(s.name, ', ') FROM subjects s WHERE s.teacher_id=u.id) as subjects
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
    """Per-student list grouped by status for one class on a given date."""
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

    rows = db.execute('''
        SELECT u.id, u.name, sc.roll_no, u.phone,
               COALESCE(MAX(CASE
                   WHEN sa.status='present' THEN 3
                   WHEN sa.status='late'    THEN 2
                   WHEN sa.status='absent'  THEN 1
               END), 0) AS code,
               GROUP_CONCAT(DISTINCT sa.subject_id) AS subject_ids,
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

    buckets = {'present': [], 'late': [], 'absent': [], 'not_marked': []}
    for r in rows:
        bucket = (
            'present'    if r['code'] == 3 else
            'late'       if r['code'] == 2 else
            'absent'     if r['code'] == 1 else
            'not_marked'
        )
        buckets[bucket].append({
            'id': r['id'], 'name': r['name'], 'roll_no': r['roll_no'],
            'phone': r['phone'], 'remarks': r['remarks'],
        })
    db.close()
    return jsonify({'class': _row(cls), 'date': date, 'buckets': buckets})


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
