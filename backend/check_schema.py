import sqlite3
import os

DB_PATH = os.path.join('database', 'attendance.db')
if not os.path.exists(DB_PATH):
    print(f"Error: {DB_PATH} not found.")
    exit(1)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

tables = ['timetable', 'marks', 'student_attendance']
for table in tables:
    cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'")
    row = cursor.fetchone()
    if row:
        print(f"--- Schema for {table} ---")
        print(row[0])
    else:
        print(f"--- Table {table} not found ---")

conn.close()
