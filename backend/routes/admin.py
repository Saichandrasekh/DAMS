from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify, flash
from database.db import get_db
from middleware.auth import login_required, hash_password, log_action
import csv, io, datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def school_id():
    return session.get('school_id')

# ─── DASHBOARD ───────────────────────────────────────────────────────────────
@admin_bp.route('/dashboard')
@login_required(roles=['admin', 'principal'])
def dashboard():
    sid = school_id()
    db = get_db()
    today_str = __import__('datetime').date.today().isoformat()
    stats = {
        'students': db.execute("SELECT COUNT(*) as c FROM users WHERE school_id=? AND role='student' AND is_active=1", (sid,)).fetchone()['c'],
        'teachers': db.execute("SELECT COUNT(*) as c FROM users WHERE school_id=? AND role='teacher' AND is_active=1", (sid,)).fetchone()['c'],
        'classes':  db.execute("SELECT COUNT(*) as c FROM classes WHERE school_id=?", (sid,)).fetchone()['c'],
        'today_present': db.execute("SELECT COUNT(*) as c FROM student_attendance WHERE class_id IN (SELECT id FROM classes WHERE school_id=?) AND date=? AND status='present'", (sid, today_str)).fetchone()['c'],
        'today_absent':  db.execute("SELECT COUNT(*) as c FROM student_attendance WHERE class_id IN (SELECT id FROM classes WHERE school_id=?) AND date=? AND status='absent'", (sid, today_str)).fetchone()['c'],
    }
    recent_logs = db.execute('''
        SELECT l.*, u.name as user_name FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.school_id=? ORDER BY l.created_at DESC LIMIT 10
    ''', (sid,)).fetchall()
    school = db.execute("SELECT * FROM schools WHERE id=?", (sid,)).fetchone()
    db.close()
    return render_template('admin/dashboard.html', stats=stats, recent_logs=recent_logs, school=school)

# ─── STUDENTS ────────────────────────────────────────────────────────────────
@admin_bp.route('/students')
@login_required(roles=['admin', 'principal'])
def students():
    sid = school_id()
    db = get_db()
    
    # Get filters
    f_class_id = request.args.get('class_id')
    f_status = request.args.get('status')
    
    query = '''
        SELECT u.*, c.name as class_name, c.section, sc.roll_no
        FROM users u
        LEFT JOIN student_classes sc ON sc.student_id = u.id
        LEFT JOIN classes c ON c.id = sc.class_id
        WHERE u.school_id=? AND u.role='student'
    '''
    params = [sid]
    
    if f_class_id:
        query += " AND sc.class_id = ?"
        params.append(f_class_id)
    
    if f_status == 'active':
        query += " AND u.is_active = 1"
    elif f_status == 'inactive':
        query += " AND u.is_active = 0"
        
    query += " ORDER BY c.name, c.section, sc.roll_no, u.name"
    
    students_list = db.execute(query, params).fetchall()
    classes = db.execute("SELECT * FROM classes WHERE school_id=? ORDER BY name, section", (sid,)).fetchall()
    db.close()
    
    return render_template('admin/students.html', 
                           students=students_list, 
                           classes=classes,
                           filters={'class_id': f_class_id, 'status': f_status})

@admin_bp.route('/students/<int:student_id>/edit', methods=['GET', 'POST'])
@login_required(roles=['admin', 'principal'])
def edit_student(student_id):
    sid = school_id()
    db = get_db()
    student = db.execute("SELECT * FROM users WHERE id=? AND school_id=? AND role='student'", (student_id, sid)).fetchone()
    classes = db.execute("SELECT * FROM classes WHERE school_id=? ORDER BY name, section", (sid,)).fetchall()
    current_class = db.execute("SELECT * FROM student_classes WHERE student_id=?", (student_id,)).fetchone()

    if not student:
        db.close()
        flash('Student not found', 'error')
        return redirect(url_for('admin.students'))

    if request.method == 'POST':
        data = request.form
        try:
            db.execute(
                "UPDATE users SET name=?, email=?, phone=?, gender=?, dob=?, address=?, is_active=? WHERE id=? AND school_id=?",
                (data['name'], data['email'].lower(), data.get('phone'), data.get('gender'),
                 data.get('dob'), data.get('address'), 1 if 'is_active' in data else 0, student_id, sid)
            )
            if data.get('new_password'):
                db.execute("UPDATE users SET password=?, original_password=? WHERE id=?", 
                           (hash_password(data['new_password']), data['new_password'], student_id))
            if data.get('class_id'):
                db.execute("INSERT OR REPLACE INTO student_classes (student_id, class_id, roll_no) VALUES (?,?,?)",
                           (student_id, data['class_id'], data.get('roll_no')))
            db.commit()
            flash('Student updated successfully', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('admin.students'))

    db.close()
    return render_template('admin/edit_student.html', student=student, classes=classes, current_class=current_class)

