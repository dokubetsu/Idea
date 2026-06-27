from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
import jwt


def get_user_or_ip_address(request: Request) -> str:
    auth = request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        try:
            # Decode token without verification to extract user ID (sub claim) for rate limiting key
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass
    return f"ip:{get_remote_address(request)}"


# Define rate limiter with user/IP key function and default limit
limiter = Limiter(key_func=get_user_or_ip_address, default_limits=["100/minute"])
