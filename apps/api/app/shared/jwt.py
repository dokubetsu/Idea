import jwt
from jwt import PyJWKClient
from fastapi import HTTPException
from app.config import settings

_jwk_client: PyJWKClient | None = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwk_client = PyJWKClient(_jwks_url)
    return _jwk_client


def decode_token(token: str) -> dict:
    """
    Decodes and validates a Supabase JWT token.
    Handles both HS256 (symmetric secret) and ES256 (asymmetric JWKs).
    Enforces HS256/ES256 signature verification and validates the audience claim.
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        if alg not in ("HS256", "ES256"):
            raise HTTPException(status_code=401, detail="Unsupported signature algorithm")

        if alg == "ES256":
            signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
            key = signing_key.key
        else:
            key = settings.SUPABASE_JWT_SECRET

        issuer = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience="authenticated",
            issuer=issuer,
            options={"verify_aud": True, "verify_iss": True},
        )

        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