@admin_bp.route('/students/add', methods=['GET', 'POST'])
@login_required(roles=['admin', 'principal'])
def add_student():
    sid = school_id()
    db = get_db()
    classes = db.execute("SELECT * FROM classes WHERE school_id=? ORDER BY name, section", (sid,)).fetchall()

    if request.method == 'POST':
        data = request.form
        try:
            cursor = db.execute('''
                INSERT INTO users (school_id, name, email, phone, password, original_password, role, gender, dob, address) 
                VALUES (?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(school_id, email) DO UPDATE SET
                    name=excluded.name,
                    phone=excluded.phone,
                    password=excluded.password,
                    original_password=excluded.original_password,
                    role=excluded.role,
                    gender=excluded.gender,
                    dob=excluded.dob,
                    address=excluded.address,
                    is_active=1
            ''', (sid, data['name'], data['email'].lower(), data.get('phone'),
                  hash_password(data['password']), data['password'], 'student',
                  data.get('gender'), data.get('dob'), data.get('address'))
            )
            student_id = cursor.lastrowid or db.execute("SELECT id FROM users WHERE school_id=? AND email=?", (sid, data['email'].lower())).fetchone()['id']
            if data.get('class_id'):
                db.execute(
                    "INSERT OR IGNORE INTO student_classes (student_id, class_id, roll_no) VALUES (?,?,?)",
                    (student_id, data['class_id'], data.get('roll_no'))
                )
            db.commit()
            log_action(sid, session['user_id'], 'ADD_STUDENT', data['name'])
            flash('Student added successfully', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('admin.students'))

    db.close()
    return render_template('admin/add_student.html', classes=classes)

