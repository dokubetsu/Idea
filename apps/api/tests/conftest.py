import os

os.environ.setdefault("PAYMENT_WEBHOOK_SECRET", "test_webhook_secret")
os.environ.setdefault("CRON_SECRET", "test_cron_secret")
os.environ.setdefault(
    "SUPABASE_JWT_SECRET", "test_jwt_secret_minimum_32_characters_long"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
import asyncio  # noqa: E402
from typing import AsyncGenerator  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402
from app.main import app  # noqa: E402
from app.shared.dependencies import (  # noqa: E402
    get_current_user,
    CurrentUser,
    UserRole,
)


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: run integration tests against test Supabase"
    )
    # Ensure APP_ENV never flips to production during unit tests
    os.environ.setdefault("APP_ENV", "development")
    os.environ.setdefault("START_OUTBOX_WORKER", "false")


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
    if settings.SUPABASE_TEST_ANON_KEY:
        settings.SUPABASE_ANON_KEY = settings.SUPABASE_TEST_ANON_KEY


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
                "Skipping integration test: SUPABASE_TEST_PROJECT_URL and "
                "SUPABASE_TEST_SERVICE_ROLE_KEY are not configured."
            )


class MockNotBuilder:
    def __init__(self, table):
        self.table = table

    def in_(self, column, values):
        self.table.queries.append(("not_in", column, values))
        return self.table


