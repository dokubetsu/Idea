"""Identity domain — profile creation and self-management."""

import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

from app.shared import database as shared_database
from app.shared.database import get_db
from app.shared.dependencies import Auth
from app.shared.jwt import decode_token

router = APIRouter(prefix="/identity", tags=["identity"])
bearer = HTTPBearer(auto_error=False)
log = logging.getLogger(__name__)

# Avatar hosts allowed on profile updates (stored XSS mitigation)
_AVATAR_HOST_SUFFIXES = (
    ".supabase.co",
    ".supabase.in",
    "images.unsplash.com",
)


class RegisterProfileRequest(BaseModel):
    # Role is NOT accepted from the client — it is forced to "user" at
    # the API layer to prevent privilege escalation. Existing seeded lawyer
    # profiles are handled separately by DB RPCs.
    # Removing this field from the schema closes the self-assignment vector.
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

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.startswith("https://"):
            raise ValueError("Avatar URL must use https scheme")
        try:
            from urllib.parse import urlparse

            host = (urlparse(v).hostname or "").lower()
        except Exception as exc:
            raise ValueError("Invalid avatar URL") from exc
        if not host:
            raise ValueError("Invalid avatar URL")
        if not any(
            host == s.lstrip(".") or host.endswith(s) for s in _AVATAR_HOST_SUFFIXES
        ):
            raise ValueError(
                "Avatar URL host is not allowed. Use Supabase Storage or approved CDN."
            )
        return v


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
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid user ID in token")
    db = shared_database.get_service_role_db()

    res = db.rpc(
        "register_profile",
        {
            "p_user_id": user_id,
            "p_full_name": body.full_name,
            "p_phone": body.phone,
            "p_city": body.city,
            "p_state": body.state,
            # Force registration role to "user" to prevent client spoofing.
            # Admin-promoted roles (lawyer) are set separately via /admin/lawyers/:id/verify.
            "p_role": "user",
        },
    ).execute()

    profile = res.data

    # Sync role to Supabase auth app_metadata (for client JWT security)
    try:
        resolved_role = "user"
        if profile:
            if isinstance(profile, dict) and "role" in profile:
                resolved_role = profile["role"]
            elif (
                isinstance(profile, list)
                and len(profile) > 0
                and isinstance(profile[0], dict)
                and "role" in profile[0]
            ):
                resolved_role = profile[0]["role"]

        from gotrue import AdminUserAttributes

        db.auth.admin.update_user_by_id(
            user_id, AdminUserAttributes(app_metadata={"role": resolved_role})
        )
    except Exception as e:
        log.warning("Failed to sync role to app_metadata: %s", e)

    # Link any pending matters created by a lawyer using this email.
    # Require email_verified to prevent an attacker pre-registering with a
    # victim's address and claiming their cases before real owner signs up.
    user_email = payload.get("email")
    email_verified = payload.get("email_verified", False)
    if user_email and email_verified:
        try:
            db.table("matters").update({"user_id": user_id}).eq(
                "client_email", user_email
            ).is_(
                "user_id", "null"
            ).execute()  # Only link still-unlinked matters
        except Exception as link_exc:
            log.warning(
                "Failed to link pending matters for email %s: %s", user_email, link_exc
            )

    # If the user signed up intending to be a lawyer (user_metadata.role == "lawyer"),
    # create an unverified lawyer_profiles row so the pending-verification banner shows.
    user_meta = payload.get("user_metadata", {}) or {}
    intended_role = user_meta.get("role")
    if intended_role == "lawyer":
        try:
            db.table("lawyer_profiles").upsert(
                {"id": user_id, "is_verified": False, "is_available": False},
                on_conflict="id",
            ).execute()
            log.info(
                "[Identity] Created unverified lawyer_profile for user %s", user_id
            )
        except Exception as lp_exc:
            log.warning("Failed to create lawyer_profile for %s: %s", user_id, lp_exc)

    return profile


@router.get("/me")
async def get_me(user: Auth):
    db = get_db()
    profile = db.table("profiles").select("*").eq("id", user.id).single().execute().data
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    # Always check for lawyer_profile — covers both verified lawyers and
    # user-role accounts that applied as lawyers (pending verification).
    lp = db.table("lawyer_profiles").select("*").eq("id", user.id).execute().data
    profile["lawyer_profile"] = lp[0] if lp else None
    return profile


@router.patch("/me")
async def update_me(body: ProfileUpdateRequest, user: Auth):
    db = get_db()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=422, detail="Nothing to update")
    db.table("profiles").update(data).eq("id", user.id).execute()
    return {"ok": True}


@router.post("/me/dsr/export")
async def dsr_export(user: Auth):
    """Data Subject Rights (DSR) export endpoint."""
    db = get_db()
    profile_res = db.table("profiles").select("*").eq("id", user.id).execute()
    profile = profile_res.data[0] if profile_res.data else {}

    lp_res = db.table("lawyer_profiles").select("*").eq("id", user.id).execute()
    lp = lp_res.data[0] if lp_res.data else None

    matters_res = (
        db.table("matters")
        .select("*")
        .or_(f"user_id.eq.{user.id},lawyer_id.eq.{user.id}")
        .execute()
    )
    matters = matters_res.data or []

    intake_res = (
        db.table("intake_sessions").select("*").eq("user_id", user.id).execute()
    )
    intake_sessions = intake_res.data or []

    notif_res = (
        db.table("notifications")
        .select("id, type, status, created_at, data")
        .eq("user_id", user.id)
        .limit(500)
        .execute()
    )
    notifications = notif_res.data or []

    audit_res = db.table("audit_logs").select("*").eq("actor_id", user.id).execute()
    audit_logs = audit_res.data or []

    return {
        "user_id": user.id,
        "exported_at": datetime.now(UTC).isoformat(),
        "profile": profile,
        "lawyer_profile": lp,
        "matters": matters,
        "intake_sessions": intake_sessions,
        "notifications": notifications,
        "audit_logs": audit_logs,
        "notes": (
            "Matter records may be retained under legitimate interest / legal "
            "obligation even after personal data scrubbing. Contact support for "
            "legal-hold questions."
        ),
    }


