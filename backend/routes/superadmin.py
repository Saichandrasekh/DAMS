from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify, flash
from database.db import get_db
from middleware.auth import login_required, hash_password, log_action

superadmin_bp = Blueprint('superadmin', __name__, url_prefix='/superadmin')

@superadmin_bp.route('/dashboard')
@login_required(roles=['super_admin'])
def dashboard():
    db = get_db()
    schools = db.execute('''
        SELECT s.*, 
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='student') as student_count,
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='teacher') as teacher_count
        FROM schools s ORDER BY s.created_at DESC
    ''').fetchall()
    total_users = db.execute("SELECT COUNT(*) as c FROM users WHERE role != 'super_admin'").fetchone()['c']
    total_schools = len(schools)
    total_teachers = db.execute("SELECT COUNT(*) as c FROM users WHERE role='teacher'").fetchone()['c']
    total_students = db.execute("SELECT COUNT(*) as c FROM users WHERE role='student'").fetchone()['c']
    
    # Recent audit logs for dashboard
    recent_logs = db.execute('''
        SELECT l.*, u.name as user_name, s.name as school_name
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        LEFT JOIN schools s ON l.school_id = s.id
        ORDER BY l.created_at DESC LIMIT 10
    ''').fetchall()
    
    db.close()
    return render_template('superadmin/dashboard.html',
                           schools=schools,
                           total_users=total_users,
                           total_schools=total_schools,
                           total_teachers=total_teachers,
                           total_students=total_students,
                           recent_logs=recent_logs)

@superadmin_bp.route('/schools', methods=['GET'])
@login_required(roles=['super_admin'])
def schools():
    db = get_db()
    schools = db.execute('''
        SELECT s.*, 
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='student') as student_count,
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='teacher') as teacher_count,
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role IN ('admin','principal')) as admin_count
        FROM schools s ORDER BY s.created_at DESC
    ''').fetchall()
    db.close()
    return render_template('superadmin/schools.html', schools=schools)

@superadmin_bp.route('/schools/add', methods=['GET', 'POST'])
@login_required(roles=['super_admin'])
def add_school():
    if request.method == 'GET':
        return render_template('superadmin/add_school.html')

    data = request.form
    name = data.get('name', '').strip()
    code = data.get('code', '').strip().upper()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    address = data.get('address', '').strip()
    admin_name = data.get('admin_name', '').strip()
    admin_email = data.get('admin_email', '').strip().lower()
    admin_password = data.get('admin_password', '').strip()

    if not all([name, code, admin_name, admin_email, admin_password]):
        flash('All required fields must be filled', 'error')
        return render_template('superadmin/add_school.html')

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO schools (name, code, email, phone, address) VALUES (?,?,?,?,?)",
            (name, code, email, phone, address)
        )
        school_id = cursor.lastrowid
        db.execute(
            "INSERT INTO users (school_id, name, email, password, original_password, role) VALUES (?,?,?,?,?,?)",
            (school_id, admin_name, admin_email, hash_password(admin_password), admin_password, 'admin')
        )
        db.commit()
        log_action(None, session.get('user_id'), 'ADD_SCHOOL', f'Created school {name} ({code})')
        flash(f'School "{name}" created successfully!', 'success')
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        if 'UNIQUE' in error_msg:
            flash(f'A school with code "{code}" already exists', 'error')
        else:
            flash(f'Error: {error_msg}', 'error')
    finally:
        db.close()
    return redirect(url_for('superadmin.schools'))

@superadmin_bp.route('/schools/<int:school_id>/edit', methods=['GET', 'POST'])
@login_required(roles=['super_admin'])
def edit_school(school_id):
    db = get_db()
    school = db.execute("SELECT * FROM schools WHERE id=?", (school_id,)).fetchone()
    if not school:
        db.close()
        flash('School not found', 'error')
        return redirect(url_for('superadmin.schools'))

    if request.method == 'POST':
        data = request.form
        try:
            db.execute('''UPDATE schools SET name=?, email=?, phone=?, address=?,
                          primary_color=?, academic_year=?, periods_per_day=?,
                          min_attendance_pct=?, late_cutoff_time=? WHERE id=?''',
                       (data.get('name'), data.get('email'), data.get('phone'),
                        data.get('address'), data.get('primary_color', '#4f46e5'),
                        data.get('academic_year'), data.get('periods_per_day', 8),
                        data.get('min_attendance_pct', 75), data.get('late_cutoff_time', '09:00'),
                        school_id))
            db.commit()
            log_action(None, session.get('user_id'), 'UPDATE_SCHOOL', f"Updated school {data.get('name')} (ID: {school_id})")
            flash('School updated successfully', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('superadmin.schools'))

    # Get admin users for this school
    admins = db.execute(
        "SELECT id, name, email FROM users WHERE school_id=? AND role IN ('admin','principal')", 
        (school_id,)
    ).fetchall()
    db.close()
    return render_template('superadmin/edit_school.html', school=school, admins=admins)

