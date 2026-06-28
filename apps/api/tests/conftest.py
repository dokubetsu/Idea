import os
os.environ.setdefault("PAYMENT_WEBHOOK_SECRET", "test_webhook_secret")

import pytest
import pytest_asyncio
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.shared.dependencies import get_current_user, CurrentUser, UserRole


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: run integration tests against test Supabase"
    )


@pytest.fixture(scope="session", autouse=True)
def configure_test_database():
    from app.config import settings

    # Override Supabase credentials with dedicated test credentials if present
    if settings.SUPABASE_TEST_PROJECT_URL and settings.SUPABASE_TEST_SERVICE_ROLE_KEY:
        if (
            "placeholder" not in settings.SUPABASE_TEST_PROJECT_URL
            and settings.SUPABASE_TEST_PROJECT_URL != "null"
        ):
            settings.SUPABASE_URL = settings.SUPABASE_TEST_PROJECT_URL
            settings.SUPABASE_SERVICE_ROLE_KEY = settings.SUPABASE_TEST_SERVICE_ROLE_KEY


@pytest.fixture(autouse=True)
def skip_if_no_test_database(request):
    is_integration = (
        "integration" in request.node.keywords or "integration" in request.node.nodeid
    )
    if is_integration:
        from app.config import settings

        test_url = settings.SUPABASE_TEST_PROJECT_URL
        test_key = settings.SUPABASE_TEST_SERVICE_ROLE_KEY

        # Check if they are configured or placeholders
        has_test_db = (
            test_url
            and "placeholder" not in test_url
            and "placeholder.supabase.co" not in test_url
            and test_url != "null"
            and test_key
            and "placeholder" not in test_key
            and test_key != "null"
        )
        if not has_test_db:
            pytest.skip(
                "Skipping integration test: SUPABASE_TEST_PROJECT_URL and " \
                "SUPABASE_TEST_SERVICE_ROLE_KEY are not configured."
            )


class MockSupabaseTable:
    def __init__(self, name: str):
        self.name = name
        self.queries = []
        self.data = []
        self.last_inserted = None
        self._pending_update = None

    def select(self, *args, **kwargs):
        is_returning = any(q[0] in ("update", "insert") for q in self.queries)
        if not is_returning:
            self.queries.clear()
        self.queries.append(("select", args, kwargs))
        return self

    def insert(self, data, *args, **kwargs):
        self.queries.clear()
        self.queries.append(("insert", data, args, kwargs))
        if isinstance(data, list):
            self.data.extend(data)
            self.last_inserted = data
        else:
            self.data.append(data)
            self.last_inserted = [data]
        return self

    def update(self, data, *args, **kwargs):
        self.queries.clear()
        self.queries.append(("update", data, args, kwargs))
        self._pending_update = data
        return self

    def eq(self, column, value):
        self.queries.append(("eq", column, value))
        return self

    def single(self):
        self.queries.append(("single",))
        return self

    def limit(self, limit_val):
        self.queries.append(("limit", limit_val))
        return self

    def order(self, column, *args, **kwargs):
        self.queries.append(("order", column, args, kwargs))
        return self

    def execute(self):
        is_single = any(q[0] == "single" for q in self.queries)
        is_update = any(q[0] == "update" for q in self.queries)

        if is_update and getattr(self, "_pending_update", None) is not None:
            # Find the filters
            filters = []
            for query in self.queries:
                if query[0] == "eq":
                    filters.append((query[1], query[2]))

            # Apply update only to rows in self.data matching the filters
            updated_rows = []
            for row in self.data:
                match = True
                for column, value in filters:
                    if row.get(column) != value:
                        match = False
                        break
                if match:
                    row.update(self._pending_update)
                    updated_rows.append(row)

            self._pending_update = None
            ret = updated_rows
            if is_single:
                ret = ret[0] if ret else None
            self.queries.clear()
            return MockSupabaseResponse(ret)

        if self.last_inserted is not None:
            data = self.last_inserted
            self.last_inserted = None
        else:
            data = list(self.data)

        for query in self.queries:
            if query[0] == "eq":
                column, value = query[1], query[2]
                data = [row for row in data if row.get(column) == value]

        if is_single:
            ret = data[0] if data else None
        else:
            ret = data
        self.queries.clear()
        return MockSupabaseResponse(ret)


class MockSupabaseResponse:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count or len(data)


class MockRpcBuilder:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return MockSupabaseResponse(self.data)


