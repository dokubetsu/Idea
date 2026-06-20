import pytest
from httpx import AsyncClient
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.main import app

@pytest.fixture
def lawyer_user():
    return CurrentUser(id="test-lawyer-id", role=UserRole.LAWYER, full_name="Test Lawyer")

@pytest.fixture
def patch_db_helpers(mock_db, monkeypatch):
    # Fix single(), order(), and range() query executions on mocks
    for table_name in ["matters", "matter_updates", "hearings", "matter_milestones", "facts"]:
        table = mock_db.table(table_name)
        
        # Patch execute
        def make_execute(tbl):
            orig_execute = tbl.execute
            def mock_execute(*args, **kwargs):
                res = orig_execute(*args, **kwargs)
                is_single = any(q[0] == "single" for q in tbl.queries)
                if is_single and isinstance(res.data, list):
                    if res.data:
                        res.data = res.data[0]
                    else:
                        res.data = None
                return res
            return mock_execute
        monkeypatch.setattr(table, "execute", make_execute(table))
        
        # Patch insert to generate id and default fields for validation
        def make_insert(tbl):
            orig_insert = tbl.insert
            def mock_insert(data, *args, **kwargs):
                if isinstance(data, dict):
                    if "id" not in data:
                        data["id"] = f"mock-{tbl.name}-id"
                    if "created_at" not in data:
                        data["created_at"] = "2026-06-13T12:00:00Z"
                    if "updated_at" not in data:
                        data["updated_at"] = "2026-06-13T12:00:00Z"
                    if "status" not in data:
                        data["status"] = "active"
                    if "up" not in data:
                        data["up"] = {"full_name": None}
                    if "lp" not in data:
                        data["lp"] = {"full_name": "Test Lawyer"}
                orig_insert(data, *args, **kwargs)
                return tbl
            return mock_insert
        monkeypatch.setattr(table, "insert", make_insert(table))

        # Patch order method
        def make_order(tbl):
            def mock_order(column, *args, **kwargs):
                tbl.queries.append(("order", column, args, kwargs))
                return tbl
            return mock_order
        monkeypatch.setattr(table, "order", make_order(table), raising=False)

        # Patch range method
        def make_range(tbl):
            def mock_range(start, end, *args, **kwargs):
                tbl.queries.append(("range", start, end))
                return tbl
            return mock_range
        monkeypatch.setattr(table, "range", make_range(table), raising=False)