@superadmin_bp.route('/schools/<int:school_id>/delete', methods=['POST'])
@login_required(roles=['super_admin'])
def delete_school(school_id):
    db = get_db()
    try:
        # Get school info before deletion
        school = db.execute("SELECT id, name, code FROM schools WHERE id=?", (school_id,)).fetchone()
        if not school:
            flash('School not found', 'error')
            db.close()
            return redirect(url_for('superadmin.schools'))
        
        school_name = school['name']
        
        # Delete school (cascades to all related data due to ON DELETE CASCADE)
        db.execute("DELETE FROM schools WHERE id=?", (school_id,))
        db.commit()
        
        log_action(None, session.get('user_id'), 'DELETE_SCHOOL', 
                   f'Deleted school: {school_name} (Code: {school["code"]})')
        flash(f'✅ School "{school_name}" and all associated data have been permanently deleted.', 'success')
        
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        print(f"❌ Delete school error: {error_msg}")  # For debugging
        
        # Provide user-friendly error messages
        if 'FOREIGN KEY' in error_msg or 'constraint' in error_msg.lower():
            flash('⚠️ Cannot delete school: Please ensure all related records are properly linked. Contact support if this persists.', 'error')
        else:
            flash(f'❌ Error deleting school: {error_msg}', 'error')
    finally:
        db.close()
    
    return redirect(url_for('superadmin.schools'))

@superadmin_bp.route('/credentials')
@login_required(roles=['super_admin'])
def credentials():
    db = get_db()
    # Get all schools with their primary admin users (active and inactive)
    schools_data = db.execute('''
        SELECT s.id as school_id, s.name as school_name, s.code as school_code,
               u.id as user_id, u.name as admin_name, u.email as admin_email, 
               u.phone as admin_phone, u.is_active, u.password as admin_password,
               u.original_password
        FROM schools s
        LEFT JOIN users u ON u.school_id = s.id AND u.role = 'admin'
        ORDER BY s.name
    ''').fetchall()
    db.close()
    return render_template('superadmin/credentials.html', schools=schools_data)

@superadmin_bp.route('/credentials/<int:user_id>/edit', methods=['GET', 'POST'])
@login_required(roles=['super_admin'])
def edit_credential(user_id):
    db = get_db()
    user = db.execute("SELECT u.*, s.name as school_name FROM users u JOIN schools s ON s.id=u.school_id WHERE u.id=? AND u.role='admin'", (user_id,)).fetchone()
    
    if not user:
        db.close()
        flash('Admin not found', 'error')
        return redirect(url_for('superadmin.credentials'))

    if request.method == 'POST':
        data = request.form
        try:
            # Basic info update
            db.execute(
                "UPDATE users SET name=?, email=?, phone=?, is_active=? WHERE id=?",
                (data['name'], data['email'].lower(), data.get('phone'), 1 if 'is_active' in data else 0, user_id)
            )
            
            # Password update if provided
            if data.get('new_password'):
                from middleware.auth import hash_password
                db.execute("UPDATE users SET password=?, original_password=? WHERE id=?", 
                           (hash_password(data['new_password']), data['new_password'], user_id))
            
            db.commit()
            flash('Admin credentials updated', 'success')
        except Exception as e:
            db.rollback()
            flash(f'Error: {str(e)}', 'error')
        finally:
            db.close()
        return redirect(url_for('superadmin.credentials'))

    db.close()
    return render_template('superadmin/edit_credential.html', user=user)

@superadmin_bp.route('/audit-logs')
@login_required(roles=['super_admin'])
def audit_logs():
    db = get_db()
    
    # Get filters from query params
    school_id = request.args.get('school_id')
    u_id = request.args.get('user_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    action_type = request.args.get('action')

    query = '''
        SELECT l.*, u.name as user_name, s.name as school_name
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        LEFT JOIN schools s ON l.school_id = s.id
        WHERE 1=1
    '''
    params = []

    if school_id:
        query += " AND l.school_id = ?"
        params.append(school_id)
    if u_id:
        query += " AND l.user_id = ?"
        params.append(u_id)
    if start_date:
        query += " AND date(l.created_at) >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date(l.created_at) <= ?"
        params.append(end_date)
    if action_type and action_type != 'all':
        query += " AND l.action LIKE ?"
        params.append(f'%{action_type}%')

    query += " ORDER BY l.created_at DESC LIMIT 1000"
    
    logs = db.execute(query, params).fetchall()
    schools = db.execute("SELECT id, name FROM schools ORDER BY name").fetchall()
    
    db.close()
    return render_template('superadmin/audit_logs.html', 
                           logs=logs, 
                           schools=schools,
                           filters=request.args)
