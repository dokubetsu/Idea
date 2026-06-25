"""Identity domain — profile creation and self-management."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated, Literal
from pydantic import BaseModel, Field
from app.shared.database import get_db, get_service_role_db
from app.shared.dependencies import Auth
from app.config import settings

from app.shared.jwt import decode_token

router  = APIRouter(prefix="/identity", tags=["identity"])
bearer  = HTTPBearer(auto_error=False)
log = logging.getLogger(__name__)


class RegisterProfileRequest(BaseModel):
    role: Literal["user", "lawyer"] = "user"
    full_name: str = Field(min_length=2, max_length=120)
    phone: str | None = None
    city: str | None = None
    state: str | None = None


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    avatar_url: str | None = None


def _decode_signup_jwt(token: str) -> dict:
    return decode_token(token)


@router.post("/profile", status_code=201)
async def register_profile(
    body: RegisterProfileRequest,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    """Called immediately after Supabase signup to create the profiles row."""
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _decode_signup_jwt(creds.credentials)

    user_id = payload.get("sub")
    db      = get_service_role_db()

    res = db.rpc("register_profile", {
        "p_user_id": user_id,
        "p_full_name": body.full_name,
        "p_phone": body.phone,
        "p_city": body.city,
        "p_state": body.state,
        "p_role": body.role
    }).execute()

    profile = res.data

    # Sync role to Supabase auth app_metadata (for client JWT security)
    try:
        from gotrue import AdminUserAttributes
        db.auth.admin.update_user_by_id(
            user_id,
            AdminUserAttributes(app_metadata={"role": "user"})
        )
    except Exception as e:
        log.warning("Failed to sync role to app_metadata: %s", e)

    # Link any pending matters created by a lawyer using this email
    user_email = payload.get("email")
    if body.role == "user" and user_email:
        try:
            db.table("matters").update({"user_id": user_id}).eq("client_email", user_email).execute()
        except Exception as link_exc:
            log.warning("Failed to link pending matters for email %s: %s", user_email, link_exc)

    return profile


@router.get("/me")
async def get_me(user: Auth):
    db = get_db()
    profile = db.table("profiles").select("*").eq("id", user.id).single().execute().data
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if user.role.value == "lawyer":
        lp = db.table("lawyer_profiles").select("*").eq("id", user.id).execute().data
        profile["lawyer_profile"] = lp[0] if lp else None
    return profile


@router.patch("/me")
async def update_me(body: ProfileUpdateRequest, user: Auth):
    db   = get_db()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=422, detail="Nothing to update")
    db.table("profiles").update(data).eq("id", user.id).execute()
    return {"ok": True}