from flask import Blueprint, request, jsonify
from database.db import get_db
from middleware.auth import login_required

api_parent_bp = Blueprint('api_parent', __name__, url_prefix='/api/v1/parent')

ROLES = ['parent']


def _rows(rs):
    return [dict(r) for r in rs]


def _uid():
    return request.user['user_id']


@api_parent_bp.route('/dashboard', methods=['GET'])
@login_required(roles=ROLES)
def dashboard():
    pid = _uid()
    db = get_db()
    children = db.execute('''
        SELECT u.id, u.name, c.name as class_name, c.section
        FROM users u
        JOIN parent_student ps ON u.id = ps.student_id
        JOIN student_classes sc ON u.id = sc.student_id
        JOIN classes c ON sc.class_id = c.id
        WHERE ps.parent_id = ?
    ''', (pid,)).fetchall()

    recent_attendance = db.execute('''
        SELECT sa.date, sa.status, u.name as student_name, sub.name as subject_name
        FROM student_attendance sa
        JOIN users u ON sa.student_id = u.id
        JOIN parent_student ps ON u.id = ps.student_id
        LEFT JOIN subjects sub ON sa.subject_id = sub.id
        WHERE ps.parent_id = ?
        ORDER BY sa.date DESC LIMIT 20
    ''', (pid,)).fetchall()

    alerts = []
    child_stats = []
    for child in children:
        stats = db.execute('''
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present
            FROM student_attendance WHERE student_id = ?
        ''', (child['id'],)).fetchone()
        total = stats['total'] or 0
        present = stats['present'] or 0
        pct = round((present / total) * 100, 1) if total > 0 else 0
        child_stats.append({
            'id': child['id'],
            'name': child['name'],
            'class_name': child['class_name'],
            'section': child['section'],
            'total': total,
            'present': present,
            'percentage': pct,
        })
        if total > 0 and pct < 75:
            alerts.append({'student_id': child['id'], 'student_name': child['name'], 'percentage': pct})

    db.close()
    return jsonify({
        'children': child_stats,
        'recent_attendance': _rows(recent_attendance),
        'alerts': alerts,
    })


@api_parent_bp.route('/child/<int:student_id>', methods=['GET'])
@login_required(roles=ROLES)
def child_report(student_id):
    pid = _uid()
    db = get_db()
    rel = db.execute("SELECT 1 FROM parent_student WHERE parent_id=? AND student_id=?", (pid, student_id)).fetchone()
    if not rel:
        db.close()
        return jsonify({'error': 'Access denied'}), 403
    child = db.execute("SELECT id, name FROM users WHERE id=?", (student_id,)).fetchone()
    attendance = db.execute('''
        SELECT sa.date, sa.status, sub.name as subject_name, sa.period_no
        FROM student_attendance sa
        LEFT JOIN subjects sub ON sa.subject_id = sub.id
        WHERE sa.student_id = ?
        ORDER BY sa.date DESC LIMIT 50
    ''', (student_id,)).fetchall()
    db.close()
    return jsonify({'child': dict(child) if child else None, 'attendance': _rows(attendance)})
