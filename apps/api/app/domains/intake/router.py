"""
/api/v1/intake

The intake workflow — 4 steps:
  1. POST /start         → describe situation → extract facts
  2. PATCH /:id/facts    → user reviews/corrects facts
  3. POST /:id/assess    → run assessment on facts
  4. POST /:id/commit    → create matter from session
"""
import logging
from fastapi import APIRouter, Request, HTTPException
from app.shared.limiter import limiter
from app.shared.dependencies import Auth, UserAuth
from app.shared.events import emit, EventType
from app.shared.database import get_db
from app.shared.exceptions import NotFound, Forbidden, BadRequest

log = logging.getLogger(__name__)
from app.domains.intake.facts_engine import extract_facts
from app.domains.intake.schemas import (
    StartIntakeRequest, UpdateFactsRequest,
    CommitIntakeRequest, IntakeSessionOut,
)
from app.domains.assessment.service import run_assessment
from app.domains.assessment.providers.base import AssessmentInput

router = APIRouter(prefix="/intake", tags=["intake"])


@router.post("/start", response_model=IntakeSessionOut, status_code=201)
@limiter.limit("5/minute")
async def start_intake(request: Request, body: StartIntakeRequest, user: Auth):
    """Step 1: Extract facts from description."""
    result = await extract_facts(body.title, body.description)

    db  = get_db()
    row = db.table("intake_sessions").insert({
        "user_id":          user.id,
        "step":             "facts_review",
        "raw_description":  body.description,
        "schema_version":   2,
        "extracted_facts": {
            "title":              body.title,
            "detected_category":  result.detected_category,
            "completeness_score": result.completeness_score,
            "missing_keys":       result.missing_keys,
            "facts": [f.model_dump() for f in result.facts],
            "schema_version":     2,
        },
        "provider_used": result.provider,
    }).execute().data[0]

    await emit(EventType.INTAKE_STARTED, actor_id=user.id, payload={
        "session_id": row["id"], "category": result.detected_category,
    })

    return _session_out(row)


@router.patch("/{session_id}/facts", response_model=IntakeSessionOut)
async def update_facts(session_id: str, body: UpdateFactsRequest, user: Auth):
    """Step 2: User reviews / corrects extracted facts."""
    db      = get_db()
    session = _get_session(db, session_id, user.id)

    if session["step"] not in ("facts_review", "assessment"):
        raise BadRequest(f"Cannot update facts. Expected session step to be 'facts_review', but got '{session['step']}'")

    existing = session["extracted_facts"]
    existing["facts"] = [f.model_dump() for f in body.facts]

    updated = db.table("intake_sessions").update({
        "extracted_facts": existing,
        "step": "assessment",
    }).eq("id", session_id).execute().data[0]

    await emit(EventType.INTAKE_FACTS_SAVED, actor_id=user.id, payload={"session_id": session_id})
    return _session_out(updated)


@router.post("/{session_id}/assess", response_model=IntakeSessionOut)
@limiter.limit("5/minute")
async def run_intake_assessment(request: Request, session_id: str, user: Auth):
    """Step 3: Run assessment on current facts."""
    db      = get_db()
    session = _get_session(db, session_id, user.id)

    if session["step"] not in ("assessment", "confirm"):
        raise BadRequest(f"Cannot run assessment. Expected session step to be 'assessment', but got '{session['step']}'")

    facts_data = session["extracted_facts"]
    facts_dict = {f["key"]: f["value"] for f in facts_data.get("facts", [])}

    assessment = await run_assessment(AssessmentInput(
        title=facts_data.get("title", ""),
        facts=facts_dict,
        raw_description=session.get("raw_description"),
    ))

    updated = db.table("intake_sessions").update({
        "assessment_result": assessment.model_dump(),
        "provider_used": assessment.provider,
        "step": "confirm",
    }).eq("id", session_id).execute().data[0]

    await emit(EventType.ASSESSMENT_COMPLETED, actor_id=user.id, payload={
        "session_id": session_id,
        "provider": assessment.provider,
        "risk_level": assessment.risk_level,
        "success_probability": assessment.success_probability,
    })
    return _session_out(updated)


