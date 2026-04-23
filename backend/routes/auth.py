from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify, flash
from database.db import get_db
from middleware.auth import hash_password, check_password, generate_token, get_current_user, log_action

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def index():
    user = get_current_user()
    if user:
        return redirect(url_for('auth.dashboard'))
    return redirect(url_for('auth.login'))

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        user = get_current_user()
        if user:
            return redirect(url_for('auth.dashboard'))
        return render_template('auth/login.html')

    data = request.form
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        flash('Email and password are required', 'error')
        return render_template('auth/login.html')

    db = get_db()
    user = db.execute(
        "SELECT u.*, s.name as school_name, s.primary_color, s.logo FROM users u "
        "LEFT JOIN schools s ON u.school_id = s.id WHERE LOWER(u.email)=? AND u.is_active=1",
        (email,)
    ).fetchone()
    db.close()

    if not user or not check_password(password, user['password']):
        flash('Invalid email or password', 'error')
        return render_template('auth/login.html')

    token = generate_token(user['id'], user['role'], user['school_id'])
    session.permanent = True
    session['token'] = token
    session['user_id'] = user['id']
    session['user_name'] = user['name']
    session['user_role'] = user['role']
    session['school_id'] = user['school_id']
    session['school_name'] = 'Platform Admin' if user['role'] == 'super_admin' else user['school_name']
    session['school_color'] = user['primary_color'] or '#4f46e5'
    session['school_logo'] = user['logo']

    log_action(user['school_id'], user['id'], 'LOGIN', f"{user['role']} logged in")
    return redirect(url_for('auth.dashboard'))

@auth_bp.route('/dashboard')
def dashboard():
    user = get_current_user()
    if not user:
        return redirect(url_for('auth.login'))
    role = session.get('user_role')
    if role == 'super_admin':
        return redirect(url_for('superadmin.dashboard'))
    elif role in ('admin', 'principal'):
        return redirect(url_for('admin.dashboard'))
    elif role == 'teacher':
        return redirect(url_for('teacher.dashboard'))
    elif role == 'student':
        return redirect(url_for('student.dashboard'))
    elif role == 'parent':
        return redirect(url_for('parent.dashboard'))
    return redirect(url_for('auth.login'))

@auth_bp.route('/logout')
def logout():
    user = get_current_user()
    if user:
        log_action(user.get('school_id'), user.get('user_id'), 'LOGOUT', 'User logged out')
    session.clear()
    flash('Logged out successfully', 'success')
    return redirect(url_for('auth.login'))

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    old_pass = data.get('old_password')
    new_pass = data.get('new_password')

    db = get_db()
    u = db.execute("SELECT password FROM users WHERE id=?", (user['user_id'],)).fetchone()
    if not u or not check_password(old_pass, u['password']):
        db.close()
        return jsonify({'error': 'Current password is incorrect'}), 400

    db.execute("UPDATE users SET password=? WHERE id=?", (hash_password(new_pass), user['user_id']))
    db.commit()
    db.close()
    return jsonify({'message': 'Password changed successfully'})
