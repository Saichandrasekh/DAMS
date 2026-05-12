from flask import Blueprint, request, jsonify
from database.db import get_db
from extensions import limiter
from middleware.auth import (
    hash_password,
    check_password,
    generate_token,
    decode_token,
    log_action,
    login_required,
)

api_auth_bp = Blueprint('api_auth', __name__, url_prefix='/api/v1/auth')


def _user_payload(user_row, token=None):
    payload = {
        'id': user_row['id'],
        'name': user_row['name'],
        'email': user_row['email'],
        'role': user_row['role'],
        'school_id': user_row['school_id'],
        'school_name': 'Platform Admin' if user_row['role'] == 'super_admin' else user_row['school_name'],
        'school_color': user_row['primary_color'] or '#4f46e5',
        'school_logo': user_row['logo'],
    }
    if token:
        payload['token'] = token
    return payload


@api_auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute; 100 per hour")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    db = get_db()
    user = db.execute(
        "SELECT u.*, s.name as school_name, s.primary_color, s.logo FROM users u "
        "LEFT JOIN schools s ON u.school_id = s.id WHERE LOWER(u.email)=? AND u.is_active=1",
        (email,)
    ).fetchone()
    db.close()

    if not user or not check_password(password, user['password']):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = generate_token(user['id'], user['role'], user['school_id'])
    log_action(user['school_id'], user['id'], 'LOGIN', f"{user['role']} logged in (api)")
    return jsonify(_user_payload(user, token=token))


@api_auth_bp.route('/me', methods=['GET'])
@login_required()
def me():
    auth_data = request.user
    db = get_db()
    user = db.execute(
        "SELECT u.*, s.name as school_name, s.primary_color, s.logo FROM users u "
        "LEFT JOIN schools s ON u.school_id = s.id WHERE u.id=? AND u.is_active=1",
        (auth_data['user_id'],)
    ).fetchone()
    db.close()

    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(_user_payload(user))


@api_auth_bp.route('/logout', methods=['POST'])
@login_required()
def logout():
    auth_data = request.user
    log_action(auth_data.get('school_id'), auth_data.get('user_id'), 'LOGOUT', 'User logged out (api)')
    return jsonify({'message': 'Logged out'})


@api_auth_bp.route('/change-password', methods=['POST'])
@limiter.limit("20 per hour")
@login_required()
def change_password():
    auth_data = request.user
    data = request.get_json(silent=True) or {}
    old_pass = data.get('old_password')
    new_pass = data.get('new_password')

    if not old_pass or not new_pass:
        return jsonify({'error': 'old_password and new_password are required'}), 400
    if len(new_pass) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    db = get_db()
    u = db.execute("SELECT password FROM users WHERE id=?", (auth_data['user_id'],)).fetchone()
    if not u or not check_password(old_pass, u['password']):
        db.close()
        return jsonify({'error': 'Current password is incorrect'}), 400

    db.execute("UPDATE users SET password=? WHERE id=?", (hash_password(new_pass), auth_data['user_id']))
    db.commit()
    db.close()
    return jsonify({'message': 'Password changed successfully'})
