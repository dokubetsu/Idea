"""
File validation utilities for secure document uploads.
Enforces stream-based chunking, maximum size limits, and magic byte validation.
"""

from __future__ import annotations

import os

from fastapi import HTTPException, UploadFile

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB


def sniff_mime_type(header_bytes: bytes, filename: str = "") -> str | None:
    """Sniff MIME type from header magic bytes with file extension context."""
    if not header_bytes:
        return None

    # PDF: %PDF-
    if header_bytes.startswith(b"%PDF-"):
        return "application/pdf"

    # PNG: \x89PNG\r\n\x1a\n
    if header_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    # JPEG: \xff\xd8\xff
    if header_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    # WEBP: RIFF....WEBP
    if (
        len(header_bytes) >= 12
        and header_bytes.startswith(b"RIFF")
        and header_bytes[8:12] == b"WEBP"
    ):
        return "image/webp"

    # Legacy MS Word (OLE2 Compound Document)
    if header_bytes.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "application/msword"

    # DOCX (ZIP container)
    if (
        header_bytes.startswith(b"PK\x03\x04")
        or header_bytes.startswith(b"PK\x05\x06")
        or header_bytes.startswith(b"PK\x07\x08")
    ):
        ext = os.path.splitext(filename)[1].lower()
        if ext in (".docx", ".dotx", ".docm"):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    # Plain text / UTF-8 text (no binary null bytes in leading bytes)
    if b"\x00" not in header_bytes[:512]:
        try:
            header_bytes.decode("utf-8")
            return "text/plain"
        except UnicodeDecodeError:
            pass

    return None


async def validate_upload_stream(
    file: UploadFile,
    max_bytes: int = MAX_FILE_SIZE_BYTES,
    allowed_types: set[str] = ALLOWED_MIME_TYPES,
) -> tuple[bytes, str]:
    """
    Reads an UploadFile in chunks, enforcing max size and content type validation.
    Returns (file_bytes, validated_mime_type).
    """
    chunk_size = 64 * 1024  # 64 KB chunks
    total_size = 0
    buffer = bytearray()

    while chunk := await file.read(chunk_size):
        total_size += len(chunk)
        if total_size > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum allowed size ({max_bytes // (1024 * 1024)}MB)",
            )
        buffer.extend(chunk)

    if total_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file cannot be empty")

    file_bytes = bytes(buffer)
    filename = file.filename or "document"

    # Detect MIME type
    sniffed = sniff_mime_type(file_bytes[:1024], filename=filename)
    declared = (file.content_type or "").strip().lower()

    # Prefer sniffed MIME type, fall back to declared if matches allowed and text
    final_mime = sniffed or (declared if declared in allowed_types else None)

    if not final_mime or final_mime not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid or unsupported file type. "
                "Only PDFs, images (JPEG/PNG/WebP), Word documents, and text files are allowed."
            ),
        )

    return file_bytes, final_mime
