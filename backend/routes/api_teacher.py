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
    """Smart check-in/out:
    - No row for today          → create with check_in (status=present, late if past cutoff)
    - Row exists w/o check_out  → set check_out
    - Row already has check_out → return 409 (already done)
    """
    sid = _sid()
    uid = _uid()
    today = datetime.date.today().isoformat()
    now = datetime.datetime.now().strftime('%H:%M')

    db = get_db()
    school = db.execute("SELECT late_cutoff_time FROM schools WHERE id=?", (sid,)).fetchone()
    late_cutoff = school['late_cutoff_time'] if school and school['late_cutoff_time'] else '09:00'

    existing = db.execute(
        "SELECT * FROM staff_attendance WHERE staff_id=? AND date=?",
        (uid, today),
    ).fetchone()

    if not existing:
        status = 'late' if now > late_cutoff else 'present'
        db.execute(
            "INSERT INTO staff_attendance (staff_id, school_id, date, check_in, status, marked_by) VALUES (?,?,?,?,?,?)",
            (uid, sid, today, now, status, uid),
        )
        db.commit()
        db.close()
        return jsonify({
            'action': 'check_in',
            'message': f'Checked in at {now}' + (' (late)' if status == 'late' else ''),
            'check_in': now,
            'check_out': None,
            'status': status,
            'date': today,
        })

    if existing['check_out']:
        db.close()
        return jsonify({
            'error': 'You have already checked out today.',
            'action': 'already_done',
            'check_in': existing['check_in'],
            'check_out': existing['check_out'],
            'status': existing['status'],
            'date': today,
        }), 409

    db.execute(
        "UPDATE staff_attendance SET check_out=? WHERE staff_id=? AND date=?",
        (now, uid, today),
    )
    db.commit()
    db.close()
    return jsonify({
        'action': 'check_out',
        'message': f'Checked out at {now}',
        'check_in': existing['check_in'],
        'check_out': now,
        'status': existing['status'],
        'date': today,
    })


@api_teacher_bp.route('/attendance-me', methods=['GET'])
@login_required(roles=ROLES)
def my_attendance():
    """Teacher's own attendance: today's state + recent 30 days history + month summary."""
    uid = _uid()
    today = datetime.date.today().isoformat()
    month_start = datetime.date.today().replace(day=1).isoformat()
    db = get_db()

    today_row = db.execute(
        "SELECT * FROM staff_attendance WHERE staff_id=? AND date=?",
        (uid, today),
    ).fetchone()

    history = db.execute(
        '''SELECT date, check_in, check_out, status, remarks
           FROM staff_attendance WHERE staff_id=?
           ORDER BY date DESC LIMIT 30''',
        (uid,),
    ).fetchall()

    month_summary = db.execute(
        '''SELECT
              COUNT(*) AS total_days,
              SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) AS late,
              SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) AS absent,
              SUM(CASE WHEN status='on_leave' THEN 1 ELSE 0 END) AS on_leave,
              SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END) AS half_day
           FROM staff_attendance WHERE staff_id=? AND date>=?''',
        (uid, month_start),
    ).fetchone()

    db.close()
    return jsonify({
        'today': _row(today_row),
        'history': _rows(history),
        'month_summary': _row(month_summary) or {},
        'date': today,
    })


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


# ─── DIARY ───────────────────────────────────────────────────────────────────
@api_teacher_bp.route('/diary', methods=['GET'])
@login_required(roles=ROLES)
def teacher_list_diary():
    """List entries the teacher can see: school-wide + any class they teach
    (or specifically the classes they own as class-teacher / teach a subject in).
    Filters: scope, class_id, mine (only my posts), from_date, to_date.
    """
    sid = _sid()
    uid = _uid()
    scope = request.args.get('scope')
    class_id = request.args.get('class_id', type=int)
    mine = request.args.get('mine') == '1'
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')

    db = get_db()
    # Classes this teacher is associated with (teaches a subject in, or class teacher of)
    my_classes = db.execute('''
        SELECT DISTINCT c.id, c.name, c.section
        FROM classes c
        LEFT JOIN subjects s ON s.class_id = c.id
        WHERE c.school_id=? AND (s.teacher_id=? OR c.class_teacher_id=?)
        ORDER BY c.name, c.section
    ''', (sid, uid, uid)).fetchall()
    my_class_ids = [c['id'] for c in my_classes]

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
    if mine:
        query += ' AND d.posted_by=?'
        params.append(uid)
    else:
        # Show school-wide announcements + entries in classes the teacher is associated with
        if my_class_ids:
            placeholders = ','.join(['?'] * len(my_class_ids))
            query += f" AND (d.scope='school' OR d.class_id IN ({placeholders}))"
            params.extend(my_class_ids)
        else:
            query += " AND d.scope='school'"
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

    entries = db.execute(query, params).fetchall()
    db.close()
    return jsonify({'entries': _rows(entries), 'my_classes': _rows(my_classes)})


