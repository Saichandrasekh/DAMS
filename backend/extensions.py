"""Flask extensions instantiated once and used across blueprints.

Keeping the singletons here (not in app.py) avoids circular imports.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# In-memory storage is fine for a single-process Waitress deployment.
# For multi-worker setups, switch storage_uri to "redis://..." or "memcached://...".
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],  # no global limit; opt-in per route
    storage_uri="memory://",
    strategy="fixed-window",
)