class MockSupabaseClient:
    def __init__(self):
        self.tables = {}
        self.auth = MockAuth()
        self.rpc_calls = []

    def table(self, name: str):
        if name not in self.tables:
            self.tables[name] = MockSupabaseTable(name)
        return self.tables[name]

    def rpc(self, name: str, params: dict = None):
        self.rpc_calls.append((name, params))
        if name == "verify_lawyer_rpc":
            return MockRpcBuilder([])
        if name == "suspend_lawyer_rpc":
            return MockRpcBuilder([])
        if name == "commit_intake":
            return MockRpcBuilder(
                [{"matter_id": "mock-matter-id", "already_committed": False}]
            )
        if name == "register_profile":
            # Add to mock profiles table
            uid = params.get("p_user_id")
            profiles_table = self.table("profiles")
            found = None
            for p in profiles_table.data:
                if p.get("id") == uid:
                    found = p
                    break
            if not found:
                found = {
                    "id": uid,
                    "role": "user",
                    "full_name": params.get("p_full_name"),
                    "phone": params.get("p_phone"),
                    "city": params.get("p_city"),
                    "state": params.get("p_state"),
                }
                profiles_table.data.append(found)

                # If role is lawyer, add to lawyer_profiles
                if params.get("p_role") == "lawyer":
                    self.table("lawyer_profiles").data.append(
                        {"id": uid, "is_verified": False, "is_available": True}
                    )
            return MockRpcBuilder(found)

        if name == "schedule_meeting":
            matter_id = params.get("p_matter_id")
            # Enforce limits in mock DB
            consultation_data = self.table("consultations").data
            c = None
            for row in consultation_data:
                if row.get("matter_id") == matter_id:
                    c = row
                    break
            if c:
                scheduled_count = sum(
                    1
                    for m in self.table("meetings").data
                    if m.get("matter_id") == matter_id
                    and m.get("status") == "scheduled"
                )
                if (c.get("sessions_used", 0) + scheduled_count) >= c.get(
                    "sessions_total", 1
                ):
                    raise Exception("Session limit reached")

            # Insert meeting
            meeting = {
                "id": "mock-meeting-id",
                "matter_id": matter_id,
                "scheduled_at": params.get("p_scheduled_at"),
                "duration_minutes": params.get("p_duration_minutes"),
                "notes": params.get("p_notes"),
                "meeting_link": params.get("p_meeting_link"),
                "status": "scheduled",
            }
            self.table("meetings").data.append(meeting)
            return MockRpcBuilder(meeting)

        if name == "transition_matter_status":
            matter_id = params.get("p_matter_id")
            matters_table = self.table("matters")
            current_status = "intake"
            found = False
            for row in matters_table.data:
                if row.get("id") == matter_id:
                    found = True
                    current_status = row.get("status", "intake")
                    row["status"] = params.get("p_new_status")
                    break
            if not found:
                raise Exception("Matter not found")
            return MockRpcBuilder([{"old_status": current_status, "success": True}])

        if name == "assign_free_lawyer_rpc":
            consultation_id = params.get("p_consultation_id")
            lawyers = self.table("lawyer_profiles").data
            for lp in lawyers:
                if lp.get("is_available") and lp.get("offers_free_consultation"):
                    if consultation_id:
                        for row in self.table("consultations").data:
                            if row.get("id") == consultation_id:
                                row["lawyer_id"] = lp["id"]
                                break
                    return MockRpcBuilder(lp["id"])
            return MockRpcBuilder(None)

        if name == "contact_lawyer_rpc":
            user_id = params.get("p_user_id")
            lawyer_id = params.get("p_lawyer_id")
            matter_id = params.get("p_matter_id")
            requests_table = self.table("lawyer_requests")

            exists = False
            for r in requests_table.data:
                if r.get("user_id") == user_id and r.get("lawyer_id") == lawyer_id:
                    if matter_id and r.get("matter_id") == matter_id:
                        exists = True
                        break
                    elif not matter_id and not r.get("matter_id"):
                        exists = True
                        break

            if exists:
                return MockRpcBuilder(
                    {
                        "ok": True,
                        "message": "Request already sent",
                        "already_exists": True,
                    }
                )

            new_req = {
                "id": "mock-request-id",
                "user_id": user_id,
                "lawyer_id": lawyer_id,
                "matter_id": matter_id,
                "message": params.get("p_message"),
                "status": "pending",
            }
            requests_table.data.append(new_req)
            return MockRpcBuilder(
                {
                    "ok": True,
                    "message": "Request sent to lawyer",
                    "already_exists": False,
                }
            )

        return MockRpcBuilder([])


class MockAuth:
    def __init__(self):
        self.admin = MockAuthAdmin()


class MockAuthAdmin:
    def update_user_by_id(self, uid, attributes):
        return {"id": uid, "attributes": attributes}


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db(request, monkeypatch):
    is_integration = (
        "integration" in request.node.keywords or "integration" in request.node.nodeid
    )
    if is_integration:
        return None

    client = MockSupabaseClient()
    for path in (
        "app.shared.database.get_db",
        "app.shared.database.get_service_role_db",
        "app.domains.identity.router.get_db",
        "app.domains.identity.router.get_service_role_db",
        "app.domains.intake.router.get_db",
        "app.domains.matters.router.get_db",
        "app.domains.matching.router.get_db",
        "app.domains.admin.router.get_db",
        "app.shared.dependencies.get_db",
        "app.domains.legal_tools.router.get_db",
        "app.domains.legal_tools.services.draft.get_db",
        "app.domains.system.router.get_service_role_db",
        "app.domains.consultations.router.get_db",
    ):
        try:
            monkeypatch.setattr(path, lambda: client)
        except AttributeError:
            pass
    return client


@pytest.fixture
def mock_user():
    return CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Petitioner"
    )


@pytest_asyncio.fixture
async def client(mock_user) -> AsyncGenerator[AsyncClient, None]:
    # Override authentication dependency to use mock user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
