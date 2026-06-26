from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException, Request
from app.shared.dependencies import Auth, LawyerOrAdmin, ensure_lawyer_verified
from app.shared.database import get_db, get_service_role_db
from app.shared.events import emit, EventType
from app.shared.exceptions import NotFound
from app.config import settings
import hmac
import hashlib
from datetime import datetime
from app.domains.matters.schemas import (
    MatterOut,
    MatterUpdateRequest,
    PostUpdateRequest,
    UpdateOut,
    FactOut,
    VerifyFactRequest,
    AssignLawyerRequest,
    HearingOut,
    HearingCreate,
    HearingUpdate,
    MilestoneOut,
    MilestoneCreate,
    MilestoneUpdate,
    MatterCreateRequest,
    MeetingOut,
    MeetingCreate,
    MeetingUpdate,
)
from app.domains.matters.service import (
    enrich,
    get_matter_or_403,
    transition_status,
    SELECT,
)
from app.shared.dependencies import UserRole
from app.domains.matters.documents_router import router as documents_router

from app.config import settings

router = APIRouter(prefix="/matters", tags=["matters"])
router.include_router(documents_router)


@router.get("", response_model=list[MatterOut])
async def list_matters(
    user: Auth,
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    page: int | None = Query(default=None, ge=1),
    per_page: int | None = Query(default=None, ge=1, le=100),
):
    db = get_db()
    q = db.table("matters").select(SELECT)

    if user.role == UserRole.USER:
        q = q.eq("user_id", user.id)
    elif user.role == UserRole.LAWYER:
        ensure_lawyer_verified(user)
        q = q.eq("lawyer_id", user.id)
    # admin: no filter = all matters

    if status:
        q = q.eq("status", status)
    if category:
        q = q.eq("category", category)

    if cursor:
        q = q.lt("created_at", cursor)
        rows = q.order("created_at", desc=True).limit(limit).execute().data or []
    else:
        p = page or 1
        pp = per_page or limit
        off = (p - 1) * pp
        rows = (
            q.order("created_at", desc=True).range(off, off + pp - 1).execute().data
            or []
        )

    return [MatterOut(**enrich(r)) for r in rows]


@router.post("", response_model=MatterOut, status_code=201)
async def create_matter(body: MatterCreateRequest, user: LawyerOrAdmin):
    db = get_db()
    # 1. Insert matter
    r = (
        db.table("matters")
        .insert(
            {
                "title": body.title,
                "summary": body.summary,
                "category": body.category,
                "priority": body.priority,
                "client_email": body.client_email,
                "client_phone": body.client_phone,
                "court_name": body.court_name,
                "case_number": body.case_number,
                "lawyer_id": user.id,
                "status": "active",
            }
        )
        .execute()
        .data[0]
    )

    # 2. Seed default milestones based on category
    default_milestones = [
        {
            "title": "Intake & Consultation",
            "description": "Initial case assessment and client intake completed.",
            "order_index": 1,
            "status": "completed",
        },
        {
            "title": "Drafting Petition",
            "description": "Lawyer drafting case petition and reviewing files.",
            "order_index": 2,
            "status": "current",
        },
        {
            "title": "Filing Case",
            "description": "Filing case in the respective court/forum.",
            "order_index": 3,
            "status": "pending",
        },
        {
            "title": "Summons Issued",
            "description": "Court issuing summons to the opposing party.",
            "order_index": 4,
            "status": "pending",
        },
        {
            "title": "Arguments & Trial",
            "description": "Hearings for arguments, evidence, and trial details.",
            "order_index": 5,
            "status": "pending",
        },
        {
            "title": "Final Order / Judgment",
            "description": "Court pronouncing the final decision/order.",
            "order_index": 6,
            "status": "pending",
        },
    ]
    for dm in default_milestones:
        db.table("matter_milestones").insert({"matter_id": r["id"], **dm}).execute()

    # Enrich & return
    full = db.table("matters").select(SELECT).eq("id", r["id"]).single().execute().data
    milestones = (
        db.table("matter_milestones")
        .select("*")
        .eq("matter_id", r["id"])
        .order("order_index")
        .execute()
        .data
        or []
    )

    enriched = enrich(full, with_facts=False)
    enriched["facts"] = []
    enriched["hearings"] = []
    enriched["milestones"] = milestones
    enriched["meetings"] = []
    return MatterOut(**enriched)


