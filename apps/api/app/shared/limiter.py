from slowapi import Limiter
from fastapi import Request
from app.config import settings


def get_rate_limit_key(request: Request) -> str:
    # Use verified user identity from auth middleware / request state, fall back to IP
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"

    # Fall back to IP, respecting X-Forwarded-For behind trusted proxies
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded and settings.TRUST_PROXY:
        return f"ip:{forwarded.split(',')[0].strip()}"

    client_host = request.client.host if request.client else "127.0.0.1"
    return f"ip:{client_host}"


# Define rate limiter using get_rate_limit_key and storage_uri configured from Settings
limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["100/minute"],
    storage_uri=settings.REDIS_URL,
)