class MockSupabaseTable:
    def __init__(self, name: str):
        self.name = name
        self.queries = []
        self.data = []
        self.last_inserted = None
        self._pending_update = None

    @property
    def not_(self):
        return MockNotBuilder(self)

    def select(self, *args, **kwargs):
        is_returning = any(q[0] in ("update", "insert") for q in self.queries)
        if not is_returning:
            self.queries.clear()
        self.queries.append(("select", args, kwargs))
        return self

    def insert(self, data, *args, **kwargs):
        self.queries.clear()
        self.queries.append(("insert", data, args, kwargs))
        import uuid
        from datetime import datetime, timezone

        now_str = datetime.now(timezone.utc).isoformat()
        if isinstance(data, list):
            for row in data:
                if "id" not in row:
                    row["id"] = str(uuid.uuid4())
                if "created_at" not in row:
                    row["created_at"] = now_str
                if "started_at" not in row:
                    row["started_at"] = now_str
            self.data.extend(data)
            self.last_inserted = data
        else:
            if "id" not in data:
                data["id"] = str(uuid.uuid4())
            if "created_at" not in data:
                data["created_at"] = now_str
            if "started_at" not in data:
                data["started_at"] = now_str
            self.data.append(data)
            self.last_inserted = [data]
        return self

    def update(self, data, *args, **kwargs):
        self.queries.clear()
        self.queries.append(("update", data, args, kwargs))
        self._pending_update = data
        return self

    def delete(self, *args, **kwargs):
        self.queries.clear()
        self.queries.append(("delete",))
        self._pending_delete = True
        return self

    def eq(self, column, value):
        self.queries.append(("eq", column, value))
        return self

    def in_(self, column, values):
        self.queries.append(("in_", column, values))
        return self

    def gte(self, column, value):
        self.queries.append(("gte", column, value))
        return self

    def lte(self, column, value):
        self.queries.append(("lte", column, value))
        return self

    def lt(self, column, value):
        self.queries.append(("lt", column, value))
        return self

    def gt(self, column, value):
        self.queries.append(("gt", column, value))
        return self

    def is_(self, column, value):
        self.queries.append(("is_", column, value))
        return self

    def like(self, column, value):
        self.queries.append(("like", column, value))
        return self

    def contains(self, column, value):
        self.queries.append(("contains", column, value))
        return self

    def or_(self, filter_str):
        self.queries.append(("or_", filter_str))
        return self

    def single(self):
        self.queries.append(("single",))
        return self

    def limit(self, limit_val):
        self.queries.append(("limit", limit_val))
        return self

    def range(self, start, end):
        self.queries.append(("range", start, end))
        return self

    def order(self, column, *args, **kwargs):
        self.queries.append(("order", column, args, kwargs))
        return self

    def execute(self):
        is_single = any(q[0] == "single" for q in self.queries)
        is_update = any(q[0] == "update" for q in self.queries)
        is_delete = any(q[0] == "delete" for q in self.queries)

        if is_delete and getattr(self, "_pending_delete", False):
            eq_filters = []
            lt_filters = []
            for query in self.queries:
                if query[0] == "eq":
                    eq_filters.append((query[1], query[2]))
                elif query[0] == "lt":
                    lt_filters.append((query[1], query[2]))
            deleted = []
            remaining = []
            for row in self.data:
                match = all(row.get(c) == v for c, v in eq_filters)
                if match:
                    for c, v in lt_filters:
                        if row.get(c) is None or not (row.get(c) < v):
                            match = False
                            break
                if match:
                    deleted.append(row)
                else:
                    remaining.append(row)
            self.data = remaining
            self._pending_delete = False
            self.queries.clear()
            return MockSupabaseResponse(deleted)

        if is_update and getattr(self, "_pending_update", None) is not None:
            # Find the filters
            filters = []
            not_in_filters = []
            in_filters = []
            is_filters = []
            lt_filters = []
            for query in self.queries:
                if query[0] == "eq":
                    filters.append((query[1], query[2]))
                elif query[0] == "not_in":
                    not_in_filters.append((query[1], query[2]))
                elif query[0] == "in_":
                    in_filters.append((query[1], query[2]))
                elif query[0] == "is_":
                    is_filters.append((query[1], query[2]))
                elif query[0] == "lt":
                    lt_filters.append((query[1], query[2]))

            # Apply update only to rows in self.data matching the filters
            updated_rows = []
            for row in self.data:
                match = True
                for column, value in filters:
                    if row.get(column) != value:
                        match = False
                        break
                if match:
                    for column, values in not_in_filters:
                        if row.get(column) in values:
                            match = False
                            break
                if match:
                    for column, values in in_filters:
                        if row.get(column) not in values:
                            match = False
                            break
                if match:
                    for column, value in is_filters:
                        # PostgREST is_("col", "null") → SQL IS NULL
                        if value in ("null", None):
                            if row.get(column) is not None:
                                match = False
                                break
                        elif row.get(column) != value:
                            match = False
                            break
                if match:
                    for column, value in lt_filters:
                        if row.get(column) is None or not (row.get(column) < value):
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
            elif query[0] == "in_":
                column, values = query[1], query[2]
                data = [row for row in data if row.get(column) in values]
            elif query[0] == "gte":
                column, value = query[1], query[2]
                data = [
                    row
                    for row in data
                    if row.get(column) is not None and row.get(column) >= value
                ]
            elif query[0] == "lte":
                column, value = query[1], query[2]
                data = [
                    row
                    for row in data
                    if row.get(column) is not None and row.get(column) <= value
                ]
            elif query[0] == "lt":
                column, value = query[1], query[2]
                data = [
                    row
                    for row in data
                    if row.get(column) is not None and row.get(column) < value
                ]
            elif query[0] == "gt":
                column, value = query[1], query[2]
                data = [
                    row
                    for row in data
                    if row.get(column) is not None and row.get(column) > value
                ]
            elif query[0] == "is_":
                column, value = query[1], query[2]
                if value == "null" or value is None:
                    data = [row for row in data if row.get(column) is None]
                else:
                    data = [row for row in data if row.get(column) == value]
            elif query[0] == "like":
                column, pattern = query[1], query[2]
                import re

                regex_pattern = (
                    re.escape(pattern).replace(r"\%", ".*").replace(r"\_", ".")
                )
                regex = re.compile(f"^{regex_pattern}$", re.IGNORECASE)
                data = [
                    row
                    for row in data
                    if row.get(column) is not None and regex.match(str(row.get(column)))
                ]
            elif query[0] == "contains":
                column, value = query[1], query[2]

                def _contains(row_val, check_val):
                    if isinstance(row_val, list):
                        if isinstance(check_val, list):
                            return all(x in row_val for x in check_val)
                        return check_val in row_val
                    elif isinstance(row_val, dict) and isinstance(check_val, dict):
                        return all(row_val.get(k) == v for k, v in check_val.items())
                    return row_val == check_val

                data = [
                    row
                    for row in data
                    if row.get(column) is not None and _contains(row.get(column), value)
                ]
            elif query[0] == "not_in":
                column, values = query[1], query[2]
                data = [row for row in data if row.get(column) not in values]
            elif query[0] == "range":
                start, end = query[1], query[2]
                data = data[start : end + 1]
            elif query[0] == "or_":
                filter_str = query[1]
                parts = filter_str.split(",")
                matching_rows = []
                for row in data:
                    any_match = False
                    for part in parts:
                        subparts = part.split(".", 2)
                        if len(subparts) == 3 and subparts[1] == "eq":
                            col, _, val = subparts[0], subparts[1], subparts[2]
                            if str(row.get(col)) == val:
                                any_match = True
                                break
                    if any_match:
                        matching_rows.append(row)
                data = matching_rows

        if is_single:
            ret = data[0] if data else None
        else:
            ret = data
        self.queries.clear()
        return MockSupabaseResponse(ret)


