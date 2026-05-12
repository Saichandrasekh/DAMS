"""Production launcher — serves the Flask app via Waitress on Windows.

Usage:
    cd d:\\attendence\\backend
    .\\venv\\Scripts\\python.exe run_prod.py

Listens on 0.0.0.0:5000 by default. Nginx should proxy to this.
Cloudflare Tunnel can then expose the Nginx port.
"""
import os
import sys

# Force UTF-8 stdout so unicode chars from init_db()/log_action() don't crash on Windows cp1252.
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from waitress import serve
from app import app
from database.db import init_db

HOST = os.environ.get('DAMS_HOST', '0.0.0.0')
PORT = int(os.environ.get('DAMS_PORT', '5000'))
THREADS = int(os.environ.get('DAMS_THREADS', '8'))

if __name__ == '__main__':
    init_db()
    print('=' * 60)
    print(f' DAMS production server (Waitress)')
    print(f'   Listening: http://{HOST}:{PORT}')
    print(f'   Threads:   {THREADS}')
    print(f'   Nginx should reverse-proxy this port.')
    print('=' * 60, flush=True)
    serve(app, host=HOST, port=PORT, threads=THREADS, _quiet=False)