@admin_bp.route('/students/import', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def import_students():
    sid = school_id()
    file = request.files.get('csv_file')
    if not file:
        flash('No file uploaded', 'error')
        return redirect(url_for('admin.students'))

    try:
        stream = io.StringIO(file.stream.read().decode("UTF-8"))
        reader = csv.DictReader(stream)
    except Exception as e:
        flash(f'Error reading file: {str(e)}', 'error')
        return redirect(url_for('admin.students'))

    db = get_db()
    count = 0
    errors = []
    
    # Pre-fetch classes for mapping names to IDs
    classes_map = {}
    classes_raw = db.execute("SELECT id, name, section FROM classes WHERE school_id=?", (sid,)).fetchall()
    for c in classes_raw:
        # Map both "Name" and "Name - Section"
        classes_map[c['name'].lower().strip()] = c['id']
        classes_map[f"{c['name']} - {c['section']}".lower().strip()] = c['id']

    # Read rows and normalize headers
    for line_idx, row in enumerate(reader, start=2): # line_idx starts at 2 (header is 1)
        # Normalize headers to lowercase
        n_row = {k.lower().strip().replace(' ', '_'): v for k, v in row.items()}
        
        try:
            name = n_row.get('name')
            email = n_row.get('email', '').lower().strip()
            password = n_row.get('password', 'Student@123')
            
            if not name or not email:
                errors.append(f"Row {line_idx}: Missing required name or email")
                continue

            # Class Mapping
            class_id = n_row.get('class_id')
            if not class_id and n_row.get('class'):
                class_name = n_row.get('class', '').lower().strip()
                # Try simple match or prefix match (e.g., "7th class" -> "7th")
                class_id = classes_map.get(class_name)
                if not class_id:
                    # Try partial match if exact fails
                    for name_key, cid in classes_map.items():
                        if name_key in class_name or class_name in name_key:
                            class_id = cid
                            break

            cursor = db.execute('''
                INSERT INTO users (school_id, name, email, phone, password, original_password, role, gender) 
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(school_id, email) DO UPDATE SET
                    name=excluded.name,
                    phone=excluded.phone,
                    password=excluded.password,
                    original_password=excluded.original_password,
                    role=excluded.role,
                    is_active=1
            ''', (sid, name, email, n_row.get('phone', ''),
                  hash_password(password), password, 'student', n_row.get('gender', ''))
            )
            
            uid = cursor.lastrowid or db.execute("SELECT id FROM users WHERE school_id=? AND email=?", (sid, email)).fetchone()['id']
            
            if class_id:
                db.execute("INSERT OR REPLACE INTO student_classes (student_id, class_id, roll_no) VALUES (?,?,?)",
                           (uid, class_id, n_row.get('roll_number', n_row.get('roll_no', ''))))
            
            count += 1
        except Exception as e:
            errors.append(f"Row {line_idx}: {str(e)}")
            
    db.commit()
    db.close()
    
    if errors:
        flash(f'Import completed with issues: {count} success, {len(errors)} failed. First error: {errors[0]}', 'warning')
    else:
        flash(f'Successfully imported {count} students!', 'success')
        
    return redirect(url_for('admin.students'))

@admin_bp.route('/students/<int:student_id>/delete', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def delete_student(student_id):
    db = get_db()
    sid = school_id()
    # Check if student exists and get their status
    student = db.execute("SELECT name, is_active FROM users WHERE id=? AND school_id=?", (student_id, sid)).fetchone()
    
    if student:
        if student['is_active']:
            # Stage 1: Soft Delete (Archive)
            db.execute("UPDATE users SET is_active=0 WHERE id=? AND school_id=?", (student_id, sid))
            log_action(sid, session['user_id'], 'ARCHIVE_STUDENT', student['name'])
            flash(f'Student {student["name"]} has been archived.', 'success')
        else:
            # Stage 2: Hard Delete (Permanent)
            # Database has ON DELETE CASCADE for student_classes and attendance
            db.execute("DELETE FROM users WHERE id=? AND school_id=?", (student_id, sid))
            log_action(sid, session['user_id'], 'PERMANENT_DELETE_STUDENT', student['name'])
            flash(f'Student {student["name"]} has been permanently deleted.', 'success')
        db.commit()
    else:
        flash('Student not found.', 'error')
    db.close()
    
@admin_bp.route('/students/purge-inactive', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def purge_inactive_students():
    db = get_db()
    sid = school_id()
    
    # Count how many we are about to delete
    count = db.execute("SELECT COUNT(*) as c FROM users WHERE school_id=? AND role='student' AND is_active=0", (sid,)).fetchone()['c']
    
    if count > 0:
        db.execute("DELETE FROM users WHERE school_id=? AND role='student' AND is_active=0", (sid,))
        db.commit()
        log_action(sid, session['user_id'], 'PURGE_INACTIVE_STUDENTS', f'Removed {count} students')
        flash(f'Successfully deleted {count} inactive students.', 'success')
    else:
        flash('No inactive students found to delete.', 'info')
        
    db.close()
    return redirect(url_for('admin.students'))

# ─── TEACHERS ────────────────────────────────────────────────────────────────
@admin_bp.route('/teachers')
@login_required(roles=['admin', 'principal'])
def teachers():
    sid = school_id()
    db = get_db()
    teachers = db.execute('''
        SELECT u.*,
               (SELECT GROUP_CONCAT(s.name, ', ') FROM subjects s WHERE s.teacher_id=u.id) as subjects
        FROM users u WHERE u.school_id=? AND u.role='teacher'
        ORDER BY u.name
    ''', (sid,)).fetchall()
    db.close()
    return render_template('admin/teachers.html', teachers=teachers)

@admin_bp.route('/teachers/add', methods=['GET', 'POST'])
@login_required(roles=['admin', 'principal'])
def add_teacher():
    sid = school_id()
    if request.method == 'POST':
        data = request.form
        db = get_db()
        try:
            db.execute('''
                INSERT INTO users (school_id, name, email, phone, password, original_password, role, gender) 
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(school_id, email) DO UPDATE SET
                    name=excluded.name,
                    phone=excluded.phone,
                    password=excluded.password,
                    original_password=excluded.original_password,
                    role=excluded.role,
                    gender=excluded.gender,
                    is_active=1
            ''', (sid, data['name'], data['email'].lower(), data.get('phone'),
                  hash_password(data['password']), data['password'], 'teacher', data.get('gender'))
            )
            db.commit()
            flash('Teacher added successfully', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('admin.teachers'))
    return render_template('admin/add_teacher.html')

@admin_bp.route('/teachers/<int:teacher_id>/edit', methods=['GET', 'POST'])
@login_required(roles=['admin', 'principal'])
def edit_teacher(teacher_id):
    sid = school_id()
    db = get_db()
    teacher = db.execute("SELECT * FROM users WHERE id=? AND school_id=? AND role='teacher'", (teacher_id, sid)).fetchone()
    
    if not teacher:
        db.close()
        flash('Teacher not found', 'error')
        return redirect(url_for('admin.teachers'))

    if request.method == 'POST':
        data = request.form
        try:
            db.execute(
                "UPDATE users SET name=?, email=?, phone=?, gender=?, is_active=? WHERE id=? AND school_id=?",
                (data['name'], data['email'].lower(), data.get('phone'), data.get('gender'), 
                 1 if 'is_active' in data else 0, teacher_id, sid)
            )
            if data.get('new_password'):
                db.execute("UPDATE users SET password=?, original_password=? WHERE id=?", 
                           (hash_password(data['new_password']), data['new_password'], teacher_id))
            db.commit()
            flash('Teacher updated successfully', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('admin.teachers'))

    db.close()
    return render_template('admin/edit_teacher.html', teacher=teacher)

@admin_bp.route('/teachers/<int:teacher_id>/delete', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def delete_teacher(teacher_id):
    sid = school_id()
    db = get_db()
    db.execute("UPDATE users SET is_active=0 WHERE id=? AND school_id=? AND role='teacher'", (teacher_id, sid))
    db.commit()
    db.close()
    flash('Teacher removed successfully', 'success')
    return redirect(url_for('admin.teachers'))

# ─── CLASSES ─────────────────────────────────────────────────────────────────
@admin_bp.route('/classes')
@login_required(roles=['admin', 'principal'])
def classes():
    sid = school_id()
    db = get_db()
    classes = db.execute('''
        SELECT c.*, u.name as class_teacher_name,
               (SELECT COUNT(*) FROM student_classes sc WHERE sc.class_id=c.id) as student_count,
               (SELECT COUNT(*) FROM subjects s WHERE s.class_id=c.id) as subject_count
        FROM classes c LEFT JOIN users u ON c.class_teacher_id=u.id
        WHERE c.school_id=? ORDER BY c.name, c.section
    ''', (sid,)).fetchall()
    teachers = db.execute("SELECT id, name FROM users WHERE school_id=? AND role='teacher' AND is_active=1", (sid,)).fetchall()
    db.close()
    return render_template('admin/classes.html', classes=classes, teachers=teachers)

@admin_bp.route('/classes/add', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def add_class():
    sid = school_id()
    data = request.form
    db = get_db()
    try:
        db.execute(
            "INSERT INTO classes (school_id, name, section, academic_year, class_teacher_id) VALUES (?,?,?,?,?)",
            (sid, data['name'], data['section'], data.get('academic_year'), data.get('class_teacher_id') or None)
        )
        db.commit()
        flash('Class added successfully', 'success')
    except Exception as e:
        db.rollback()
        flash(f'Error: {str(e)}', 'error')
    finally:
        db.close()
    return redirect(url_for('admin.classes'))

@admin_bp.route('/classes/<int:class_id>/edit', methods=['GET', 'POST'])
@login_required(roles=['admin', 'principal'])
def edit_class(class_id):
    sid = school_id()
    db = get_db()
    cls = db.execute("SELECT * FROM classes WHERE id=? AND school_id=?", (class_id, sid)).fetchone()
    teachers = db.execute("SELECT id, name FROM users WHERE school_id=? AND role='teacher' AND is_active=1", (sid,)).fetchall()

    if not cls:
        db.close()
        flash('Class not found', 'error')
        return redirect(url_for('admin.classes'))

    if request.method == 'POST':
        data = request.form
        try:
            db.execute('''
                UPDATE classes SET name=?, section=?, academic_year=?, class_teacher_id=?
                WHERE id=? AND school_id=?
            ''', (data['name'], data['section'], data.get('academic_year'), 
                  data.get('class_teacher_id') or None, class_id, sid))
            db.commit()
            flash('Class updated successfully', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('admin.classes'))

    db.close()
    return render_template('admin/edit_class.html', cls=cls, teachers=teachers)

@admin_bp.route('/classes/<int:class_id>/delete', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def delete_class(class_id):
    sid = school_id()
    db = get_db()
    try:
        # Check if students are assigned to this class
        has_students = db.execute("SELECT COUNT(*) as c FROM student_classes WHERE class_id=?", (class_id,)).fetchone()['c']
        if has_students > 0:
            flash('Cannot delete class with assigned students. Please reassign students first.', 'error')
        else:
            db.execute("DELETE FROM classes WHERE id=? AND school_id=?", (class_id, sid))
            db.commit()
            flash('Class deleted successfully', 'success')
    except Exception as e:
        db.rollback()
        flash(f'Error: {str(e)}', 'error')
    finally:
        db.close()
    return redirect(url_for('admin.classes'))

# ─── SUBJECTS ────────────────────────────────────────────────────────────────
@admin_bp.route('/subjects')
@login_required(roles=['admin', 'principal'])
def subjects():
    sid = school_id()
    db = get_db()
    subjects = db.execute('''
        SELECT s.*, c.name as class_name, c.section, u.name as teacher_name
        FROM subjects s
        JOIN classes c ON s.class_id=c.id
        LEFT JOIN users u ON s.teacher_id=u.id
        WHERE s.school_id=? ORDER BY c.name, c.section, s.name
    ''', (sid,)).fetchall()
    classes = db.execute("SELECT * FROM classes WHERE school_id=?", (sid,)).fetchall()
    teachers = db.execute("SELECT id, name FROM users WHERE school_id=? AND role='teacher' AND is_active=1", (sid,)).fetchall()
    db.close()
    return render_template('admin/subjects.html', subjects=subjects, classes=classes, teachers=teachers)

@admin_bp.route('/subjects/add', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def add_subject():
    sid = school_id()
    data = request.form
    db = get_db()
    try:
        db.execute(
            "INSERT INTO subjects (school_id, class_id, name, teacher_id) VALUES (?,?,?,?)",
            (sid, data['class_id'], data['name'], data.get('teacher_id') or None)
        )
        db.commit()
        flash('Subject added', 'success')
    except Exception as e:
        db.rollback()
        flash(f'Error: {str(e)}', 'error')
    finally:
        db.close()
    return redirect(url_for('admin.subjects'))

@admin_bp.route('/subjects/<int:subject_id>/delete', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def delete_subject(subject_id):
    sid = school_id()
    db = get_db()
    try:
        db.execute("DELETE FROM subjects WHERE id=? AND school_id=?", (subject_id, sid))
        db.commit()
        flash('Subject removed successfully', 'success')
    except Exception as e:
        db.rollback()
        flash(f'Error: {str(e)}', 'error')
    finally:
        db.close()
    return redirect(url_for('admin.subjects'))

@admin_bp.route('/subjects/<int:subject_id>/edit', methods=['GET', 'POST'])
@login_required(roles=['admin', 'principal'])
def edit_subject(subject_id):
    sid = school_id()
    db = get_db()
    subject = db.execute("SELECT * FROM subjects WHERE id=? AND school_id=?", (subject_id, sid)).fetchone()
    classes = db.execute("SELECT * FROM classes WHERE school_id=?", (sid,)).fetchall()
    teachers = db.execute("SELECT id, name FROM users WHERE school_id=? AND role='teacher' AND is_active=1", (sid,)).fetchall()

    if not subject:
        db.close()
        flash('Subject not found', 'error')
        return redirect(url_for('admin.subjects'))

    if request.method == 'POST':
        data = request.form
        try:
            db.execute('''
                UPDATE subjects SET name=?, class_id=?, teacher_id=?
                WHERE id=? AND school_id=?
            ''', (data['name'], data['class_id'], data.get('teacher_id') or None, subject_id, sid))
            db.commit()
            flash('Subject updated successfully', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('admin.subjects'))

    db.close()
    return render_template('admin/edit_subject.html', subject=subject, classes=classes, teachers=teachers)

# ─── SCHOOL SETTINGS ─────────────────────────────────────────────────────────
@admin_bp.route('/settings', methods=['GET', 'POST'])
@login_required(roles=['admin', 'principal'])
def settings():
    sid = school_id()
    db = get_db()
    school = db.execute("SELECT * FROM schools WHERE id=?", (sid,)).fetchone()

    if request.method == 'POST':
        data = request.form
        db.execute('''UPDATE schools SET primary_color=?, academic_year=?, periods_per_day=?,
                      min_attendance_pct=?, late_cutoff_time=?, phone=?, email=?, address=?
                      WHERE id=?''',
                   (data.get('primary_color', '#4f46e5'),
                    data.get('academic_year'), data.get('periods_per_day', 8),
                    data.get('min_attendance_pct', 75), data.get('late_cutoff_time', '09:00'),
                    data.get('phone'), data.get('email'), data.get('address'), sid))
        db.commit()
        flash('Settings saved', 'success')
        school = db.execute("SELECT * FROM schools WHERE id=?", (sid,)).fetchone()

    db.close()
    return render_template('admin/settings.html', school=school)

# ─── HOLIDAYS ────────────────────────────────────────────────────────────────
@admin_bp.route('/holidays')
@login_required(roles=['admin', 'principal'])
def holidays():
    sid = school_id()
    db = get_db()
    holidays = db.execute("SELECT * FROM holidays WHERE school_id=? ORDER BY date", (sid,)).fetchall()
    db.close()
    return render_template('admin/holidays.html', holidays=holidays)

@admin_bp.route('/holidays/add', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def add_holiday():
    sid = school_id()
    data = request.form
    db = get_db()
    try:
        db.execute("INSERT OR REPLACE INTO holidays (school_id, date, name) VALUES (?,?,?)",
                   (sid, data['date'], data['name']))
        db.commit()
        flash('Holiday added', 'success')
    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
    finally:
        db.close()
    return redirect(url_for('admin.holidays'))

@admin_bp.route('/holidays/<int:hid>/delete', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def delete_holiday(hid):
    sid = school_id()
    db = get_db()
    db.execute("DELETE FROM holidays WHERE id=? AND school_id=?", (hid, sid))
    db.commit()
    db.close()
    flash('Holiday removed', 'success')
    return redirect(url_for('admin.holidays'))

# ─── STAFF ATTENDANCE VIEW ───────────────────────────────────────────────────
@admin_bp.route('/staff-attendance')
@login_required(roles=['admin', 'principal'])
def staff_attendance():
    sid = school_id()
    date_filter = request.args.get('date', __import__('datetime').date.today().isoformat())
    db = get_db()
    records = db.execute('''
        SELECT sa.*, u.name as staff_name, u.role
        FROM staff_attendance sa
        JOIN users u ON sa.staff_id = u.id
        WHERE sa.school_id=? AND sa.date=?
        ORDER BY u.role, u.name
    ''', (sid, date_filter)).fetchall()
    all_staff = db.execute(
        "SELECT id, name, role FROM users WHERE school_id=? AND role IN ('teacher','admin','principal') AND is_active=1",
        (sid,)
    ).fetchall()
    db.close()
    return render_template('admin/staff_attendance.html',
                           records=records, all_staff=all_staff, date_filter=date_filter)

@admin_bp.route('/staff-attendance/mark', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def mark_staff_attendance():
    sid = school_id()
    data = request.json
    db = get_db()
    try:
        db.execute('''
            INSERT OR REPLACE INTO staff_attendance
            (staff_id, school_id, date, status, check_in, check_out, remarks, marked_by)
            VALUES (?,?,?,?,?,?,?,?)
        ''', (data['staff_id'], sid, data['date'], data['status'],
              data.get('check_in'), data.get('check_out'),
              data.get('remarks'), session['user_id']))
        db.commit()
        db.close()
        return jsonify({'message': 'Saved'})
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 400
# ─── EXAMS ───────────────────────────────────────────────────────────────────
@admin_bp.route('/exams')
@login_required(roles=['admin', 'principal'])
def exams():
    sid = school_id()
    db = get_db()
    exams_list = db.execute("SELECT * FROM exams WHERE school_id=? ORDER BY created_at DESC", (sid,)).fetchall()
    db.close()
    return render_template('admin/exams.html', exams=exams_list)

@admin_bp.route('/exams/add', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def add_exam():
    sid = school_id()
    data = request.form
    db = get_db()
    try:
        db.execute(
            "INSERT INTO exams (school_id, name, exam_date, academic_year) VALUES (?,?,?,?)",
            (sid, data['name'], data['exam_date'], data.get('academic_year', '2025-2026'))
        )
        db.commit()
        log_action(sid, session['user_id'], 'ADD_EXAM', data['name'])
        flash('Exam created successfully', 'success')
    except Exception as e:
        db.rollback()
        flash(f'Error: {str(e)}', 'error')
    finally:
        db.close()
    return redirect(url_for('admin.exams'))

@admin_bp.route('/exams/<int:exam_id>/toggle-publish', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def toggle_exam_publish(exam_id):
    sid = school_id()
    db = get_db()
    exam = db.execute("SELECT is_published FROM exams WHERE id=? AND school_id=?", (exam_id, sid)).fetchone()
    if exam:
        new_status = 0 if exam['is_published'] else 1
        db.execute("UPDATE exams SET is_published=? WHERE id=? AND school_id=?", (new_status, exam_id, sid))
        db.commit()
        status_text = 'published' if new_status else 'unpublished'
        flash(f'Exam results {status_text} successfully.', 'success')
    db.close()
    return redirect(url_for('admin.exams'))

@admin_bp.route('/exams/<int:exam_id>/delete', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def delete_exam(exam_id):
    sid = school_id()
    db = get_db()
    db.execute("DELETE FROM exams WHERE id=? AND school_id=?", (exam_id, sid))
    db.commit()
    db.close()
    flash('Exam deleted', 'success')
    return redirect(url_for('admin.exams'))
# ─── TIMETABLE ───────────────────────────────────────────────────────────────
@admin_bp.route('/timetable')
@login_required(roles=['admin', 'principal'])
def timetable():
    sid = school_id()
    class_id = request.args.get('class_id')
    db = get_db()
    
    # Get all classes for the school
    classes = db.execute("SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name", (sid,)).fetchall()
    
    # Get subjects for the selected class
    subjects = []
    if class_id:
        subjects = db.execute("SELECT id, name FROM subjects WHERE class_id=?", (class_id,)).fetchall()
        
    # Get school settings (for period count)
    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    
    # Get existing timetable records
    timetable_data = {}
    if class_id:
        records = db.execute("SELECT * FROM timetable WHERE class_id=?", (class_id,)).fetchall()
        for r in records:
            key = f"{r['day_of_week']}-{r['period_no']}"
            timetable_data[key] = r['subject_id']
            
    db.close()
    return render_template('admin/timetable.html', 
                           classes=classes, 
                           subjects=subjects, 
                           class_id=int(class_id) if class_id else None,
                           periods=school['periods_per_day'],
                           data=timetable_data)

@admin_bp.route('/timetable/update', methods=['POST'])
@login_required(roles=['admin', 'principal'])
def update_timetable():
    data = request.json
    class_id = data.get('class_id')
    day = data.get('day')
    period = data.get('period')
    subject_id = data.get('subject_id')
    
    db = get_db()
    try:
        if subject_id:
            db.execute('''
                INSERT OR REPLACE INTO timetable (class_id, subject_id, day_of_week, period_no)
                VALUES (?,?,?,?)
            ''', (class_id, subject_id, day, period))
        else:
            db.execute('''
                DELETE FROM timetable 
                WHERE class_id=? AND day_of_week=? AND period_no=?
            ''', (class_id, day, period))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()
@admin_bp.route('/timetable/master')
@login_required(roles=['admin', 'principal'])
def master_timetable():
    sid = school_id()
    db = get_db()
    
    # Selected Day (default to today)
    day = request.args.get('day', datetime.date.today().strftime('%A'))
    
    # Get all classes
    classes = db.execute("SELECT id, name, section FROM classes WHERE school_id=? ORDER BY name", (sid,)).fetchall()
    
    # Get school settings (periods per day)
    school = db.execute("SELECT periods_per_day FROM schools WHERE id=?", (sid,)).fetchone()
    periods = school['periods_per_day']
    
    # Get all timetable data for this day across all classes
    records = db.execute('''
        SELECT t.*, s.name as subject_name, ts.name as teacher_name, c.id as cid
        FROM timetable t
        JOIN subjects s ON t.subject_id = s.id
        JOIN classes c ON t.class_id = c.id
        LEFT JOIN users ts ON s.teacher_id = ts.id
        WHERE c.school_id = ? AND t.day_of_week = ?
    ''', (sid, day)).fetchall()
    
    # Map data to {class_id: {period: subject_name}}
    grid = {c['id']: {} for c in classes}
    for r in records:
        grid[r['cid']][r['period_no']] = r['subject_name']
        
    db.close()
    return render_template('admin/master_timetable.html', 
                           classes=classes, 
                           periods=periods, 
                           grid=grid, 
                           selected_day=day)
