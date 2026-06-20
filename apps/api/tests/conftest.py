import pytest
import asyncio
from typing import AsyncGenerator
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.shared.database import get_db
from app.shared.dependencies import get_current_user, CurrentUser, UserRole

class MockSupabaseTable:
    def __init__(self, name: str):
        self.name = name
        self.queries = []
        self.data = []
        self.last_inserted = None

    def select(self, *args, **kwargs):
        self.queries.append(("select", args, kwargs))
        return self

    def insert(self, data, *args, **kwargs):
        self.queries.append(("insert", data, args, kwargs))
        if isinstance(data, list):
            self.data.extend(data)
            self.last_inserted = data
        else:
            self.data.append(data)
            self.last_inserted = [data]
        return self

    def update(self, data, *args, **kwargs):
        self.queries.append(("update", data, args, kwargs))
        self.last_inserted = [data]
        return self

    def eq(self, column, value):
        self.queries.append(("eq", column, value))
        return self

    def single(self):
        self.queries.append(("single",))
        return self

    def limit(self, l):
        self.queries.append(("limit", l))
        return self

    def execute(self):
        if self.last_inserted is not None:
            res = MockSupabaseResponse(self.last_inserted)
            self.last_inserted = None
            return res
        return MockSupabaseResponse(self.data)

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

    def table(self, name: str):
        if name not in self.tables:
            self.tables[name] = MockSupabaseTable(name)
        return self.tables[name]

    def rpc(self, name: str, params: dict):
        if name == "commit_intake":
            return MockRpcBuilder([{"matter_id": "mock-matter-id", "already_committed": False}])
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
def mock_db(monkeypatch):
    client = MockSupabaseClient()
    for path in (
        "app.shared.database.get_db",
        "app.domains.identity.router.get_db",
        "app.domains.intake.router.get_db",
        "app.domains.matters.router.get_db",
        "app.domains.matching.router.get_db",
        "app.domains.admin.router.get_db",
        "app.shared.dependencies.get_db",
        "app.domains.legal_tools.router.get_db",
        "app.domains.legal_tools.services.draft.get_db"
    ):
        try:
            monkeypatch.setattr(path, lambda: client)
        except AttributeError:
            pass
    return client


@pytest.fixture
def mock_user():
    return CurrentUser(id="test-user-id", role=UserRole.USER, full_name="Test Petitioner")

import pytest_asyncio

@pytest_asyncio.fixture
async def client(mock_user) -> AsyncGenerator[AsyncClient, None]:
    # Override authentication dependency to use mock user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