@router.post("/{session_id}/commit", status_code=201)
@limiter.limit("5/minute")
async def commit_intake(request: Request, session_id: str, user: Auth, body: CommitIntakeRequest | None = None):
    """
    Step 4: Commit — create matter + persist facts + emit events.
    Returns the created matter.

    FIX D: `user: Auth` (no `= None` default). The `Auth` alias is
    `Annotated[CurrentUser, Depends(get_current_user)]`. Placing it before the
    optional `body` arg avoids a misleading `None` default while keeping
    slowapi happy (request is still the first arg).
    """
    db      = get_db()
    session = _get_session(db, session_id, user.id)

    if session["step"] != "confirm":
        raise BadRequest(f"Cannot commit. Expected session step to be 'confirm', but got '{session['step']}'")

    if session["is_committed"]:
        return {"matter_id": session["matter_id"], "already_committed": True}

    if body and body.confirmed_facts:
        facts_data = session["extracted_facts"]
        facts_data["facts"] = body.confirmed_facts
        db.table("intake_sessions").update({"extracted_facts": facts_data}).eq("id", session_id).execute()
        session["extracted_facts"] = facts_data

    facts_data = session["extracted_facts"]
    assessment = session.get("assessment_result") or {}

    category = assessment.get("category") or facts_data.get("detected_category", "other")
    db_category = {
        "cheque_bounce": "cheque_bounce",
        "bank_fraud": "cyber",
        "tax_dispute": "other",
        "money_recovery": "other",
        "other_finance": "other",
        
        "product_defect": "consumer",
        "service_deficiency": "consumer",
        "ecommerce_dispute": "consumer",
        "insurance_rejection": "consumer",
        "medical_negligence": "other",
        
        "delayed_possession": "rera",
        "project_cancellation": "rera",
        "structural_defects": "rera",
        "amenities_misrepresentation": "rera",
        
        "accident_injury": "other",
        "accident_death": "other",
        "mv_insurance_rejection": "other",
        "hit_and_run": "other",
        "license_rc_dispute": "other",
    }.get(category, category)
    priority = _risk_to_priority(assessment.get("risk_level", "medium"))

    fact_rows = []
    for f in facts_data.get("facts", []):
        if f.get("key") and f.get("value") is not None and f.get("value") != "":
            raw_type = f.get("type") or f.get("value_type", "text")
            db_type = {
                "text": "string",
                "number": "number",
                "boolean": "boolean",
                "date": "date",
                "array": "json"
            }.get(raw_type, "string")
            
            fact_rows.append({
                "key":        f["key"],
                "value":      str(f["value"]),
                "value_type": db_type,
                "label":      f.get("label", f["key"].replace("_", " ").title()),
                "source":     f.get("source", "ai"),
                "confidence": f.get("confidence", 0.9),
            })

    # Execute commit inside an atomic database transaction via RPC
    try:
        rpc_res = db.rpc("commit_intake", {
            "p_session_id": session_id,
            "p_user_id": user.id,
            "p_title": facts_data.get("title", "Untitled matter"),
            "p_summary": assessment.get("success_rationale", facts_data.get("title", "")),
            "p_category": db_category,
            "p_status": "intake" if not assessment else "assessment",
            "p_priority": priority,
            "p_facts": fact_rows,
            "p_assessment_summary": _format_assessment_update(assessment) if assessment else None
        }).execute()
    except Exception as e:
        log.error("RPC commit_intake failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Database transaction failed during commit.")

    if not rpc_res.data:
        raise HTTPException(status_code=500, detail="Failed to commit intake session")

    commit_data = rpc_res.data[0]
    matter_id = commit_data["matter_id"]
    already_committed = commit_data["already_committed"]

    if already_committed:
        existing = db.table("matters").select("status").eq("id", matter_id).execute().data
        existing_status = existing[0]["status"] if existing else "intake"
        return {"matter_id": matter_id, "status": existing_status, "category": category, "already_committed": True}

    # Emit events
    await emit(EventType.MATTER_CREATED, actor_id=user.id, matter_id=matter_id, payload={
        "category": category, "priority": priority,
    })
    await emit(EventType.INTAKE_COMPLETED, actor_id=user.id, matter_id=matter_id, payload={
        "session_id": session_id, "facts_count": len(fact_rows),
    })

    status_ = "intake" if not assessment else "assessment"
    return {"matter_id": matter_id, "status": status_, "category": category}


@router.get("/{session_id}", response_model=IntakeSessionOut)
async def get_session(session_id: str, user: Auth):
    db = get_db()
    return _session_out(_get_session(db, session_id, user.id))


