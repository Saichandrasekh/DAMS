import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'attendance.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("ALTER TABLE users ADD COLUMN original_password TEXT")
        print("Column original_password added successfully.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column already exists.")
        else:
            raise e
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
