import pytest
from datetime import date
from httpx import AsyncClient
from app.shared.dependencies import get_current_user, CurrentUser, UserRole
from app.main import app
from app.domains.practice.rules_engine import RulesEngine, parse_dates_in_dict
from app.domains.practice.scenario_loader import _validate_graph, _scenarios_cache
from app.domains.practice.service import PracticeService


def test_rules_engine_dates_and_evaluation():
    # Test date parsing
    facts = {
        "cheque_date": "2026-05-01",
        "dishonour_date": "2026-05-10",
        "notice_date": "2026-05-25",
    }
    parsed = parse_dates_in_dict(facts)
    assert isinstance(parsed["cheque_date"], date)
    assert parsed["cheque_date"] == date(2026, 5, 1)

    # Test arithmetic evaluation
    # 9 days difference (<= 90)
    rule1 = "((facts.dishonour_date - facts.cheque_date).days) <= 90"
    assert RulesEngine.evaluate_condition(rule1, parsed, {}, {}) is True

    # 24 days difference (<= 30)
    rule2 = "((facts.notice_date - facts.dishonour_date).days) <= 30"
    assert RulesEngine.evaluate_condition(rule2, parsed, {}, {}) is True

    # Check math expression failure case
    rule3 = "((facts.notice_date - facts.cheque_date).days) < 10"
    assert RulesEngine.evaluate_condition(rule3, parsed, {}, {}) is False


def test_scenario_loader_dag_validation():
    # Valid scenario structure mock
    valid_data = {
        "nodes": {
            "start": {
                "text": "Start node text",
                "choices": [
                    {"id": "c1", "text": "Choice 1", "leads_to": "node2"},
                    {"id": "c2", "text": "Choice 2", "leads_to": "node3"},
                ],
            },
            "node2": {
                "text": "Node 2 text",
                "choices": [{"id": "c3", "text": "Choice 3", "leads_to": "end"}],
            },
            "node3": {
                "text": "Node 3 text",
                "choices": [{"id": "c4", "text": "Choice 4", "leads_to": "end"}],
            },
            "end": {"text": "End node text", "choices": []},
        },
    }
    # Should not raise any error
    _validate_graph(valid_data["nodes"])

    # Invalid scenario: Cycles detected
    cyclic_data = {
        "nodes": {
            "start": {
                "text": "Start node text",
                "choices": [{"id": "c1", "text": "Choice 1", "leads_to": "node2"}],
            },
            "node2": {
                "text": "Node 2 text",
                "choices": [{"id": "c2", "text": "Choice 2", "leads_to": "start"}],
            },
        },
    }
    with pytest.raises(ValueError, match="Cycle detected"):
        _validate_graph(cyclic_data["nodes"])

    # Invalid scenario: Orphan nodes detected
    orphan_data = {
        "nodes": {
            "start": {
                "text": "Start node text",
                "choices": [{"id": "c1", "text": "Choice 1", "leads_to": "node2"}],
            },
            "node2": {
                "text": "Node 2 text",
                "choices": [],
            },
            "orphan": {
                "text": "Orphan node text",
                "choices": [],
            },
        },
    }
    with pytest.raises(ValueError, match="Unreachable nodes detected"):
        _validate_graph(orphan_data["nodes"])


