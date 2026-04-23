import os
import secrets

# Use a fixed secret key so JWT tokens survive server restarts.
# In production, set the SECRET_KEY environment variable.
_key_file = os.path.join(os.path.dirname(__file__), '.secret_key')

def _get_or_create_secret_key():
    """Get existing secret key or create a persistent one."""
    env_key = os.environ.get('SECRET_KEY')
    if env_key:
        return env_key
    # Try to read from file
    if os.path.exists(_key_file):
        with open(_key_file, 'r') as f:
            return f.read().strip()
    # Generate and save a new key
    key = secrets.token_hex(32)
    with open(_key_file, 'w') as f:
        f.write(key)
    return key

SECRET_KEY = _get_or_create_secret_key()
JWT_EXPIRY_HOURS = 12
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'csv', 'xlsx'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