@api_teacher_bp.route('/diary', methods=['POST'])
@login_required(roles=ROLES)
def teacher_add_diary():
    """Teacher posts a class-level entry. Must specify class_id, must be a class they teach."""
    sid = _sid()
    uid = _uid()
    data = request.get_json(silent=True) or {}
    class_id = data.get('class_id')
    title = (data.get('title') or '').strip()
    content = (data.get('content') or '').strip()
    if not class_id or not title or not content:
        return jsonify({'error': 'class_id, title, content are required'}), 400

    db = get_db()
    # Validate the teacher can post for this class
    can_post = db.execute('''
        SELECT 1 FROM classes c
        LEFT JOIN subjects s ON s.class_id = c.id
        WHERE c.id=? AND c.school_id=? AND (s.teacher_id=? OR c.class_teacher_id=?)
        LIMIT 1
    ''', (class_id, sid, uid, uid)).fetchone()
    if not can_post:
        db.close()
        return jsonify({'error': "You don't teach this class"}), 403

    subject_id = data.get('subject_id')
    if subject_id:
        ok = db.execute(
            'SELECT 1 FROM subjects WHERE id=? AND class_id=? AND teacher_id=?',
            (subject_id, class_id, uid),
        ).fetchone()
        if not ok:
            db.close()
            return jsonify({'error': "You don't teach this subject"}), 403

    entry_date = (data.get('entry_date') or datetime.date.today().isoformat()).strip()
    link = (data.get('link') or '').strip() or None

    cursor = db.execute('''
        INSERT INTO diary_entries (school_id, scope, class_id, subject_id, title, content, link, entry_date, posted_by)
        VALUES (?,?,?,?,?,?,?,?,?)
    ''', (sid, 'class', class_id, subject_id, title, content, link, entry_date, uid))
    db.commit()
    new_id = cursor.lastrowid
    db.close()
    return jsonify({'id': new_id, 'message': 'Posted'}), 201


@api_teacher_bp.route('/diary/<int:entry_id>', methods=['PUT'])
@login_required(roles=ROLES)
def teacher_update_diary(entry_id):
    """Teacher can only edit their own entries."""
    sid = _sid()
    uid = _uid()
    data = request.get_json(silent=True) or {}
    db = get_db()
    entry = db.execute(
        'SELECT * FROM diary_entries WHERE id=? AND school_id=? AND posted_by=?',
        (entry_id, sid, uid),
    ).fetchone()
    if not entry:
        db.close()
        return jsonify({'error': "Entry not found or you can't edit it"}), 404
    title = (data.get('title') or entry['title']).strip()
    content = (data.get('content') or entry['content']).strip()
    link = data.get('link', entry['link'])
    entry_date = data.get('entry_date', entry['entry_date'])
    db.execute('''
        UPDATE diary_entries SET title=?, content=?, link=?, entry_date=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    ''', (title, content, link, entry_date, entry_id))
    db.commit()
    db.close()
    return jsonify({'message': 'Updated'})


@api_teacher_bp.route('/diary/<int:entry_id>', methods=['DELETE'])
@login_required(roles=ROLES)
def teacher_delete_diary(entry_id):
    sid = _sid()
    uid = _uid()
    db = get_db()
    res = db.execute(
        'DELETE FROM diary_entries WHERE id=? AND school_id=? AND posted_by=?',
        (entry_id, sid, uid),
    )
    db.commit()
    deleted = res.rowcount
    db.close()
    if deleted == 0:
        return jsonify({'error': "Entry not found or you can't delete it"}), 404
    return jsonify({'message': 'Deleted'})