class MockSupabaseResponse:
    def __init__(self, data, count=None):
        self.data = data
        if count is not None:
            self.count = count
        elif data is None:
            self.count = 0
        elif isinstance(data, (list, tuple, dict, str, bytes)):
            self.count = len(data)
        else:
            # scalar RPC results (int/bool/etc.)
            self.count = 1


class MockRpcBuilder:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return MockSupabaseResponse(self.data)


class MockStorageBucket:
    def __init__(self, name: str, files_dict: dict):
        self.name = name
        self.files_dict = files_dict

    def create_signed_upload_url(self, path: str):
        return {
            "signedUrl": f"https://mock.storage/{self.name}/{path}?token=mock_upload"
        }

    def create_signed_url(self, path: str, expires_in: int = 60):
        return {
            "signedUrl": f"https://mock.storage/{self.name}/{path}?token=mock_download"
        }

    def list(self, path: str = ""):
        return self.files_dict.get(path, [])

    def upload(self, path: str, file_bytes: bytes, file_options: dict = None):
        import os

        dir_name = os.path.dirname(path)
        base_name = os.path.basename(path)
        if dir_name not in self.files_dict:
            self.files_dict[dir_name] = []
        self.files_dict[dir_name].append({"name": base_name, "size": len(file_bytes)})
        return {"Key": path}


class MockStorage:
    def __init__(self):
        self.files = {}

    def from_(self, bucket_name: str):
        return MockStorageBucket(bucket_name, self.files)