@pytest.mark.asyncio
async def test_create_matter_success(client: AsyncClient, mock_db, patch_db_helpers, lawyer_user, monkeypatch):
    # Override current user to be a lawyer
    app.dependency_overrides[get_current_user] = lambda: lawyer_user

    mock_db.table("matters").data = [{
        "id": "mock-matters-id",
        "title": "Cheque Bounce Case",
        "summary": "Cheque bounce case details",
        "category": "cheque_bounce",
        "priority": "medium",
        "client_email": "client@example.com",
        "client_phone": "9999999999",
        "court_name": "Bombay High Court",
        "case_number": "CNR-1234",
        "user_id": None,
        "lawyer_id": "test-lawyer-id",
        "status": "active",
        "next_hearing_at": None,
        "assigned_at": None,
        "resolved_at": None,
        "archived_at": None,
        "created_at": "2026-06-13T12:00:00Z",
        "updated_at": "2026-06-13T12:00:00Z",
        "up": {"full_name": None},
        "lp": {"full_name": "Test Lawyer"}
    }]
    mock_db.table("matter_milestones").data = []

    payload = {
        "title": "Cheque Bounce Case",
        "client_email": "client@example.com",
        "category": "cheque_bounce",
        "priority": "medium",
        "court_name": "Bombay High Court",
        "case_number": "CNR-1234",
        "summary": "Cheque bounce case details"
    }

    response = await client.post("/api/v1/matters", json=payload)
    app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Cheque Bounce Case"
    assert data["client_email"] == "client@example.com"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_get_matter_details(client: AsyncClient, mock_db, patch_db_helpers, monkeypatch):
    # Mock database responses
    mock_db.table("matters").data = [{
        "id": "matter-123",
        "title": "Cheque Bounce Case",
        "summary": "Case summary",
        "category": "cheque_bounce",
        "status": "active",
        "priority": "medium",
        "client_email": "client@example.com",
        "user_id": "test-user-id",
        "lawyer_id": "test-lawyer-id",
        "court_name": None,
        "case_number": None,
        "next_hearing_at": None,
        "assigned_at": None,
        "resolved_at": None,
        "created_at": "2026-06-13T12:00:00Z",
        "updated_at": "2026-06-13T12:00:00Z",
        "up": {"full_name": "Test Client"},
        "lp": {"full_name": "Test Lawyer"}
    }]
    
    mock_db.table("facts").data = []
    mock_db.table("hearings").data = [{
        "id": "hearing-1",
        "matter_id": "matter-123",
        "hearing_date": "2026-07-01T10:00:00Z",
        "courtroom": "Room 3",
        "judge": "Judge J",
        "purpose": "Arguments",
        "notes": "Be prepared",
        "status": "scheduled",
        "created_at": "2026-06-13T12:00:00Z",
        "updated_at": "2026-06-13T12:00:00Z"
    }]
    mock_db.table("matter_milestones").data = [{
        "id": "milestone-1",
        "matter_id": "matter-123",
        "title": "Filing",
        "description": "Filing case",
        "order_index": 1,
        "status": "completed",
        "completed_at": "2026-06-13T12:00:00Z",
        "created_at": "2026-06-13T12:00:00Z",
        "updated_at": "2026-06-13T12:00:00Z"
    }]

    response = await client.get("/api/v1/matters/matter-123")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Cheque Bounce Case"
    assert len(data["hearings"]) == 1
    assert data["hearings"][0]["purpose"] == "Arguments"
    assert len(data["milestones"]) == 1
    assert data["milestones"][0]["title"] == "Filing"


@pytest.mark.asyncio
async def test_threaded_comments(client: AsyncClient, mock_db, patch_db_helpers, monkeypatch):
    # Must pre-populate matter so get_matter_or_403 doesn't raise 404
    mock_db.table("matters").data = [{
        "id": "matter-123",
        "title": "Cheque Bounce Case",
        "summary": "Case summary",
        "category": "cheque_bounce",
        "status": "active",
        "priority": "medium",
        "client_email": "client@example.com",
        "user_id": "test-user-id",
        "lawyer_id": "test-lawyer-id",
        "court_name": None,
        "case_number": None,
        "next_hearing_at": None,
        "assigned_at": None,
        "resolved_at": None,
        "created_at": "2026-06-13T12:00:00Z",
        "updated_at": "2026-06-13T12:00:00Z",
        "up": {"full_name": "Test Client"},
        "lp": {"full_name": "Test Lawyer"}
    }]

    # Mock updates
    mock_db.table("matter_updates").data = [
        {
            "id": "update-1",
            "matter_id": "matter-123",
            "author_id": "test-lawyer-id",
            "content": "Case filed in court.",
            "is_internal": False,
            "parent_id": None,
            "created_at": "2026-06-13T12:00:00Z",
            "profiles": {"full_name": "Test Lawyer"}
        },
        {
            "id": "update-2",
            "matter_id": "matter-123",
            "author_id": "test-user-id",
            "content": "Thank you for the update. When is the first hearing?",
            "is_internal": False,
            "parent_id": "update-1",
            "created_at": "2026-06-13T12:05:00Z",
            "profiles": {"full_name": "Test Client"}
        }
    ]

    response = await client.get("/api/v1/matters/matter-123/updates")
    assert response.status_code == 200
    data = response.json()
    
    # Check that tree structure is built correctly
    assert len(data) == 1
    assert data[0]["id"] == "update-1"
    assert len(data[0]["replies"]) == 1
    assert data[0]["replies"][0]["id"] == "update-2"
    assert data[0]["replies"][0]["parent_id"] == "update-1"
