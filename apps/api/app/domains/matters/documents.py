from __future__ import annotations
from pydantic import BaseModel

class PreSignedUrlResponse(BaseModel):
    url: str

class DocumentUploadRequest(BaseModel):
    filename: str
    content_type: str