class MockSupabaseClient:
    def __init__(self):
        self.tables = {}
        self.auth = MockAuth()
        self.storage = MockStorage()
        self.rpc_calls = []

    def table(self, name: str):
        if name not in self.tables:
            self.tables[name] = MockSupabaseTable(name)
        return self.tables[name]

    def rpc(self, name: str, params: dict = None):
        self.rpc_calls.append((name, params))

        if params is None:
            params = {}
        if name == "submit_practice_decision":
            session_id = params.get("p_session_id")
            user_id = params.get("p_user_id")
            node_id = params.get("p_node_id")
            choice_id = params.get("p_choice_id")
            is_correct = params.get("p_is_correct")
            score_awarded = params.get("p_score_awarded")
            issue_tag = params.get("p_issue_tag")
            input_value = params.get("p_input_value")
            time_taken_ms = params.get("p_time_taken_ms")
            new_node = params.get("p_new_node")
            new_status = params.get("p_new_status")
            completed_at = params.get("p_completed_at")
            domain = params.get("p_domain")

            dec_row = {
                "session_id": session_id,
                "node_id": node_id,
                "choice_id": choice_id,
                "is_correct": is_correct,
                "score_awarded": score_awarded,
                "issue_tag": issue_tag,
                "input_value": input_value,
                "time_taken_ms": time_taken_ms,
            }
            self.table("practice_decisions").data.append(dec_row)

            for row in self.table("practice_sessions").data:
                if row.get("id") == session_id:
                    row["current_node"] = new_node
                    row["status"] = new_status
                    row["score"] = max(0, row["score"] + score_awarded)
                    row["decisions_count"] += 1
                    row["correct_count"] += 1 if is_correct else 0
                    row["completed_at"] = completed_at
                    break

            if issue_tag:
                from datetime import datetime, timezone

                now_str = datetime.now(timezone.utc).isoformat()
                profiles = self.table("practice_profiles").data
                found_p = None
                for p in profiles:
                    if p.get("user_id") == user_id and p.get("issue_tag") == issue_tag:
                        found_p = p
                        break
                if found_p:
                    found_p["attempts"] += 1
                    found_p["correct"] += 1 if is_correct else 0
                    found_p["streak"] = (found_p["streak"] + 1) if is_correct else 0
                    found_p["last_attempted"] = now_str
                else:
                    new_p = {
                        "user_id": user_id,
                        "issue_tag": issue_tag,
                        "domain": domain,
                        "attempts": 1,
                        "correct": 1 if is_correct else 0,
                        "streak": 1 if is_correct else 0,
                        "last_attempted": now_str,
                    }
                    profiles.append(new_p)

            return MockRpcBuilder([])

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
                    new_status = params.get("p_new_status")
                    row["status"] = new_status
                    if new_status == "matching" and current_status == "active":
                        row["lawyer_id"] = None
                        row["assigned_at"] = None
                    break
            if not found:
                raise Exception("Matter not found")
            return MockRpcBuilder([{"old_status": current_status, "success": True}])

        if name == "return_matter_to_matching":
            matter_id = params.get("p_matter_id")
            for row in self.table("matters").data:
                if row.get("id") == matter_id:
                    old = row.get("status", "active")
                    if old in ("resolved", "archived"):
                        return MockRpcBuilder(
                            [
                                {
                                    "matter_id": matter_id,
                                    "changed": False,
                                    "old_status": old,
                                    "new_status": old,
                                }
                            ]
                        )
                    prev_lawyer = row.get("lawyer_id")
                    row["lawyer_id"] = None
                    row["status"] = "matching"
                    row["assigned_at"] = None
                    return MockRpcBuilder(
                        [
                            {
                                "matter_id": matter_id,
                                "changed": True,
                                "old_status": old,
                                "new_status": "matching",
                                "previous_lawyer_id": prev_lawyer,
                            }
                        ]
                    )
            raise Exception("Matter not found")

        if name == "matching_accept_rpc":
            request_id = params.get("p_request_id")
            req = None
            for r in self.table("lawyer_requests").data:
                if r.get("id") == request_id:
                    req = r
                    break
            if not req:
                raise Exception("Request not found")
            if req.get("status") != "pending":
                raise Exception("Request has already been processed")
            matter_id = req.get("matter_id")
            if not matter_id:
                req["status"] = "accepted"
                return MockRpcBuilder(
                    [
                        {
                            "request_id": request_id,
                            "status": "accepted",
                            "matter_id": None,
                            "matter_assigned": False,
                        }
                    ]
                )
            matter = None
            for m in self.table("matters").data:
                if m.get("id") == matter_id:
                    matter = m
                    break
            if not matter:
                raise Exception("Matter not found")
            if matter.get("status") != "matching":
                raise Exception("This matter is no longer in the matching state")
            if matter.get("lawyer_id"):
                raise Exception(
                    "This matter has already been assigned to another lawyer"
                )
            # Lawyer id comes from request target
            lawyer_id = req.get("lawyer_id")
            matter["lawyer_id"] = lawyer_id
            matter["status"] = "active"
            matter["assigned_at"] = "2026-01-01T00:00:00Z"
            req["status"] = "accepted"
            return MockRpcBuilder(
                [
                    {
                        "request_id": request_id,
                        "status": "accepted",
                        "matter_id": matter_id,
                        "matter_assigned": True,
                        "old_status": "matching",
                        "new_status": "active",
                    }
                ]
            )

        if name == "mark_consultation_paid":
            cid = params.get("p_consultation_id")
            for row in self.table("consultations").data:
                if row.get("id") == cid:
                    if row.get("payment_status") == "paid":
                        return MockRpcBuilder(
                            [
                                {
                                    "consultation_id": cid,
                                    "payment_status": "paid",
                                    "already_paid": True,
                                    "payment_gateway_ref": row.get(
                                        "payment_gateway_ref"
                                    ),
                                }
                            ]
                        )
                    if row.get("package") == "free":
                        raise Exception("Free consultations do not require payment")
                    expected = float(row.get("amount_inr") or 0)
                    actual = float(params.get("p_amount_inr") or 0)
                    if abs(expected - actual) > 0.02:
                        raise Exception(
                            "Payment amount does not match consultation amount"
                        )
                    row["payment_status"] = "paid"
                    row["payment_gateway_ref"] = params.get("p_payment_id")
                    row["payment_idempotency_key"] = params.get("p_idemp_key")
                    pay_id = "pay-" + str(params.get("p_payment_id"))
                    self.table("payments").data.append(
                        {
                            "id": pay_id,
                            "consultation_id": cid,
                            "user_id": params.get("p_user_id"),
                            "amount_inr": actual,
                            "status": "completed",
                            "payment_id": params.get("p_payment_id"),
                            "payment_idempotency_key": params.get("p_idemp_key"),
                        }
                    )
                    return MockRpcBuilder(
                        [
                            {
                                "consultation_id": cid,
                                "payment_status": "paid",
                                "already_paid": False,
                                "payment_record_id": pay_id,
                                "payment_gateway_ref": params.get("p_payment_id"),
                            }
                        ]
                    )
            raise Exception("Consultation not found")

        if name == "apply_payment_rpc":
            mid = params.get("p_milestone_id")
            for row in self.table("matter_milestones").data:
                if row.get("id") == mid:
                    if row.get("is_paid"):
                        out = dict(row)
                        out["already_paid"] = True
                        return MockRpcBuilder([out])
                    row["is_paid"] = True
                    row["payment_gateway_ref"] = params.get("p_payment_id")
                    row["payment_idempotency_key"] = params.get("p_idemp_key")
                    pay_id = "pay-ms-" + str(params.get("p_payment_id"))
                    amt = params.get("p_amount_inr")
                    if amt and float(amt) > 0:
                        self.table("payments").data.append(
                            {
                                "id": pay_id,
                                "milestone_id": mid,
                                "user_id": params.get("p_user_id"),
                                "amount_inr": float(amt),
                                "status": "completed",
                                "payment_id": params.get("p_payment_id"),
                                "payment_idempotency_key": params.get("p_idemp_key"),
                            }
                        )
                        row["payment_record_id"] = pay_id
                    out = dict(row)
                    out["already_paid"] = False
                    return MockRpcBuilder([out])
            raise Exception("Milestone not found")

        if name == "create_invoice_rpc":
            import hashlib
            from datetime import datetime, timezone

            matter_id = params.get("p_matter_id")
            te_ids = params.get("p_time_entry_ids") or []
            disb_ids = params.get("p_disbursement_ids") or []
            place = params.get("p_place_of_supply") or "Delhi"
            supplier = params.get("p_supplier_state") or "Delhi"
            draw_retainer = params.get("p_draw_retainer", True)
            subtotal = 0.0
            for te in self.table("time_entries").data:
                if te.get("id") in te_ids:
                    if (
                        te.get("matter_id") != matter_id
                        or te.get("status") != "unbilled"
                    ):
                        raise Exception(
                            "One or more time entries are missing, already billed, or not on this matter"
                        )
                    subtotal += float(te.get("amount_inr") or 0)
            for d in self.table("disbursements").data:
                if d.get("id") in disb_ids:
                    if d.get("matter_id") != matter_id or d.get("invoice_id"):
                        raise Exception(
                            "One or more disbursements are missing, already linked, or not on this matter"
                        )
                    subtotal += float(d.get("amount_inr") or 0)
            inter = place.casefold() != supplier.casefold()
            gst_amount = round(subtotal * 18 / 100, 2)
            if inter:
                cgst, sgst, igst = 0.0, 0.0, gst_amount
            else:
                cgst = round(subtotal * 9 / 100, 2)
                sgst = gst_amount - cgst
                igst = 0.0
            total = round(subtotal + gst_amount, 2)
            inv_num = f"INV-MOCK-{len(self.table('invoices').data) + 1}"
            irn = hashlib.sha256(f"INV-{inv_num}".encode()).hexdigest()
            invoice = {
                "id": f"inv-{len(self.table('invoices').data) + 1}",
                "matter_id": matter_id,
                "invoice_number": inv_num,
                "period_start": params.get("p_period_start"),
                "period_end": params.get("p_period_end"),
                "subtotal_inr": subtotal,
                "gst_percent": 18.0,
                "gst_amount_inr": gst_amount,
                "total_inr": total,
                "work_summary": params.get("p_work_summary"),
                "due_date": params.get("p_due_date"),
                "status": "draft",
                "gstin": "07LEADG1234A1Z5",
                "hsn_sac": "998211",
                "place_of_supply": place,
                "supplier_state": supplier,
                "cgst_amount_inr": cgst,
                "sgst_amount_inr": sgst,
                "igst_amount_inr": igst,
                "is_inter_state": inter,
                "irn": irn,
                "qr_code_data": f"GST-EINVOICE-MOCK-SIGNATURE-DATA-FOR-{inv_num}-IRN-{irn[:16]}",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            self.table("invoices").data.append(invoice)
            for te in self.table("time_entries").data:
                if te.get("id") in te_ids:
                    te["status"] = "billed"
                    te["invoice_id"] = invoice["id"]
            for d in self.table("disbursements").data:
                if d.get("id") in disb_ids:
                    d["invoice_id"] = invoice["id"]
            if draw_retainer and total > 0:
                for fa in self.table("fee_arrangements").data:
                    if (
                        fa.get("matter_id") == matter_id
                        and fa.get("type") == "retainer"
                    ):
                        remaining = float(fa.get("retainer_amount") or 0) - float(
                            fa.get("retainer_used") or 0
                        )
                        if remaining > 0:
                            fa["retainer_used"] = float(
                                fa.get("retainer_used") or 0
                            ) + min(remaining, total)
            return MockRpcBuilder(invoice)

        if name == "mark_invoices_overdue":
            as_of = params.get("p_as_of")
            count = 0
            for inv in self.table("invoices").data:
                if (
                    inv.get("status") == "sent"
                    and inv.get("due_date")
                    and as_of
                    and inv["due_date"] < as_of
                ):
                    inv["status"] = "overdue"
                    count += 1
            return MockRpcBuilder(count)

        if name == "post_retainer_ledger":
            matter_id = params.get("p_matter_id")
            entry_type = params.get("p_entry_type")
            amount = float(params.get("p_amount_inr") or 0)
            fa = None
            for row in self.table("fee_arrangements").data:
                if row.get("matter_id") == matter_id and row.get("type") == "retainer":
                    fa = row
                    break
            if not fa:
                raise Exception("No retainer fee arrangement for matter")
            used = float(fa.get("retainer_used") or 0)
            total = float(fa.get("retainer_amount") or 0)
            if entry_type == "deposit":
                fa["retainer_amount"] = total + amount
            elif entry_type == "drawdown":
                if total - used < amount:
                    raise Exception("Insufficient retainer balance")
                fa["retainer_used"] = used + amount
            elif entry_type == "refund":
                if total - used < amount:
                    raise Exception("Refund exceeds available balance")
                fa["retainer_amount"] = max(0.0, total - amount)
            else:
                fa["retainer_used"] = max(0.0, used + amount)
            balance = float(fa.get("retainer_amount") or 0) - float(
                fa.get("retainer_used") or 0
            )
            entry = {
                "id": f"rl-{len(self.table('retainer_ledger').data) + 1}",
                "matter_id": matter_id,
                "fee_arrangement_id": fa.get("id"),
                "entry_type": entry_type,
                "amount_inr": amount,
                "balance_after": balance,
                "invoice_id": params.get("p_invoice_id"),
                "note": params.get("p_note"),
                "created_by": params.get("p_created_by"),
            }
            self.table("retainer_ledger").data.append(entry)
            return MockRpcBuilder(entry)

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
        if name == "emit_event_with_outbox":
            pending = self.table("pending_notifications")

            event_type = params.get("p_event_type")
            actor_id = params.get("p_actor_id")
            matter_id = params.get("p_matter_id")
            payload = params.get("p_payload") or {}

            for idx, row in enumerate(params.get("p_pending", [])):
                pending.data.append(
                    {
                        "id": f"pending-{len(pending.data) + idx}",
                        "event_type": event_type,
                        "actor_id": actor_id,
                        "matter_id": matter_id,
                        "payload": payload,
                        "subscriber_name": row["subscriber_name"],
                        "status": "pending",
                        "attempts": 0,
                    }
                )

            return MockRpcBuilder([])
        if name == "claim_pending_notifications":
            batch_size = params.get("p_batch_size", 50)

            claimed = []

            for row in self.table("pending_notifications").data:
                if row.get("status") == "pending":
                    row["status"] = "processing"
                    claimed.append(row)

                if len(claimed) >= batch_size:
                    break

            return MockRpcBuilder(claimed)
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
        "app.domains.matters.router.get_service_role_db",
        "app.domains.matching.router.get_db",
        "app.domains.admin.router.get_db",
        # Note: app.domains.consultations.router is shadowed by package export
        # of the APIRouter named `router`. Patch via sys.modules instead below.
        "app.domains.consultations.service.get_db",
        "app.domains.docket.services.billing.get_db",
        "app.domains.docket.services.helpers.get_db",
        "app.shared.dependencies.get_db",
        "app.domains.legal_tools.router.get_db",
        "app.domains.legal_tools.services.draft.get_db",
        "app.domains.system.router.get_service_role_db",
    ):
        try:
            monkeypatch.setattr(path, lambda: client)
        except AttributeError:
            pass

    # Patch the real consultations.router *module* (package attribute shadows it)
    import sys

    cns_mod = sys.modules.get("app.domains.consultations.router")
    if cns_mod is not None and hasattr(cns_mod, "get_db"):
        monkeypatch.setattr(cns_mod, "get_db", lambda: client)
    return client


@pytest.fixture
def mock_user():
    return CurrentUser(
        id="test-user-id", role=UserRole.USER, full_name="Test Petitioner"
    )


@pytest_asyncio.fixture
async def client(mock_user, request) -> AsyncGenerator[AsyncClient, None]:
    # Override authentication dependency to use mock user
    app.dependency_overrides[get_current_user] = lambda: mock_user
    from app.domains.notifications.subscriber import init_subscriber

    init_subscriber()

    headers = {}
    is_integration = (
        "integration" in request.node.keywords or "integration" in request.node.nodeid
    )
    if is_integration:
        from app.config import settings
        import jwt
        import datetime

        token = jwt.encode(
            {
                "sub": mock_user.id,
                "role": "authenticated",
                "aud": "authenticated",
                "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
                "exp": int(
                    (
                        datetime.datetime.now(datetime.timezone.utc)
                        + datetime.timedelta(hours=1)
                    ).timestamp()
                ),
                "app_metadata": {
                    "provider": "email",
                    "providers": ["email"],
                    "role": mock_user.role.value,
                },
                "user_metadata": {"full_name": mock_user.full_name},
            },
            settings.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )
        headers["Authorization"] = f"Bearer {token}"

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=headers
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
