from flask import Blueprint, request, jsonify
from database.db import get_db
from middleware.auth import login_required, hash_password, log_action

api_superadmin_bp = Blueprint('api_superadmin', __name__, url_prefix='/api/v1/superadmin')


def _row(r):
    return dict(r) if r is not None else None


def _rows(rs):
    return [dict(r) for r in rs]


@api_superadmin_bp.route('/dashboard', methods=['GET'])
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
    total_teachers = db.execute("SELECT COUNT(*) as c FROM users WHERE role='teacher'").fetchone()['c']
    total_students = db.execute("SELECT COUNT(*) as c FROM users WHERE role='student'").fetchone()['c']
    recent_logs = db.execute('''
        SELECT l.*, u.name as user_name, s.name as school_name
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        LEFT JOIN schools s ON l.school_id = s.id
        ORDER BY l.created_at DESC LIMIT 10
    ''').fetchall()
    db.close()
    return jsonify({
        'schools': _rows(schools),
        'totals': {
            'users': total_users,
            'schools': len(schools),
            'teachers': total_teachers,
            'students': total_students,
        },
        'recent_logs': _rows(recent_logs),
    })


@api_superadmin_bp.route('/schools', methods=['GET'])
@login_required(roles=['super_admin'])
def list_schools():
    db = get_db()
    schools = db.execute('''
        SELECT s.*,
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='student') as student_count,
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='teacher') as teacher_count,
               (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role IN ('admin','principal')) as admin_count
        FROM schools s ORDER BY s.created_at DESC
    ''').fetchall()
    db.close()
    return jsonify({'schools': _rows(schools)})


@api_superadmin_bp.route('/schools', methods=['POST'])
@login_required(roles=['super_admin'])
def add_school():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip().upper()
    email = (data.get('email') or '').strip().lower()
    phone = (data.get('phone') or '').strip()
    address = (data.get('address') or '').strip()
    admin_name = (data.get('admin_name') or '').strip()
    admin_email = (data.get('admin_email') or '').strip().lower()
    admin_password = (data.get('admin_password') or '').strip()

    if not all([name, code, admin_name, admin_email, admin_password]):
        return jsonify({'error': 'name, code, admin_name, admin_email, admin_password are required'}), 400

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO schools (name, code, email, phone, address) VALUES (?,?,?,?,?)",
            (name, code, email, phone, address)
        )
        school_id = cursor.lastrowid
        db.execute(
            "INSERT INTO users (school_id, name, email, password, original_password, role) VALUES (?,?,?,?,?,?)",
            (school_id, admin_name, admin_email, hash_password(admin_password), None, 'admin')
        )
        db.commit()
        log_action(None, request.user['user_id'], 'ADD_SCHOOL', f'Created school {name} ({code}) (api)')
        school = db.execute("SELECT * FROM schools WHERE id=?", (school_id,)).fetchone()
        return jsonify({'school': _row(school)}), 201
    except Exception as e:
        db.rollback()
        msg = str(e)
        if 'UNIQUE' in msg:
            return jsonify({'error': f'A school with code "{code}" already exists'}), 409
        return jsonify({'error': msg}), 500
    finally:
        db.close()


@api_superadmin_bp.route('/schools/<int:school_id>', methods=['GET'])
@login_required(roles=['super_admin'])
def get_school(school_id):
    db = get_db()
    school = db.execute("SELECT * FROM schools WHERE id=?", (school_id,)).fetchone()
    if not school:
        db.close()
        return jsonify({'error': 'School not found'}), 404
    admins = db.execute(
        "SELECT id, name, email FROM users WHERE school_id=? AND role IN ('admin','principal')",
        (school_id,)
    ).fetchall()
    db.close()
    return jsonify({'school': _row(school), 'admins': _rows(admins)})


@api_superadmin_bp.route('/schools/<int:school_id>', methods=['PUT'])
@login_required(roles=['super_admin'])
def update_school(school_id):
    db = get_db()
    school = db.execute("SELECT id, name FROM schools WHERE id=?", (school_id,)).fetchone()
    if not school:
        db.close()
        return jsonify({'error': 'School not found'}), 404

    data = request.get_json(silent=True) or {}
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
        log_action(None, request.user['user_id'], 'UPDATE_SCHOOL',
                   f"Updated school {data.get('name')} (ID: {school_id}) (api)")
        return jsonify({'message': 'School updated successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_superadmin_bp.route('/schools/<int:school_id>', methods=['DELETE'])
@login_required(roles=['super_admin'])
def delete_school(school_id):
    db = get_db()
    try:
        school = db.execute("SELECT id, name, code FROM schools WHERE id=?", (school_id,)).fetchone()
        if not school:
            db.close()
            return jsonify({'error': 'School not found'}), 404
        name = school['name']
        db.execute("DELETE FROM schools WHERE id=?", (school_id,))
        db.commit()
        log_action(None, request.user['user_id'], 'DELETE_SCHOOL',
                   f'Deleted school: {name} (Code: {school["code"]}) (api)')
        return jsonify({'message': f'School "{name}" deleted permanently'})
    except Exception as e:
        db.rollback()
        msg = str(e)
        if 'FOREIGN KEY' in msg or 'constraint' in msg.lower():
            return jsonify({'error': 'Cannot delete: related records exist.'}), 409
        return jsonify({'error': msg}), 500
    finally:
        db.close()


@api_superadmin_bp.route('/credentials', methods=['GET'])
@login_required(roles=['super_admin'])
def list_credentials():
    db = get_db()
    rows = db.execute('''
        SELECT s.id as school_id, s.name as school_name, s.code as school_code,
               u.id as user_id, u.name as admin_name, u.email as admin_email,
               u.phone as admin_phone, u.is_active
        FROM schools s
        LEFT JOIN users u ON u.school_id = s.id AND u.role = 'admin'
        ORDER BY s.name
    ''').fetchall()
    db.close()
    return jsonify({'credentials': _rows(rows)})


@api_superadmin_bp.route('/credentials/<int:user_id>', methods=['PUT'])
@login_required(roles=['super_admin'])
def update_credential(user_id):
    db = get_db()
    user = db.execute("SELECT id FROM users WHERE id=? AND role='admin'", (user_id,)).fetchone()
    if not user:
        db.close()
        return jsonify({'error': 'Admin not found'}), 404

    data = request.get_json(silent=True) or {}
    try:
        db.execute(
            "UPDATE users SET name=?, email=?, phone=?, is_active=? WHERE id=?",
            (data.get('name'), (data.get('email') or '').lower(), data.get('phone'),
             1 if data.get('is_active', True) else 0, user_id)
        )
        if data.get('new_password'):
            db.execute(
                "UPDATE users SET password=?, original_password=NULL WHERE id=?",
                (hash_password(data['new_password']), user_id)
            )
        db.commit()
        log_action(None, request.user['user_id'], 'UPDATE_ADMIN_CREDENTIAL',
                   f'Updated admin user ID {user_id} (api)')
        return jsonify({'message': 'Admin credentials updated'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@api_superadmin_bp.route('/audit-logs', methods=['GET'])
@login_required(roles=['super_admin'])
def audit_logs():
    db = get_db()
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
    return jsonify({'logs': _rows(logs), 'schools': _rows(schools)})
