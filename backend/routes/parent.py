from flask import Blueprint, render_template, request, session, jsonify
from database.db import get_db
from middleware.auth import login_required
import datetime

parent_bp = Blueprint('parent', __name__, url_prefix='/parent')

def user_id():
    return session.get('user_id')

@parent_bp.route('/dashboard')
@login_required(roles=['parent'])
def dashboard():
    pid = user_id()
    db = get_db()
    
    # Get all linked children
    children = db.execute('''
        SELECT u.id, u.name, c.name as class_name, c.section, u.photo
        FROM users u
        JOIN parent_student ps ON u.id = ps.student_id
        JOIN student_classes sc ON u.id = sc.student_id
        JOIN classes c ON sc.class_id = c.id
        WHERE ps.parent_id = ?
    ''', (pid,)).fetchall()
    
    # Get recent attendance for all children
    recent_attendance = db.execute('''
        SELECT sa.date, sa.status, u.name as student_name, sub.name as subject_name
        FROM student_attendance sa
        JOIN users u ON sa.student_id = u.id
        JOIN parent_student ps ON u.id = ps.student_id
        LEFT JOIN subjects sub ON sa.subject_id = sub.id
        WHERE ps.parent_id = ?
        ORDER BY sa.date DESC LIMIT 20
    ''', (pid,)).fetchall()
    
    # Get threshold alerts for children (below X%)
    alerts = []
    for child in children:
        stats = db.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present
            FROM student_attendance 
            WHERE student_id = ?
        ''', (child['id'],)).fetchone()
        
        if stats['total'] > 0:
            pct = (stats['present'] / stats['total']) * 100
            if pct < 75:
                alerts.append({
                    'student_name': child['name'],
                    'percentage': round(pct, 1)
                })

    db.close()
    return render_template('parent/dashboard.html', 
                           children=children, 
                           recent_attendance=recent_attendance,
                           alerts=alerts)

@parent_bp.route('/child/<int:student_id>/report')
@login_required(roles=['parent'])
def child_report(student_id):
    pid = user_id()
    db = get_db()
    
    # Verify relationship
    rel = db.execute("SELECT 1 FROM parent_student WHERE parent_id=? AND student_id=?", (pid, student_id)).fetchone()
    if not rel:
        db.close()
        return "Access Denied", 403
    
    child = db.execute("SELECT name FROM users WHERE id=?", (student_id,)).fetchone()
    
    attendance = db.execute('''
        SELECT sa.date, sa.status, sub.name as subject_name, sa.period_no
        FROM student_attendance sa
        LEFT JOIN subjects sub ON sa.subject_id = sub.id
        WHERE sa.student_id = ?
        ORDER BY sa.date DESC LIMIT 50
    ''', (student_id,)).fetchall()
    
    db.close()
    return render_template('parent/child_report.html', child=child, attendance=attendance)
