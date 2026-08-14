import logging
import os

from app.domains.matters.documents import DocumentUploadRequest, PreSignedUrlResponse
from app.domains.matters.service import get_matter_or_403
from app.shared.database import get_db
from app.shared.dependencies import Auth
from fastapi import APIRouter, HTTPException

log = logging.getLogger(__name__)
router = APIRouter()


ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}


@router.post("/{matter_id}/documents/upload-url", response_model=PreSignedUrlResponse)
async def get_upload_url(matter_id: str, body: DocumentUploadRequest, user: Auth):
    db = get_db()
    # Check matter access (user owns it or lawyer assigned to it)
    get_matter_or_403(db, matter_id, user)

    # Validate content type
    if (
        not body.content_type
        or body.content_type.strip().lower() not in ALLOWED_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or unsupported file type. Only PDFs, images, text, and Word documents are allowed.",
        )

    # Path will be matter_id/filename
    # Note: we need to sanitize the filename to prevent path traversal
    safe_filename = os.path.basename(body.filename)
    path = f"{matter_id}/{safe_filename}"

    try:
        # Create a presigned upload URL valid for 60 seconds
        res = db.storage.from_("matter_documents").create_signed_upload_url(path)
        return PreSignedUrlResponse(url=res["signedUrl"])
    except Exception:
        log.exception("Failed to generate upload URL for path %s", path)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate upload URL. Please try again later.",
        )


@router.get(
    "/{matter_id}/documents/{filename:path}", response_model=PreSignedUrlResponse
)
async def get_download_url(matter_id: str, filename: str, user: Auth):
    from app.shared.dependencies import UserRole

    db = get_db()
    get_matter_or_403(db, matter_id, user)

    safe_filename = os.path.basename(filename)
    path = f"{matter_id}/{safe_filename}"

    # Check if document has restricted visibility
    try:
        doc_res = (
            db.table("documents")
            .select("visibility")
            .eq("matter_id", matter_id)
            .or_(f"name.eq.{safe_filename},storage_path.eq.{path}")
            .execute()
        )
        if doc_res.data:
            doc = doc_res.data[0]
            if user.role == UserRole.USER and doc.get("visibility") == "lawyer_only":
                raise HTTPException(
                    status_code=403,
                    detail="This document is not shared with you",
                )
    except HTTPException:
        raise
    except Exception as check_exc:
        log.warning("Visibility check query failed for path %s: %s", path, check_exc)

    try:
        # Create a presigned download URL valid for 60 seconds
        res = db.storage.from_("matter_documents").create_signed_url(path, 60)
        return PreSignedUrlResponse(url=res["signedUrl"])
    except Exception:
        log.exception("Failed to generate download URL for path %s", path)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate download URL. Please try again later.",
        )


@router.get("/{matter_id}/documents", response_model=list[dict])
async def list_documents(matter_id: str, user: Auth):
    from app.shared.dependencies import UserRole

    db = get_db()
    get_matter_or_403(db, matter_id, user)

    try:
        # List all files in the matter's folder
        res = db.storage.from_("matter_documents").list(path=matter_id)
        files = res or []

        # If petitioner, filter out any file marked lawyer_only
        if user.role == UserRole.USER and files:
            doc_records = (
                db.table("documents")
                .select("name,storage_path,visibility")
                .eq("matter_id", matter_id)
                .eq("visibility", "lawyer_only")
                .execute()
            )
            lawyer_only_names = {
                d.get("name") for d in (doc_records.data or []) if d.get("name")
            }
            files = [f for f in files if f.get("name") not in lawyer_only_names]

        return files
    except Exception:
        # If the directory doesn't exist yet, return empty list
        return []
