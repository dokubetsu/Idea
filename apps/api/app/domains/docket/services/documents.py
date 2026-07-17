from __future__ import annotations
import logging
import os
import uuid
from app.shared.database import get_db
from app.shared.dependencies import CurrentUser, UserRole
from app.shared.exceptions import NotFound, Forbidden, BadRequest

from app.domains.docket.services.helpers import (
    _now,
    _get_matter_for_participant,
    _ensure_lawyer_on_matter,
)

logger = logging.getLogger(__name__)


# ── Documents (Review) ────────────────────────────────────────────


def list_documents(matter_id: str, user: CurrentUser) -> list:
    """List documents for a matter, role-filtered."""
    matter = _get_matter_for_participant(matter_id, user)
    db = get_db()

    query = db.table("documents").select("*").eq("matter_id", matter_id)

    # Clients don't see lawyer_only docs
    if user.role == UserRole.USER:
        query = query.neq("visibility", "lawyer_only")

    result = query.order("created_at", desc=True).execute()
    documents = result.data or []

    client_id = matter.get("user_id")
    for doc in documents:
        doc["uploaded_by_client"] = doc.get("uploaded_by") == client_id

    return documents


def review_document(matter_id: str, doc_id: str, user: CurrentUser, data: dict) -> dict:
    """Approve or reject a document, notifying the client."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    # Update metadata with review status and note
    doc_result = (
        db.table("documents")
        .select("id,name,metadata")
        .eq("id", doc_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not doc_result.data:
        raise NotFound("Document")

    doc = doc_result.data[0]
    meta = doc.get("metadata") or {}
    meta["review_status"] = data["status"]
    meta["reviewed_at"] = _now().isoformat()
    meta["reviewed_by"] = user.id
    if data.get("lawyer_note"):
        meta["lawyer_note"] = data["lawyer_note"]

    result = db.table("documents").update({"metadata": meta}).eq("id", doc_id).execute()
    if not result.data:
        raise BadRequest("Failed to update document")

    # Create timeline event to notify client
    action = "approved" if data["status"] == "approved" else "rejected"
    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": f"document_{action}",
            "lawyer_description": f"Document '{doc['name']}' {action}",
            "client_description": f"Your document '{doc['name']}' has been {action} by your lawyer."
            + (f" Note: {data['lawyer_note']}" if data.get("lawyer_note") else ""),
            "occurred_at": _now().isoformat(),
            "metadata": {"document_id": doc_id},
        }
    ).execute()

    return result.data[0]


def update_document_note(
    matter_id: str, doc_id: str, user: CurrentUser, note: str
) -> dict:
    """Add or update a lawyer's note on a document."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    doc_result = (
        db.table("documents")
        .select("id,metadata")
        .eq("id", doc_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not doc_result.data:
        raise NotFound("Document")

    meta = doc_result.data[0].get("metadata") or {}
    meta["lawyer_note"] = note
    meta["note_updated_at"] = _now().isoformat()

    result = db.table("documents").update({"metadata": meta}).eq("id", doc_id).execute()
    if not result.data:
        raise BadRequest("Failed to update note")
    return result.data[0]


# ── Document Requests ──────────────────────────────────────────────


def create_document_request(matter_id: str, user: CurrentUser, data: dict) -> dict:
    """Lawyer asks the client to upload a specific document."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    payload = {
        "matter_id": matter_id,
        "requested_by": user.id,
        "title": data["title"],
        "description": data.get("description"),
        "label": data.get("label", "other"),
        "status": "pending",
    }
    result = db.table("document_requests").insert(payload).execute()
    if not result.data:
        raise BadRequest("Failed to create document request")
    request = result.data[0]

    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "document_requested",
            "lawyer_description": f"Requested document: {data['title']}",
            "client_description": f"Your lawyer requested a document: {data['title']}",
            "occurred_at": _now().isoformat(),
            "metadata": {"request_id": request["id"]},
        }
    ).execute()

    return request


def list_document_requests(matter_id: str, user: CurrentUser) -> list:
    """List document requests for a matter."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()
    result = (
        db.table("document_requests")
        .select("*")
        .eq("matter_id", matter_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def cancel_document_request(matter_id: str, request_id: str, user: CurrentUser) -> dict:
    """Lawyer cancels a pending document request."""
    _ensure_lawyer_on_matter(matter_id, user)
    db = get_db()

    req_result = (
        db.table("document_requests")
        .select("id,status")
        .eq("id", request_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not req_result.data:
        raise NotFound("Document request")
    if req_result.data[0]["status"] == "fulfilled":
        raise BadRequest(
            "This request has already been fulfilled and can't be cancelled"
        )

    result = (
        db.table("document_requests")
        .update({"status": "cancelled"})
        .eq("id", request_id)
        .execute()
    )
    if not result.data:
        raise BadRequest("Failed to cancel document request")
    return result.data[0]


def fulfill_document_request(
    matter_id: str,
    request_id: str,
    user: CurrentUser,
    filename: str,
    content_type: str,
    file_bytes: bytes,
) -> dict:
    """Client uploads a file to fulfill a lawyer's document request."""
    _get_matter_for_participant(matter_id, user)
    if user.role == UserRole.LAWYER:
        raise Forbidden("Only the client on this matter can fulfill a document request")

    db = get_db()

    req_result = (
        db.table("document_requests")
        .select("*")
        .eq("id", request_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not req_result.data:
        raise NotFound("Document request")
    request = req_result.data[0]
    if request["status"] == "fulfilled":
        raise BadRequest("This document request has already been fulfilled")

    safe_filename = os.path.basename(filename or "document")
    storage_path = f"{matter_id}/{uuid.uuid4().hex[:8]}-{safe_filename}"

    try:
        db.storage.from_("matter_documents").upload(
            storage_path,
            file_bytes,
            {"content-type": content_type or "application/octet-stream"},
        )
    except Exception:
        logger.exception(
            "[Docket] Failed to upload document for request %s", request_id
        )
        raise BadRequest("Failed to upload file. Please try again.")

    doc_result = (
        db.table("documents")
        .insert(
            {
                "matter_id": matter_id,
                "uploaded_by": user.id,
                "name": safe_filename,
                "storage_path": storage_path,
                "file_type": content_type,
                "file_size": len(file_bytes),
                "classification": request["label"],
                "visibility": "client_visible",
                "metadata": {"request_id": request_id, "review_status": "under_review"},
            }
        )
        .execute()
    )
    if not doc_result.data:
        raise BadRequest("Failed to record uploaded document")
    document = doc_result.data[0]

    db.table("document_requests").update(
        {
            "status": "fulfilled",
            "document_id": document["id"],
            "fulfilled_at": _now().isoformat(),
        }
    ).eq("id", request_id).execute()

    db.table("timeline_events").insert(
        {
            "matter_id": matter_id,
            "event_type": "document_uploaded",
            "lawyer_description": f"Client uploaded '{safe_filename}' for request: {request['title']}",
            "client_description": f"You uploaded '{safe_filename}' for your lawyer's request: {request['title']}",
            "occurred_at": _now().isoformat(),
            "metadata": {"document_id": document["id"], "request_id": request_id},
        }
    ).execute()

    return document


def get_document_download_url(matter_id: str, doc_id: str, user: CurrentUser) -> dict:
    """Generate a short-lived signed download URL for a document."""
    _get_matter_for_participant(matter_id, user)
    db = get_db()

    doc_result = (
        db.table("documents")
        .select("id,storage_path,visibility")
        .eq("id", doc_id)
        .eq("matter_id", matter_id)
        .execute()
    )
    if not doc_result.data:
        raise NotFound("Document")

    doc = doc_result.data[0]
    if user.role == UserRole.USER and doc.get("visibility") == "lawyer_only":
        raise Forbidden("This document is not shared with you")

    try:
        res = db.storage.from_("matter_documents").create_signed_url(
            doc["storage_path"], 60
        )
        return {"url": res["signedUrl"]}
    except Exception:
        logger.exception("[Docket] Failed to create signed URL for document %s", doc_id)
        raise BadRequest("Failed to generate download link. Please try again later.")