# ── Helpers ──────────────────────────────────────────────────────

def migrate_extracted_facts(ef: dict, row: dict) -> dict:
    import re
    if not isinstance(ef, dict):
        ef = {}
    version = ef.get("schema_version", 0)
    if version >= 2:
        return ef

    # If it is version 0 (or completely unstructured flat dict) or version 1
    # Version 1 would have "facts" key, but version 0 (flat dict) does not
    if "facts" not in ef:
        # Migrate flat key-value to structured facts list
        facts_list = []
        for k, v in ef.items():
            if k in ("title", "detected_category", "completeness_score", "missing_keys", "schema_version"):
                continue
            # Guess the type of the value
            val_type = "text"
            if isinstance(v, bool):
                val_type = "boolean"
            elif isinstance(v, (int, float)):
                val_type = "number"
            elif isinstance(v, list):
                val_type = "array"
            # simple date regex guess
            elif isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", v):
                val_type = "date"

            facts_list.append({
                "key": k,
                "value": v,
                "value_type": val_type,
                "label": k.replace("_", " ").title(),
                "confidence": 1.0,
                "source": "user"
            })
        
        migrated = {
            "title": ef.get("title") or row.get("raw_description", "Migrated Case")[:50] or "Migrated Case",
            "detected_category": ef.get("detected_category") or "other",
            "completeness_score": ef.get("completeness_score") or 1.0,
            "missing_keys": ef.get("missing_keys") or row.get("missing_keys") or [],
            "facts": facts_list,
            "schema_version": 2
        }
        return migrated
    
    # If it is version 1 (has "facts" but lacks schema_version), we just add schema_version: 2
    if "schema_version" not in ef:
        ef = dict(ef)
        ef["schema_version"] = 2
        
    return ef


def _get_session(db, session_id: str, user_id: str) -> dict:
    r = db.table("intake_sessions").select("*").eq("id", session_id).single().execute()
    if not r.data:
        raise NotFound("Intake session")
    if r.data["user_id"] != user_id:
        raise Forbidden()
    
    row = r.data
    row["extracted_facts"] = migrate_extracted_facts(row.get("extracted_facts", {}), row)
    return row


def _session_out(row: dict) -> IntakeSessionOut:
    ef = row.get("extracted_facts", {})
    return IntakeSessionOut(
        id=row["id"],
        step=row["step"],
        raw_description=row.get("raw_description"),
        extracted_facts=ef,
        assessment_result=row.get("assessment_result"),
        completeness_score=ef.get("completeness_score"),
        missing_keys=ef.get("missing_keys", []),
        provider_used=row.get("provider_used"),
        is_committed=row.get("is_committed", False),
        matter_id=row.get("matter_id"),
        created_at=str(row.get("created_at", "")),
    )


def _risk_to_priority(risk: str) -> str:
    return {"urgent": "urgent", "high": "high", "medium": "medium", "low": "low"}.get(risk, "medium")


def _format_assessment_update(a: dict) -> str:
    # FIX E: Coerce budget values to int before using the :, format specifier.
    # AI providers may return these as strings (e.g. "50000") which would crash
    # with TypeError: unsupported format character.
    def _fmt_money(val, default: int = 0) -> str:
        try:
            return f"{int(float(str(val))):,}"
        except (TypeError, ValueError):
            return str(val) if val else str(default)

    lines = [
        "📋 **AI Legal Assessment**\n",
        f"**Category:** {a.get('category','—').replace('_',' ').title()}",
        f"**Risk:** {a.get('risk_level','—').upper()}  |  **Success probability:** {a.get('success_probability','—')}%",
        f"**Timeline:** {a.get('timeline_min_months','—')}–{a.get('timeline_max_months','—')} months",
        f"**Budget estimate:** ₹{_fmt_money(a.get('budget_min_inr'))} – ₹{_fmt_money(a.get('budget_max_inr'))}",
        f"**Recommended forum:** {a.get('recommended_forum','—')}\n",
        "**Immediate actions:**",
    ]
    for action in a.get("immediate_actions", []):
        lines.append(f"• {action}")
    if a.get("limitation_risk"):
        lines.append(f"\n⚠️ **Deadline:** {a['limitation_risk']}")
    lines.append(f"\n_{a.get('notes','')}_")
    return "\n".join(lines)
