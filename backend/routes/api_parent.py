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


@api_parent_bp.route('/diary', methods=['GET'])
@login_required(roles=ROLES)
def parent_diary():
    """School-wide announcements + entries for any of the parent's children's classes."""
    pid = _uid()
    db = get_db()

    parent = db.execute("SELECT school_id FROM users WHERE id=?", (pid,)).fetchone()
    if not parent:
        db.close()
        return jsonify({'entries': []})
    sid = parent['school_id']

    children = db.execute('''
        SELECT DISTINCT sc.class_id, c.name AS class_name, c.section
        FROM parent_student ps
        JOIN student_classes sc ON sc.student_id = ps.student_id
        JOIN classes c ON c.id = sc.class_id
        WHERE ps.parent_id = ?
    ''', (pid,)).fetchall()
    class_ids = [c['class_id'] for c in children]

    if class_ids:
        placeholders = ','.join(['?'] * len(class_ids))
        rows = db.execute(f'''
            SELECT d.id, d.scope, d.class_id, d.subject_id, d.title, d.content, d.link,
                   d.entry_date, d.created_at,
                   c.name AS class_name, c.section,
                   s.name AS subject_name,
                   u.name AS posted_by_name, u.role AS posted_by_role
            FROM diary_entries d
            LEFT JOIN classes c ON c.id = d.class_id
            LEFT JOIN subjects s ON s.id = d.subject_id
            LEFT JOIN users u ON u.id = d.posted_by
            WHERE d.school_id=? AND (d.scope='school' OR d.class_id IN ({placeholders}))
            ORDER BY d.entry_date DESC, d.id DESC
            LIMIT 100
        ''', (sid, *class_ids)).fetchall()
    else:
        rows = db.execute('''
            SELECT d.id, d.scope, d.class_id, d.subject_id, d.title, d.content, d.link,
                   d.entry_date, d.created_at,
                   NULL AS class_name, NULL AS section, NULL AS subject_name,
                   u.name AS posted_by_name, u.role AS posted_by_role
            FROM diary_entries d
            LEFT JOIN users u ON u.id = d.posted_by
            WHERE d.school_id=? AND d.scope='school'
            ORDER BY d.entry_date DESC, d.id DESC
            LIMIT 100
        ''', (sid,)).fetchall()
    db.close()
    return jsonify({'entries': _rows(rows), 'children_classes': _rows(children)})


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
