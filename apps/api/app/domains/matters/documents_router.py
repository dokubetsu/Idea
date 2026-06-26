from fastapi import APIRouter
from app.shared.dependencies import Auth
from app.shared.database import get_db
from app.domains.matters.service import get_matter_or_403
from app.domains.matters.documents import PreSignedUrlResponse, DocumentUploadRequest
from fastapi import HTTPException
import os

router = APIRouter()


@router.post("/{matter_id}/documents/upload-url", response_model=PreSignedUrlResponse)
async def get_upload_url(matter_id: str, body: DocumentUploadRequest, user: Auth):
    db = get_db()
    # Check matter access (user owns it or lawyer assigned to it)
    get_matter_or_403(db, matter_id, user)

    # Path will be matter_id/filename
    # Note: we need to sanitize the filename to prevent path traversal
    safe_filename = os.path.basename(body.filename)
    path = f"{matter_id}/{safe_filename}"

    try:
        # Create a presigned upload URL valid for 60 seconds
        res = db.storage.from_("matter_documents").create_signed_upload_url(path)
        return PreSignedUrlResponse(url=res["signedUrl"])
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate upload URL: {str(e)}"
        )


@router.get(
    "/{matter_id}/documents/{filename:path}", response_model=PreSignedUrlResponse
)
async def get_download_url(matter_id: str, filename: str, user: Auth):
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    safe_filename = os.path.basename(filename)
    path = f"{matter_id}/{safe_filename}"

    try:
        # Create a presigned download URL valid for 60 seconds
        res = db.storage.from_("matter_documents").create_signed_url(path, 60)
        return PreSignedUrlResponse(url=res["signedUrl"])
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate download URL: {str(e)}"
        )


@router.get("/{matter_id}/documents", response_model=list[dict])
async def list_documents(matter_id: str, user: Auth):
    db = get_db()
    get_matter_or_403(db, matter_id, user)

    try:
        # List all files in the matter's folder
        res = db.storage.from_("matter_documents").list(path=matter_id)
        # res returns a list of dictionaries with name, id, updated_at, created_at, last_accessed_at, metadata
        return res
    except Exception:
        # If the directory doesn't exist yet, return empty list
        return []
