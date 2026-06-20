from slowapi import Limiter
from slowapi.util import get_remote_address

# Define rate limiter with remote IP address key function and default limit
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
