"""Unit tests verifying code review remediations."""

import asyncio
import io

import pytest
from app.domains.notifications.channels.sse_broadcaster import SSEBroadcaster
from app.main import app
from app.shared.dependencies import CurrentUser, UserRole, get_current_user
from app.shared.file_validation import validate_upload_stream
from fastapi import HTTPException, UploadFile
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_file_validation_pdf_success():
    content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload = UploadFile(
        file=io.BytesIO(content),
        filename="affidavit.pdf",
        headers={"content-type": "application/pdf"},
    )
    file_bytes, mime = await validate_upload_stream(upload)
    assert file_bytes == content
    assert mime == "application/pdf"


@pytest.mark.asyncio
async def test_file_validation_png_success():
    content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    upload = UploadFile(
        file=io.BytesIO(content),
        filename="evidence.png",
        headers={"content-type": "image/png"},
    )
    file_bytes, mime = await validate_upload_stream(upload)
    assert file_bytes == content
    assert mime == "image/png"


@pytest.mark.asyncio
async def test_file_validation_disallowed_executable_rejected():
    content = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    upload = UploadFile(
        file=io.BytesIO(content),
        filename="malware.exe",
        headers={"content-type": "application/octet-stream"},
    )
    with pytest.raises(HTTPException) as exc_info:
        await validate_upload_stream(upload)
    assert exc_info.value.status_code == 400
    assert "Invalid or unsupported file type" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_file_validation_empty_file_rejected():
    upload = UploadFile(
        file=io.BytesIO(b""),
        filename="empty.pdf",
        headers={"content-type": "application/pdf"},
    )
    with pytest.raises(HTTPException) as exc_info:
        await validate_upload_stream(upload)
    assert exc_info.value.status_code == 400
    assert "empty" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_file_validation_oversized_file_rejected():
    content = b"A" * 1024
    upload = UploadFile(
        file=io.BytesIO(content),
        filename="large.txt",
        headers={"content-type": "text/plain"},
    )
    # Set artificial max_bytes of 500 bytes
    with pytest.raises(HTTPException) as exc_info:
        await validate_upload_stream(upload, max_bytes=500)
    assert exc_info.value.status_code == 413
    assert "exceeds maximum allowed size" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_document_download_lawyer_only_visibility(client: AsyncClient, mock_db):
    matter_id = "matter-doc-123"
    mock_db.table("matters").data = [
        {
            "id": matter_id,
            "user_id": "client-user-1",
            "lawyer_id": "lawyer-user-1",
            "deleted_at": None,
            "title": "Confidential Case",
        }
    ]
    mock_db.table("documents").data = [
        {
            "id": "doc-internal-1",
            "matter_id": matter_id,
            "name": "internal_strategy.pdf",
            "storage_path": f"{matter_id}/internal_strategy.pdf",
            "visibility": "lawyer_only",
        },
        {
            "id": "doc-public-1",
            "matter_id": matter_id,
            "name": "petition.pdf",
            "storage_path": f"{matter_id}/petition.pdf",
            "visibility": "client_visible",
        },
    ]

    # 1. As Client User -> Accessing lawyer_only doc returns 403
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="client-user-1", role=UserRole.USER, full_name="Client Test"
    )
    try:
        res = await client.get(
            f"/api/v1/matters/{matter_id}/documents/internal_strategy.pdf"
        )
        assert res.status_code == 403
        assert "not shared with you" in res.json()["detail"]

        # Client accessing client_visible doc succeeds
        res_ok = await client.get(f"/api/v1/matters/{matter_id}/documents/petition.pdf")
        assert res_ok.status_code == 200

        # Client listing documents filters out lawyer_only doc
        mock_db.storage.files[matter_id] = [
            {"name": "internal_strategy.pdf"},
            {"name": "petition.pdf"},
        ]
        res_list = await client.get(f"/api/v1/matters/{matter_id}/documents")
        assert res_list.status_code == 200
        names = [f["name"] for f in res_list.json()]
        assert "petition.pdf" in names
        assert "internal_strategy.pdf" not in names
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_matching_lawyer_pagination_with_filters(client: AsyncClient, mock_db):
    # Seed 5 lawyers: 3 in Mumbai, 2 in Delhi
    mock_db.table("lawyer_profiles").data = [
        {
            "id": "l-mum-1",
            "is_verified": True,
            "is_available": True,
            "specializations": ["property"],
            "experience_years": 5,
            "consultation_fee": 1000,
            "profiles": {
                "full_name": "Lawyer Mum 1",
                "city": "Mumbai",
                "state": "Maharashtra",
            },
        },
        {
            "id": "l-mum-2",
            "is_verified": True,
            "is_available": True,
            "specializations": ["property"],
            "experience_years": 6,
            "consultation_fee": 1200,
            "profiles": {
                "full_name": "Lawyer Mum 2",
                "city": "Mumbai",
                "state": "Maharashtra",
            },
        },
        {
            "id": "l-mum-3",
            "is_verified": True,
            "is_available": True,
            "specializations": ["property"],
            "experience_years": 7,
            "consultation_fee": 1500,
            "profiles": {
                "full_name": "Lawyer Mum 3",
                "city": "Mumbai",
                "state": "Maharashtra",
            },
        },
        {
            "id": "l-del-1",
            "is_verified": True,
            "is_available": True,
            "specializations": ["property"],
            "experience_years": 8,
            "consultation_fee": 2000,
            "profiles": {
                "full_name": "Lawyer Del 1",
                "city": "Delhi",
                "state": "Delhi",
            },
        },
        {
            "id": "l-del-2",
            "is_verified": True,
            "is_available": True,
            "specializations": ["property"],
            "experience_years": 9,
            "consultation_fee": 2500,
            "profiles": {
                "full_name": "Lawyer Del 2",
                "city": "Delhi",
                "state": "Delhi",
            },
        },
    ]

    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="user-1", role=UserRole.USER, full_name="Seeker"
    )
    try:
        # Page 1 of Mumbai lawyers (per_page=2)
        res_p1 = await client.get(
            "/api/v1/matching/lawyers?city=Mumbai&page=1&per_page=2"
        )
        assert res_p1.status_code == 200
        p1_data = res_p1.json()
        assert len(p1_data) == 2
        assert p1_data[0]["city"] == "Mumbai"

        # Page 2 of Mumbai lawyers (per_page=2) -> should return the 3rd Mumbai lawyer
        res_p2 = await client.get(
            "/api/v1/matching/lawyers?city=Mumbai&page=2&per_page=2"
        )
        assert res_p2.status_code == 200
        p2_data = res_p2.json()
        assert len(p2_data) == 1
        assert p2_data[0]["city"] == "Mumbai"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_sse_broadcaster_task_tracking():
    broadcaster = SSEBroadcaster()
    assert len(broadcaster._background_tasks) == 0

    async def dummy_coro():
        await asyncio.sleep(0.01)

    task = broadcaster._track_task(dummy_coro())
    assert task in broadcaster._background_tasks
    await task
    # Should be discarded automatically once complete
    await asyncio.sleep(0.01)
    assert task not in broadcaster._background_tasks
