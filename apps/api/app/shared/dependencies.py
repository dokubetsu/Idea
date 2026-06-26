from __future__ import annotations
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from enum import Enum
from app.shared.database import get_db
from app.shared.jwt import decode_token

bearer = HTTPBearer(auto_error=False)


class UserRole(str, Enum):
    USER = "user"
    LAWYER = "lawyer"
    ADMIN = "admin"


class CurrentUser(BaseModel):
    id: str
    role: UserRole
    full_name: str


def _decode_jwt(token: str) -> dict:
    return decode_token(token)


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> CurrentUser:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _decode_jwt(creds.credentials)
    user_id = payload.get("sub", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = get_db()
    result = (
        db.table("profiles")
        .select("id,role,full_name,is_active")
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="Profile not found")

    p = result.data[0]
    if not p["is_active"]:
        raise HTTPException(status_code=403, detail="Account suspended")

    return CurrentUser(id=p["id"], role=UserRole(p["role"]), full_name=p["full_name"])


def require_roles(*roles: UserRole):
    async def _guard(
        user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=403, detail=f"Requires: {[r.value for r in roles]}"
            )
        return user

    return _guard


# Type aliases — use these in route signatures
Auth = Annotated[CurrentUser, Depends(get_current_user)]
AdminAuth = Annotated[CurrentUser, Depends(require_roles(UserRole.ADMIN))]
LawyerAuth = Annotated[CurrentUser, Depends(require_roles(UserRole.LAWYER))]
UserAuth = Annotated[
    CurrentUser, Depends(require_roles(UserRole.USER, UserRole.LAWYER, UserRole.ADMIN))
]
PetitionerAuth = Annotated[CurrentUser, Depends(require_roles(UserRole.USER))]
LawyerOrAdmin = Annotated[
    CurrentUser, Depends(require_roles(UserRole.LAWYER, UserRole.ADMIN))
]