@pytest.mark.asyncio
async def test_practice_service_gameplay(mock_db):
    user_id = "test-player-id"

    # Setup scenario cache
    test_scenario_data = {
        "meta": {
            "id": "test_case",
            "title": "Cheque Bounce Notice Trap",
            "domain": "Cheque Bounce",
            "difficulty": "beginner",
            "estimated_minutes": 5,
            "based_on": "Section 138 NI Act",
            "tags": ["Negotiable Instruments", "Notice"],
            "version": 1,
            "is_active": True,
        },
        "facts": {
            "cheque_date": {
                "type": "pool",
                "values": ["2026-05-01"]
            },
            "dishonour_date": {
                "type": "pool",
                "values": ["2026-05-03"]
            },
            "notice_date": {
                "player_input": True
            }
        },
        "nodes": {
            "start": {
                "text": "The cheque date is {{facts.cheque_date}}.",
                "choices": [
                    {
                        "id": "c_correct",
                        "text": "Correct choice",
                        "leads_to": "notice_date_node",
                        "score": 10,
                        "is_correct": True,
                        "feedback": "Well done",
                        "citation": "Sec 138(a)",
                        "issue_tag": "notice_period",
                    },
                    {
                        "id": "c_incorrect",
                        "text": "Incorrect choice",
                        "leads_to": "notice_date_node",
                        "score": 0,
                        "is_correct": False,
                        "feedback": "Try again",
                    },
                ],
            },
            "notice_date_node": {
                "text": "Choose date.",
                "player_input": True,
                "input_type": "date",
                "choices": [
                    {
                        "condition": "((input.notice_date - facts.dishonour_date).days) <= 30",
                        "leads_to": "end",
                        "score": 10,
                        "is_correct": True,
                        "feedback": "Notice within 30 days is correct.",
                        "citation": "Sec 138(b)",
                        "issue_tag": "notice_timeline",
                    },
                    {
                        "condition": "((input.notice_date - facts.dishonour_date).days) > 30",
                        "leads_to": "end",
                        "score": 0,
                        "is_correct": False,
                        "feedback": "Too late.",
                        "citation": "Sec 138(b)",
                        "issue_tag": "notice_timeline",
                    },
                ],
            },
            "end": {"text": "Scenario ended.", "choices": []},
        },
    }
    _scenarios_cache["test_case"] = test_scenario_data

    # Seed scenario in db metadata
    mock_db.table("practice_scenarios").data = [
        {
            "id": "scen-uuid",
            "scenario_key": "test_case",
            "title": "Cheque Bounce Notice Trap",
            "domain": "Cheque Bounce",
            "difficulty": "beginner",
            "estimated_minutes": 5,
            "based_on": "Section 138 NI Act",
            "tags": ["Negotiable Instruments", "Notice"],
            "version": 1,
            "is_active": True,
        }
    ]

    # 1. Start Session
    session = PracticeService.start_session(user_id, "test_case")
    assert session.scenario_key == "test_case"
    assert session.status == "active"
    assert session.score == 0
    assert session.max_score == 20  # correct path: 10 (c_correct) + 10 (notice_date_node)
    assert session.current_node is not None
    assert "2026-05-01" in session.current_node.text

    session_id = session.id

    # Populate joined relation mock data for select query
    session_row = mock_db.table("practice_sessions").data[0]
    session_row["practice_scenarios"] = {
        "scenario_key": "test_case",
        "title": "Cheque Bounce Notice Trap",
        "domain": "Cheque Bounce",
        "difficulty": "beginner"
    }

    # 2. Submit Correct Choice
    res1 = PracticeService.submit_decision(
        user_id, session_id, choice_id="c_correct", time_taken_ms=1000
    )
    assert res1.is_correct is True
    assert res1.score_awarded == 10
    assert res1.next_node is not None
    assert res1.next_node.node_id == "notice_date_node"

    # 3. Submit Input Date (evaluation of rule)
    # 2026-05-15 is 12 days after dishonour (2026-05-03), which is <= 30
    res2 = PracticeService.submit_decision(
        user_id,
        session_id,
        choice_id="",
        input_value="2026-05-15",
        time_taken_ms=1500,
    )
    assert res2.is_correct is True
    assert res2.score_awarded == 10
    # Next node should be end, making session completed
    assert res2.next_node is None

    # Check session state in DB became completed
    updated_session = PracticeService.get_session(user_id, session_id)
    assert updated_session.status == "completed"
    assert updated_session.score == 20

    # 4. Fetch Debrief
    debrief = PracticeService.get_debrief(user_id, session_id)
    assert debrief.score == 20
    assert debrief.max_score == 20
    assert len(debrief.decisions) == 2
    assert debrief.decisions[0].is_correct is True
    assert debrief.decisions[1].is_correct is True

    # 5. Check Profile & History
    profile = PracticeService.get_profile(user_id)
    assert len(profile.strengths) > 0

    history = PracticeService.get_history(user_id)
    assert len(history) == 1
    assert history[0].id == session_id
    assert history[0].score == 20


@pytest.mark.asyncio
async def test_router_endpoints(client: AsyncClient, mock_db):
    # Enable FEATURE_PRACTICE settings override
    from app.config import settings

    settings.FEATURE_PRACTICE = True

    # Setup mock user auth dependency override
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="test-router-user-id", role=UserRole.USER, full_name="Router Player"
    )

    try:
        # Mocking scenario data & session records in DB
        mock_db.table("practice_scenarios").data = [
            {
                "id": "scen-uuid",
                "scenario_key": "cheque_bounce_notice",
                "title": "Cheque Bounce Notice",
                "domain": "Cheque Bounce",
                "difficulty": "beginner",
                "estimated_minutes": 5,
                "based_on": "Section 138 NI Act",
                "tags": ["Cheque", "Notice"],
                "version": 1,
                "is_active": True,
            }
        ]

        # Seed completed session with join info
        mock_db.table("practice_sessions").data = [
            {
                "id": "sess-uuid",
                "user_id": "test-router-user-id",
                "scenario_id": "scen-uuid",
                "status": "completed",
                "score": 20,
                "max_score": 20,
                "completed_at": "2026-06-25T12:00:00Z",
                "practice_scenarios": {
                    "title": "Cheque Bounce Notice",
                    "domain": "Cheque Bounce",
                    "difficulty": "beginner"
                }
            }
        ]

        # GET /scenarios
        res = await client.get("/api/v1/practice/scenarios")
        assert res.status_code == 200
        data = res.json()
        assert len(data["scenarios"]) == 1
        assert data["scenarios"][0]["scenario_key"] == "cheque_bounce_notice"

        # GET /profile
        res_prof = await client.get("/api/v1/practice/profile")
        assert res_prof.status_code == 200
        prof_data = res_prof.json()
        assert "blind_spots" in prof_data

        # GET /history
        res_hist = await client.get("/api/v1/practice/history")
        assert res_hist.status_code == 200
        assert isinstance(res_hist.json(), list)

    finally:
        app.dependency_overrides.clear()
