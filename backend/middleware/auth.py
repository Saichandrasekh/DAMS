import jwt
import bcrypt
from functools import wraps
from flask import request, jsonify, session, redirect, url_for
from config import SECRET_KEY
from database.db import get_db

def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed.encode())

def generate_token(user_id, role, school_id):
    import datetime
    payload = {
        'user_id': user_id,
        'role': role,
        'school_id': school_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except:
        return None

def login_required(roles=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = session.get('token') or request.headers.get('Authorization', '').replace('Bearer ', '')
            if not token:
                if request.is_json:
                    return jsonify({'error': 'Unauthorized'}), 401
                return redirect(url_for('auth.login'))
            
            data = decode_token(token)
            if not data:
                session.clear()
                if request.is_json:
                    return jsonify({'error': 'Token expired or invalid'}), 401
                return redirect(url_for('auth.login'))
            
            if roles and data['role'] not in roles:
                if request.is_json:
                    return jsonify({'error': 'Access denied'}), 403
                return redirect(url_for('auth.login'))
            
            request.user = data
            return f(*args, **kwargs)
        return decorated
    return decorator

def get_current_user():
    token = session.get('token')
    if token:
        return decode_token(token)
    return None

def log_action(school_id, user_id, action, details=None):
    try:
        ip = request.remote_addr
        db = get_db()
        db.execute(
            "INSERT INTO audit_logs (school_id, user_id, action, details, ip_address) VALUES (?,?,?,?,?)",
            (school_id, user_id, action, details, ip)
        )
        db.commit()
        db.close()
    except:
        pass
