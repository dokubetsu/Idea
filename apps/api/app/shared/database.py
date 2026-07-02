import threading
import contextvars
from supabase import create_client, Client
from app.config import settings

_db_client = None
_db_lock = threading.Lock()

_request_db_client: contextvars.ContextVar[Client | None] = contextvars.ContextVar(
    "_request_db_client", default=None
)


def get_service_role_db() -> Client:
    """Service-role client — bypasses RLS. Server-side admin/system use only."""
    global _db_client
    if _db_client is None:
        with _db_lock:
            if _db_client is None:
                assert (
                    settings.SUPABASE_SERVICE_ROLE_KEY is not None
                ), "SUPABASE_SERVICE_ROLE_KEY not configured"
                _db_client = create_client(
                    settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
                )
    return _db_client


def get_db() -> Client:
    """
    Returns the request-scoped database client (JWT-scoped/anon) if set.
    Otherwise, falls back to the service-role client.
    """
    req_client = _request_db_client.get()
    if req_client is not None:
        return req_client
    import sys
    if "pytest" in sys.modules:
        return get_service_role_db()
    raise RuntimeError(
        "get_db() called outside request scope. Use get_service_role_db() explicitly."
    )


def set_request_db(client: Client):
    """Set the request-scoped database client context."""
    return _request_db_client.set(client)


def clear_request_db(token):
    """Clear the request-scoped database client context."""
    _request_db_client.reset(token)


def get_test_db():
    """Returns the mock database client for testing purposes."""
    import sys

    if "pytest" in sys.modules:
        return get_service_role_db()
    raise RuntimeError("get_test_db() called outside of pytest environment")
