import os
import secrets
import sys

# Use a fixed secret key so JWT tokens survive server restarts.
# Priority: SECRET_KEY env var -> .secret_key file -> generate new one.
_key_file = os.path.join(os.path.dirname(__file__), '.secret_key')


def _get_or_create_secret_key():
    env_key = os.environ.get('SECRET_KEY')
    if env_key:
        if len(env_key) < 32:
            print('WARN  SECRET_KEY env var is short (<32 chars). Use 64+ hex chars for production.', file=sys.stderr)
        return env_key

    if os.path.exists(_key_file):
        with open(_key_file, 'r') as f:
            key = f.read().strip()
        if not key or len(key) < 32:
            print(f'WARN  {_key_file} contains a weak key. Delete it and restart to regenerate.', file=sys.stderr)
        return key

    # First run — generate a strong key and persist
    key = secrets.token_hex(32)
    try:
        with open(_key_file, 'w') as f:
            f.write(key)
        os.chmod(_key_file, 0o600) if hasattr(os, 'chmod') else None
        print('INFO  Generated new SECRET_KEY at backend/.secret_key (kept out of git).')
    except OSError as e:
        print(f'WARN  Could not persist SECRET_KEY: {e}. Tokens will not survive restart.', file=sys.stderr)
    return key


SECRET_KEY = _get_or_create_secret_key()
JWT_EXPIRY_HOURS = int(os.environ.get('DAMS_JWT_EXPIRY_HOURS', '12'))
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'csv', 'xlsx'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