@router.post("/me/dsr/erasure")
async def dsr_erasure(user: Auth):
    """
    Data Subject Rights (DSR) erasure and consent withdrawal.

    Scrubs PII, deactivates the account, anonymizes Supabase Auth identity,
    and removes/soft-clears personal content where product rules allow.
    Matter case files may remain under legitimate interest with identifiers scrubbed.
    """
    db = shared_database.get_service_role_db()
    now = datetime.now(UTC).isoformat()
    scrubbed_name = "Scrubbed User (DSR)"
    deleted_email = f"dsr-deleted-{user.id.replace('-', '')[:16]}@deleted.lead.invalid"

    # Idempotent: already erased
    existing = (
        db.table("profiles")
        .select("id, is_active, dsr_erased_at")
        .eq("id", user.id)
        .execute()
    )
    if existing.data and existing.data[0].get("dsr_erased_at"):
        return {
            "status": "success",
            "message": "Account was already erased.",
            "already_erased": True,
        }

    audit_data = {
        "actor_id": user.id,
        "action": "dsr_consent_withdrawal_erasure",
        "target_type": "profiles",
        "target_id": user.id,
        "changes": {
            "erasure_requested": True,
            "scrubbed_at": now,
            "auth_email_anonymized": True,
        },
    }
    db.table("audit_logs").insert(audit_data).execute()

    # 1. Profile PII + deactivate (service_role bypasses privilege triggers)
    db.table("profiles").update(
        {
            "full_name": scrubbed_name,
            "phone": None,
            "city": None,
            "state": None,
            "avatar_url": None,
            "is_active": False,
            "dsr_erased_at": now,
        }
    ).eq("id", user.id).execute()

    # 2. Lawyer profile commercial / identity fields
    db.table("lawyer_profiles").update(
        {
            "bio": "Scrubbed bio (DSR)",
            "experience_years": 0,
            "bar_council_id": None,
            "enrollment_state": None,
            "is_available": False,
            "is_verified": False,
            "consultation_fee": None,
        }
    ).eq("id", user.id).execute()

    # 3. Scrub client contact fields on matters they own
    try:
        db.table("matters").update(
            {
                "client_email": None,
                "client_phone": None,
            }
        ).eq("user_id", user.id).execute()
    except Exception as e:
        log.warning("DSR: failed to scrub matter client contacts: %s", e)

    # 4. Delete uncommitted intake sessions (raw description is PII-heavy)
    try:
        db.table("intake_sessions").delete().eq("user_id", user.id).eq(
            "is_committed", False
        ).execute()
    except Exception as e:
        log.warning("DSR: failed to delete intake sessions: %s", e)

    # 5. Scrub notification payloads for this user
    try:
        db.table("notifications").update(
            {
                "data": {"scrubbed": True, "reason": "dsr_erasure"},
                "action": None,
            }
        ).eq("user_id", user.id).execute()
    except Exception as e:
        log.warning("DSR: failed to scrub notifications: %s", e)

    # 6. Scrub case messages sent by the user (keep row for thread integrity)
    try:
        db.table("case_messages").update(
            {"content": "[Message removed — DSR erasure]"}
        ).eq("sender_id", user.id).execute()
    except Exception as e:
        log.warning("DSR: failed to scrub case messages: %s", e)

    # 7. Anonymize Supabase Auth user (email/phone) + ban to block re-login
    try:
        from gotrue import AdminUserAttributes

        db.auth.admin.update_user_by_id(
            user.id,
            AdminUserAttributes(
                email=deleted_email,
                phone="",
                user_metadata={"full_name": scrubbed_name, "dsr_erased": True},
                app_metadata={"role": "user", "dsr_erased": True},
                ban_duration="876000h",
            ),
        )
    except Exception as e:
        log.warning("DSR: failed to anonymize auth user %s: %s", user.id, e)
        # Fallback without ban_duration if SDK rejects it
        try:
            from gotrue import AdminUserAttributes

            db.auth.admin.update_user_by_id(
                user.id,
                AdminUserAttributes(
                    email=deleted_email,
                    user_metadata={"full_name": scrubbed_name, "dsr_erased": True},
                    app_metadata={"role": "user", "dsr_erased": True},
                ),
            )
        except Exception as e2:
            log.error("DSR: auth anonymize fallback failed for %s: %s", user.id, e2)

    # 8. Best-effort sign-out all sessions (if supported by SDK)
    try:
        if hasattr(db.auth.admin, "sign_out"):
            db.auth.admin.sign_out(user.id)
    except Exception as e:
        log.warning("DSR: failed to revoke sessions for %s: %s", user.id, e)

    return {
        "status": "success",
        "message": (
            "Consent withdrawn. Personal data scrubbed, account deactivated, "
            "and auth identity anonymized. Some matter records may be retained "
            "under legitimate interest / legal obligation with identifiers removed."
        ),
        "already_erased": False,
    }