@router.get("/{matter_id}", response_model=MatterOut)
async def get_matter(matter_id: str, user: Auth):
    db = get_db()
    row = get_matter_or_403(db, matter_id, user)

    # Attach facts, hearings, milestones, meetings
    facts = (
        db.table("facts")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    hearings = (
        db.table("hearings")
        .select("*")
        .eq("matter_id", matter_id)
        .order("hearing_date")
        .execute()
        .data
        or []
    )
    milestones = (
        db.table("matter_milestones")
        .select("*")
        .eq("matter_id", matter_id)
        .order("order_index")
        .execute()
        .data
        or []
    )
    meetings = (
        db.table("meetings")
        .select("*")
        .eq("matter_id", matter_id)
        .order("scheduled_at")
        .execute()
        .data
        or []
    )

    enriched = enrich(row, with_facts=True)
    enriched["facts"] = facts
    enriched["hearings"] = hearings
    enriched["milestones"] = milestones
    enriched["meetings"] = meetings
    return MatterOut(**enriched)


@router.patch("/{matter_id}", response_model=MatterOut)
async def update_matter(matter_id: str, body: MatterUpdateRequest, user: Auth):
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    data = body.model_dump(exclude_none=True)
    if "status" in data:
        transition_status(db, matter_id, data.pop("status"), user.id)
    if data:
        db.table("matters").update(data).eq("id", matter_id).execute()

    row = db.table("matters").select(SELECT).eq("id", matter_id).single().execute().data
    return MatterOut(**enrich(row))


# ── Facts ─────────────────────────────────────────────────────────


@router.get("/{matter_id}/facts", response_model=list[FactOut])
async def get_facts(matter_id: str, user: Auth):
    db = get_db()
    get_matter_or_403(db, matter_id, user)
    rows = (
        db.table("facts")
        .select("*")
        .eq("matter_id", matter_id)
        .order("key")
        .execute()
        .data
        or []
    )
    return rows


@router.patch("/{matter_id}/facts/{fact_id}", response_model=FactOut)
async def verify_fact(
    matter_id: str, fact_id: str, body: VerifyFactRequest, user: LawyerOrAdmin
):
    """Lawyer or admin verifies (and optionally corrects) a fact."""
    db = get_db()
    update: dict = {"is_verified": body.is_verified, "source": "lawyer"}
    if body.value is not None:
        update["value"] = body.value

    r = (
        db.table("facts")
        .update(update)
        .eq("id", fact_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not r.data:
        raise NotFound("Fact")

    await emit(
        EventType.FACT_VERIFIED,
        actor_id=user.id,
        matter_id=matter_id,
        payload={"fact_id": fact_id, "key": r.data[0].get("key")},
    )
    return r.data[0]


# ── Updates / timeline ────────────────────────────────────────────


@router.get("/{matter_id}/updates", response_model=list[UpdateOut])
async def get_updates(matter_id: str, user: Auth):
    db = get_db()
    get_matter_or_403(db, matter_id, user)
    q = (
        db.table("matter_updates")
        .select("*, profiles!author_id(full_name)")
        .eq("matter_id", matter_id)
    )
    if user.role == UserRole.USER:
        q = q.eq("is_internal", False)
    rows = q.order("created_at", desc=False).execute().data or []

    all_updates = []
    for r in rows:
        author_name = (r.pop("profiles", None) or {}).get("full_name")
        all_updates.append(
            UpdateOut(**{**r, "author_name": author_name, "replies": []})
        )

    lookup = {u.id: u for u in all_updates}
    roots = []
    for u in all_updates:
        if u.parent_id and u.parent_id in lookup:
            lookup[u.parent_id].replies.append(u)
        else:
            roots.append(u)
    return roots


@router.post("/{matter_id}/updates", response_model=UpdateOut, status_code=201)
async def post_update(matter_id: str, body: PostUpdateRequest, user: Auth):
    from app.shared.exceptions import Forbidden, BadRequest

    if body.is_internal and user.role == UserRole.USER:
        raise Forbidden("Only lawyers/admins can post internal notes")
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    insert_data = {
        "matter_id": matter_id,
        "author_id": user.id,
        "content": body.content,
        "is_internal": body.is_internal,
    }
    if body.parent_id:
        parent = (
            db.table("matter_updates")
            .select("matter_id")
            .eq("id", body.parent_id)
            .execute()
            .data
        )
        if not parent or parent[0]["matter_id"] != matter_id:
            raise BadRequest("Invalid parent update ID")
        insert_data["parent_id"] = body.parent_id

    r = db.table("matter_updates").insert(insert_data).execute().data[0]
    full = (
        db.table("matter_updates")
        .select("*, profiles!author_id(full_name)")
        .eq("id", r["id"])
        .single()
        .execute()
        .data
    )
    author_name = (full.pop("profiles", None) or {}).get("full_name")

    await emit(
        EventType.UPDATE_POSTED,
        actor_id=user.id,
        matter_id=matter_id,
        payload={"author_name": author_name, "preview": body.content},
    )

    return UpdateOut(**{**full, "author_name": author_name})


# ── Events (audit trail) ──────────────────────────────────────────


@router.get("/{matter_id}/events")
async def get_events(
    matter_id: str,
    user: Auth,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    db = get_db()
    get_matter_or_403(db, matter_id, user)
    off = (page - 1) * per_page
    rows = (
        db.table("events")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at")
        .range(off, off + per_page - 1)
        .execute()
        .data
        or []
    )
    return rows


# ── Lawyer assignment ─────────────────────────────────────────────


@router.post("/{matter_id}/assign", status_code=201)
async def assign_lawyer(matter_id: str, body: AssignLawyerRequest, user: Auth):
    from datetime import datetime, timezone
    from fastapi import HTTPException

    if user.role == UserRole.LAWYER:
        raise HTTPException(
            status_code=403, detail="Lawyers cannot initiate lawyer assignments"
        )

    db = get_db()
    get_matter_or_403(db, matter_id, user)

    # Validate target lawyer exists and is active with lawyer role
    lawyer_profile = (
        db.table("profiles")
        .select("role, is_active")
        .eq("id", body.lawyer_id)
        .execute()
        .data
    )
    if not lawyer_profile:
        raise HTTPException(status_code=400, detail="Target user does not exist")
    if lawyer_profile[0]["role"] != "lawyer":
        raise HTTPException(status_code=400, detail="Target user is not a lawyer")
    if not lawyer_profile[0]["is_active"]:
        raise HTTPException(status_code=400, detail="Target lawyer is not active")

    is_admin = user.role == UserRole.ADMIN
    status_ = "accepted" if is_admin else "pending"

    db.table("matter_assignments").insert(
        {
            "matter_id": matter_id,
            "lawyer_id": body.lawyer_id,
            "assigned_by": user.id,
            "status": status_,
            "notes": body.notes,
        }
    ).execute()

    if is_admin:
        db.table("matters").update(
            {
                "lawyer_id": body.lawyer_id,
                "status": "active",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", matter_id).execute()

    await emit(
        EventType.LAWYER_ASSIGNED,
        actor_id=user.id,
        matter_id=matter_id,
        payload={"lawyer_id": body.lawyer_id, "direct": is_admin},
    )
    return {
        "ok": True,
        "message": "Lawyer assigned" if is_admin else "Request sent to lawyer",
    }


# ── Hearings ───────────────────────────────────────────────────────


@router.post("/{matter_id}/hearings", response_model=HearingOut, status_code=201)
async def create_hearing(matter_id: str, body: HearingCreate, user: LawyerOrAdmin):
    if not settings.FEATURE_HEARINGS:
        raise HTTPException(status_code=404, detail="Hearings feature not available")
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    r = (
        db.table("hearings")
        .insert(
            {
                "matter_id": matter_id,
                "hearing_date": body.hearing_date.isoformat(),
                "courtroom": body.courtroom,
                "judge": body.judge,
                "purpose": body.purpose,
                "notes": body.notes,
                "status": body.status,
            }
        )
        .execute()
        .data[0]
    )

    await emit(
        (
            EventType.HEARING_SCHEDULED
            if body.status == "scheduled"
            else EventType.HEARING_UPDATED
        ),
        actor_id=user.id,
        matter_id=matter_id,
        payload={"hearing_id": r["id"]},
    )
    return r


@router.patch("/{matter_id}/hearings/{hearing_id}", response_model=HearingOut)
async def update_hearing(
    matter_id: str, hearing_id: str, body: HearingUpdate, user: LawyerOrAdmin
):
    if not settings.FEATURE_HEARINGS:
        raise HTTPException(status_code=404, detail="Hearings feature not available")
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    data = body.model_dump(exclude_none=True)
    if "hearing_date" in data and data["hearing_date"]:
        data["hearing_date"] = data["hearing_date"].isoformat()

    r = (
        db.table("hearings")
        .update(data)
        .eq("id", hearing_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not r.data:
        raise NotFound("Hearing")

    await emit(
        EventType.HEARING_UPDATED,
        actor_id=user.id,
        matter_id=matter_id,
        payload={"hearing_id": hearing_id},
    )
    return r.data[0]


# ── Milestones ─────────────────────────────────────────────────────


@router.post("/{matter_id}/milestones", response_model=MilestoneOut, status_code=201)
async def create_milestone(matter_id: str, body: MilestoneCreate, user: LawyerOrAdmin):
    if not settings.FEATURE_MILESTONES:
        raise HTTPException(status_code=404, detail="Milestones feature not available")
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    r = (
        db.table("matter_milestones")
        .insert(
            {
                "matter_id": matter_id,
                "title": body.title,
                "description": body.description,
                "order_index": body.order_index,
                "status": body.status,
                "amount_inr": body.amount_inr,
            }
        )
        .execute()
        .data[0]
    )

    return r


@router.patch("/{matter_id}/milestones/{milestone_id}", response_model=MilestoneOut)
async def update_milestone(
    matter_id: str, milestone_id: str, body: MilestoneUpdate, user: Auth
):
    if not settings.FEATURE_MILESTONES:
        raise HTTPException(status_code=404, detail="Milestones feature not available")

    data = body.model_dump(exclude_none=True)

    # If client/user tries to pay bill
    if (
        "is_paid" in data
        or "payment_gateway_ref" in data
        or "payment_record_id" in data
    ):
        if not settings.FEATURE_BILLING:
            raise HTTPException(status_code=404, detail="Billing feature not available")

    db = get_db()
    get_matter_or_403(db, matter_id, user)

    if user.role == "user":
        # Users can only update payment fields (excluding is_paid)
        allowed_keys = {
            "payment_gateway_ref",
            "payment_record_id",
            "payment_idempotency_key",
        }
        data = {k: v for k, v in data.items() if k in allowed_keys}
        if not data:
            raise HTTPException(
                status_code=403,
                detail="Users can only update payment status of milestones.",
            )

    if "completed_at" in data and data["completed_at"]:
        data["completed_at"] = data["completed_at"].isoformat()

    try:
        r = (
            db.table("matter_milestones")
            .update(data)
            .eq("id", milestone_id)
            .eq("matter_id", matter_id)
            .execute()
        )
        if not r.data:
            raise NotFound("Milestone")
        milestone = r.data[0]
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "already exists" in msg or "unique" in msg:
            pkey = data.get("payment_idempotency_key")
            if pkey:
                existing = (
                    db.table("matter_milestones")
                    .select("*")
                    .eq("payment_idempotency_key", pkey)
                    .execute()
                )
                if existing.data:
                    if existing.data[0]["id"] == milestone_id:
                        return existing.data[0]
                    else:
                        raise HTTPException(
                            status_code=400,
                            detail="Idempotency key already used for another milestone",
                        )
        raise e

    await emit(
        EventType.MILESTONE_UPDATED,
        actor_id=user.id,
        matter_id=matter_id,
        payload={"milestone_id": milestone_id},
    )
    return milestone


# -- Meetings -------------------------------------------------------


@router.post("/{matter_id}/meetings", response_model=MeetingOut, status_code=201)
async def create_meeting(matter_id: str, body: MeetingCreate, user: Auth):
    from fastapi import HTTPException

    db = get_db()
    get_matter_or_403(db, matter_id, user)

    try:
        r = (
            db.rpc(
                "schedule_meeting",
                {
                    "p_matter_id": matter_id,
                    "p_scheduled_at": body.scheduled_at.isoformat(),
                    "p_duration_minutes": body.duration_minutes,
                    "p_notes": body.notes,
                    "p_meeting_link": body.meeting_link,
                },
            )
            .execute()
            .data
        )
    except Exception as e:
        if "Session limit reached" in str(e):
            raise HTTPException(
                status_code=403,
                detail="Session limit reached for this consultation. Upgrade to book more meetings.",
            )
        raise e

    await emit(
        EventType.MEETING_SCHEDULED,
        actor_id=user.id,
        matter_id=matter_id,
        payload={"meeting_id": r["id"]},
    )
    return r


@router.patch("/{matter_id}/meetings/{meeting_id}", response_model=MeetingOut)
async def update_meeting(
    matter_id: str, meeting_id: str, body: MeetingUpdate, user: Auth
):
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    # Check existing meeting status to prevent double-counting sessions_used
    existing = (
        db.table("meetings")
        .select("status")
        .eq("id", meeting_id)
        .eq("matter_id", matter_id)
        .single()
        .execute()
        .data
    )
    if not existing:
        raise NotFound("Meeting")

    data = body.model_dump(exclude_none=True)
    if "scheduled_at" in data and data["scheduled_at"]:
        data["scheduled_at"] = data["scheduled_at"].isoformat()

    r = (
        db.table("meetings")
        .update(data)
        .eq("id", meeting_id)
        .eq("matter_id", matter_id)
        .execute()
    )

    # If transitioning to completed, atomically increment sessions_used via RPC.
    # Using an RPC avoids the read-then-write race where two concurrent completions
    # both read the same sessions_used value and one increment gets lost.
    if body.status == "completed" and existing["status"] != "completed":
        db.rpc("increment_sessions_used", {"p_matter_id": matter_id}).execute()
        await emit(
            EventType.MEETING_COMPLETED,
            actor_id=user.id,
            matter_id=matter_id,
            payload={"meeting_id": meeting_id},
        )

    return r.data[0]


@router.post("/webhook/payment")
async def payment_webhook(request: Request):
    # 1. Read request body
    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")

    # 2. Verify signature
    # In non-production, allow signature verification bypass if signature is "mock"
    is_mock = settings.APP_ENV != "production" and signature == "mock"
    
    if not is_mock:
        if not signature:
            raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")
        
        expected_sig = hmac.new(
            settings.PAYMENT_WEBHOOK_SECRET.encode(),
            body_bytes,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Parse payload
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event = payload.get("event")
    if event != "payment.captured":
        return {"status": "ignored", "reason": f"Unhandled event type: {event}"}

    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    payment_id = payment_entity.get("id")
    notes = payment_entity.get("notes", {})
    milestone_id = notes.get("milestone_id")
    idemp_key = notes.get("payment_idempotency_key")

    if not milestone_id:
        raise HTTPException(status_code=400, detail="Missing milestone_id in notes")

    # 4. Fetch milestone and verify existence
    db = get_service_role_db()
    milestone_res = db.table("matter_milestones").select("*").eq("id", milestone_id).execute()
    if not milestone_res.data:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone = milestone_res.data[0]

    # Idempotency check: if already paid
    if milestone.get("is_paid"):
        return {"status": "success", "message": "Milestone already paid", "milestone_id": milestone_id}

    if idemp_key:
        existing_key_res = db.table("matter_milestones").select("id", "is_paid", "payment_gateway_ref").eq("payment_idempotency_key", idemp_key).execute()
        if existing_key_res.data:
            existing = existing_key_res.data[0]
            if existing["id"] == milestone_id:
                return {"status": "success", "message": "Milestone already paid", "milestone_id": milestone_id}
            else:
                raise HTTPException(status_code=400, detail="Idempotency key already used for another milestone")

    # 5. Get matter and user details
    matter_id = milestone["matter_id"]
    matter_res = db.table("matters").select("user_id").eq("id", matter_id).execute()
    user_id = None
    if matter_res.data:
        user_id = matter_res.data[0].get("user_id")

    # 6. Perform database update
    update_data = {
        "is_paid": True,
        "payment_gateway_ref": payment_id,
        "payment_idempotency_key": idemp_key,
        "completed_at": datetime.utcnow().isoformat()
    }
    
    # Check if we should insert a payment record in payments table
    payment_record_id = None
    if settings.FEATURE_BILLING:
        payment_data = {
            "milestone_id": milestone_id,
            "user_id": user_id,
            "amount_inr": float(milestone["amount_inr"]) if milestone.get("amount_inr") is not None else 0.0,
            "status": "completed",
            "payment_id": payment_id,
            "payment_idempotency_key": idemp_key
        }
        pay_res = db.table("payments").insert(payment_data).execute()
        if pay_res.data:
            payment_record_id = pay_res.data[0].get("id")
            update_data["payment_record_id"] = payment_record_id

    # Update the milestone
    db.table("matter_milestones").update(update_data).eq("id", milestone_id).execute()

    # Emit MILESTONE_UPDATED event
    actor_id = user_id or "00000000-0000-0000-0000-000000000000"
    await emit(
        EventType.MILESTONE_UPDATED,
        actor_id=actor_id,
        matter_id=matter_id,
        payload={"milestone_id": milestone_id},
    )

    return {
        "status": "success",
        "milestone_id": milestone_id,
        "payment_gateway_ref": payment_id,
        "payment_record_id": payment_record_id
    }
