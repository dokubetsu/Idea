import threading
from supabase import create_client, Client
from app.config import settings

_db_client = None
_db_lock = threading.Lock()

def get_db() -> Client:
    """Service-role client — bypasses RLS. Server-side use only."""
    global _db_client
    if _db_client is None:
        with _db_lock:
            if _db_client is None:
                _db_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _db_client

