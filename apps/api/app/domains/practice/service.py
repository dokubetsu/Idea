import logging
from datetime import datetime, timezone
from typing import Any
from fastapi import HTTPException
import re
from datetime import date

from app.shared.database import get_db
from app.shared.events import EventType
from app.domains.practice import scenario_loader
from app.domains.practice.rules_engine import FactsGenerator, RulesEngine
from app.domains.practice.schemas import (
    ScenarioSummary,
    ScenarioListResponse,
    SessionNodeChoice,
    SessionNodeState,
    SessionOut,
    DecisionResponse,
    DebriefDecision,
    DebriefResponse,
    BlindSpotDetail,
    PracticeProfileResponse,
    SessionHistoryItem,
)

log = logging.getLogger(__name__)


def render_text(template_str: str, facts: dict, player_input: dict | None = None) -> str:
    if not template_str:
        return template_str
    try:
        context = {}
        for k, v in facts.items():
            if isinstance(v, (date, datetime)):
                v_str = v.strftime("%Y-%m-%d")
            else:
                v_str = str(v)
            context[f"facts.{k}"] = v_str

        for k, v in (player_input or {}).items():
            if isinstance(v, (date, datetime)):
                v_str = v.strftime("%Y-%m-%d")
            else:
                v_str = str(v)
            context[f"input.{k}"] = v_str
            context[k] = v_str

        def replace_match(match):
            token = match.group(1).strip()
            return context.get(token, match.group(0))

        pattern = re.compile(r"\{\{([^}]+)\}\}")
        return pattern.sub(replace_match, template_str)
    except Exception as e:
        log.error(f"Template rendering failed: {e}")
        return template_str


def render_node_state(
    node_id: str, scenario: dict, facts: dict, player_input: dict | None = None
) -> SessionNodeState:
    nodes = scenario.get("nodes", {})
    node = nodes.get(node_id)
    if not node:
        raise ValueError(f"Node '{node_id}' not found in scenario")

    rendered_text = render_text(node.get("text", ""), facts, player_input)

    rendered_choices = []
    if not node.get("player_input", False):
        for choice in node.get("choices", []):
            rendered_choices.append(
                SessionNodeChoice(
                    id=choice.get("id", ""),
                    text=render_text(choice.get("text", ""), facts, player_input),
                )
            )

    return SessionNodeState(
        node_id=node_id,
        text=rendered_text,
        player_input=node.get("player_input", False),
        input_type=node.get("input_type"),
        choices=rendered_choices,
    )


def compute_max_score(nodes: dict) -> int:
    memo: dict[str, int] = {}

    def dfs(node_id):
        if node_id in memo:
            return memo[node_id]
        node = nodes.get(node_id)
        if not node or not node.get("choices"):
            return 0
        max_val = 0
        for choice in node["choices"]:
            score = choice.get("score", 0)
            next_node = choice.get("leads_to")
            if next_node:
                max_val = max(max_val, score + dfs(next_node))
            else:
                max_val = max(max_val, score)
        memo[node_id] = max_val
        return max_val

    return dfs("start")


class PracticeService:
    @staticmethod
    def list_scenarios(
        domain: str | None = None,
        difficulty: str | None = None,
        page: int = 1,
        per_page: int = 10,
    ) -> ScenarioListResponse:
        db = get_db()
        query = db.table("practice_scenarios").select("*").eq("is_active", True)
        if domain:
            query = query.eq("domain", domain)
        if difficulty:
            query = query.eq("difficulty", difficulty)

        # Count total
        count_res = query.execute()
        total = len(count_res.data) if count_res.data else 0

        # Pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page - 1
        res = query.range(start_idx, end_idx).execute()

        scenarios = [ScenarioSummary.model_validate(row) for row in (res.data or [])]
        return ScenarioListResponse(scenarios=scenarios, total=total)

    @staticmethod
    def start_session(user_id: str, scenario_key: str) -> SessionOut:
        scenario = scenario_loader.get_scenario(scenario_key)
        if not scenario:
            raise HTTPException(
                status_code=404, detail=f"Scenario '{scenario_key}' not found"
            )

        db = get_db()
        scenario_db = (
            db.table("practice_scenarios")
            .select("id")
            .eq("scenario_key", scenario_key)
            .single()
            .execute()
        )
        if not scenario_db.data:
            raise HTTPException(
                status_code=404,
                detail=f"Scenario metadata for '{scenario_key}' not found in database",
            )

        # Generate randomized facts
        generated_facts = FactsGenerator.generate(scenario.get("facts", {}))
        max_score = compute_max_score(scenario.get("nodes", {}))

        session_row = {
            "user_id": user_id,
            "scenario_id": scenario_db.data["id"],
            "current_node": "start",
            "status": "active",
            "generated_facts": generated_facts,
            "score": 0,
            "max_score": max_score,
            "decisions_count": 0,
            "correct_count": 0,
        }

        inserted = db.table("practice_sessions").insert(session_row).execute()
        if not inserted.data:
            raise HTTPException(
                status_code=500, detail="Failed to create practice session"
            )

        sess = inserted.data[0]

        # Render first node state
        node_state = render_node_state("start", scenario, generated_facts)

        # Emit started event
        from app.shared.events import sync_emit

        sync_emit(
            EventType.PRACTICE_SESSION_STARTED,
            actor_id=user_id,
            payload={"session_id": sess["id"], "scenario_key": scenario_key},
        )

        return SessionOut(
            id=sess["id"],
            scenario_key=scenario_key,
            scenario_title=scenario["meta"]["title"],
            domain=scenario["meta"]["domain"],
            status=sess["status"],
            score=sess["score"],
            max_score=sess["max_score"],
            decisions_count=sess["decisions_count"],
            correct_count=sess["correct_count"],
            started_at=datetime.fromisoformat(sess["started_at"]),
            generated_facts=sess["generated_facts"],
            current_node=node_state,
        )

    @staticmethod
    def get_session(user_id: str, session_id: str) -> SessionOut:
        db = get_db()
        sess_res = (
            db.table("practice_sessions")
            .select("*, practice_scenarios(scenario_key, title, domain)")
            .eq("id", session_id)
            .execute()
        )
        if not sess_res.data:
            raise HTTPException(status_code=404, detail="Session not found")

        sess = sess_res.data[0]
        if sess["user_id"] != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this session",
            )

        scenario_key = sess["practice_scenarios"]["scenario_key"]
        scenario = scenario_loader.get_scenario(scenario_key)
        if not scenario:
            raise HTTPException(
                status_code=404, detail=f"Scenario '{scenario_key}' not found"
            )

        node_state = None
        if sess["status"] == "active":
            node_state = render_node_state(
                sess["current_node"], scenario, sess["generated_facts"]
            )

        return SessionOut(
            id=sess["id"],
            scenario_key=scenario_key,
            scenario_title=sess["practice_scenarios"]["title"],
            domain=sess["practice_scenarios"]["domain"],
            status=sess["status"],
            score=sess["score"],
            max_score=sess["max_score"],
            decisions_count=sess["decisions_count"],
            correct_count=sess["correct_count"],
            started_at=datetime.fromisoformat(sess["started_at"]),
            completed_at=(
                datetime.fromisoformat(sess["completed_at"])
                if sess["completed_at"]
                else None
            ),
            generated_facts=sess["generated_facts"],
            current_node=node_state,
        )

    @staticmethod
    def submit_decision(
        user_id: str,
        session_id: str,
        choice_id: str,
        input_value: Any | None = None,
        time_taken_ms: int | None = None,
    ) -> DecisionResponse:
        db = get_db()
        sess_res = (
            db.table("practice_sessions")
            .select("*, practice_scenarios(scenario_key, title, domain)")
            .eq("id", session_id)
            .execute()
        )
        if not sess_res.data:
            raise HTTPException(status_code=404, detail="Session not found")

        sess = sess_res.data[0]
        if sess["user_id"] != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this session",
            )

        if sess["status"] != "active":
            raise HTTPException(
                status_code=400, detail="This session is no longer active"
            )

        scenario_key = sess["practice_scenarios"]["scenario_key"]
        scenario = scenario_loader.get_scenario(scenario_key)
        if not scenario:
            raise HTTPException(
                status_code=404, detail=f"Scenario '{scenario_key}' not found"
            )

        nodes = scenario.get("nodes", {})
        current_node_id = sess["current_node"]
        node = nodes.get(current_node_id)
        if not node:
            raise HTTPException(
                status_code=500, detail="Current session node is invalid"
            )

        facts = sess["generated_facts"]
        player_input = {}
        if node.get("player_input"):
            # Construct player input dict mapping input fact keys
            for fact_key, fact_def in scenario.get("facts", {}).items():
                if fact_def.get("player_input"):
                    player_input[fact_key] = input_value

        # Evaluate rules for condition matching
        rules = RulesEngine.evaluate_rules(
            scenario.get("rules", {}), facts, player_input
        )

        matched_choice = None
        if node.get("player_input"):
            # Evaluate conditional choices
            for choice in node.get("choices", []):
                condition = choice.get("condition")
                if condition:
                    try:
                        matched = RulesEngine.evaluate_condition(
                            condition, facts, player_input, rules
                        )
                        if matched:
                            matched_choice = choice
                            break
                    except Exception as e:
                        log.error(f"Failed condition evaluation: {e}")
        else:
            # Match directly by ID
            for choice in node.get("choices", []):
                if choice["id"] == choice_id:
                    matched_choice = choice
                    break

        if not matched_choice:
            raise HTTPException(
                status_code=400,
                detail="Invalid choice selection or no matching condition met",
            )

        is_correct = matched_choice.get("is_correct", False)
        score_awarded = matched_choice.get("score", 0)
        leads_to = matched_choice.get("leads_to")
        issue_tag = matched_choice.get("issue_tag")

        # Render texts
        feedback = render_text(matched_choice.get("feedback", ""), facts, player_input)
        citation = matched_choice.get("citation")

        # Insert decision log
        decision_row = {
            "session_id": session_id,
            "node_id": current_node_id,
            "choice_id": matched_choice.get("id") or "",
            "is_correct": is_correct,
            "score_awarded": score_awarded,
            "issue_tag": issue_tag,
            "input_value": input_value,
            "time_taken_ms": time_taken_ms,
        }
        db.table("practice_decisions").insert(decision_row).execute()

        # Update session values
        new_score = sess["score"] + score_awarded
        new_decisions_count = sess["decisions_count"] + 1
        new_correct_count = sess["correct_count"] + (1 if is_correct else 0)

        # Advance node
        new_status = "active"
        completed_at = None
        next_node_state = None

        if not leads_to or leads_to not in nodes or not nodes[leads_to].get("choices"):
            # Terminal node reached
            new_status = "completed"
            completed_at = datetime.now(timezone.utc).isoformat()
        else:
            # Render next node state
            next_node_state = render_node_state(leads_to, scenario, facts, player_input)

        session_update = {
            "current_node": leads_to or current_node_id,
            "status": new_status,
            "score": new_score,
            "decisions_count": new_decisions_count,
            "correct_count": new_correct_count,
        }
        if completed_at:
            session_update["completed_at"] = completed_at

        db.table("practice_sessions").update(session_update).eq(
            "id", session_id
        ).execute()

        # Update practice profiles if choice contains issue_tag
        if issue_tag:
            profile_res = (
                db.table("practice_profiles")
                .select("*")
                .eq("user_id", user_id)
                .eq("issue_tag", issue_tag)
                .execute()
            )

            profile_row = {
                "user_id": user_id,
                "issue_tag": issue_tag,
                "domain": scenario["meta"]["domain"],
                "last_attempted": datetime.now(timezone.utc).isoformat(),
            }

            if profile_res.data:
                existing_prof = profile_res.data[0]
                profile_row["attempts"] = existing_prof["attempts"] + 1
                profile_row["correct"] = existing_prof["correct"] + (
                    1 if is_correct else 0
                )
                profile_row["streak"] = existing_prof["streak"] + 1 if is_correct else 0

                db.table("practice_profiles").update(profile_row).eq(
                    "id", existing_prof["id"]
                ).execute()
            else:
                profile_row["attempts"] = 1
                profile_row["correct"] = 1 if is_correct else 0
                profile_row["streak"] = 1 if is_correct else 0

                db.table("practice_profiles").insert(profile_row).execute()

        # Emit completed event if finished
        if new_status == "completed":
            from app.shared.events import sync_emit

            sync_emit(
                EventType.PRACTICE_SESSION_COMPLETED,
                actor_id=user_id,
                payload={
                    "session_id": session_id,
                    "scenario_key": scenario_key,
                    "score": new_score,
                    "max_score": sess["max_score"],
                },
            )

        return DecisionResponse(
            choice_id=matched_choice.get("id", ""),
            is_correct=is_correct,
            score_awarded=score_awarded,
            feedback=feedback,
            citation=citation,
            issue_tag=issue_tag,
            next_node=next_node_state,
        )

    @staticmethod
    def get_debrief(user_id: str, session_id: str) -> DebriefResponse:
        db = get_db()
        sess_res = (
            db.table("practice_sessions")
            .select("*, practice_scenarios(scenario_key, title, domain)")
            .eq("id", session_id)
            .execute()
        )
        if not sess_res.data:
            raise HTTPException(status_code=404, detail="Session not found")

        sess = sess_res.data[0]
        if sess["user_id"] != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this session",
            )

        scenario_key = sess["practice_scenarios"]["scenario_key"]
        scenario = scenario_loader.get_scenario(scenario_key)
        if not scenario:
            raise HTTPException(
                status_code=404, detail=f"Scenario '{scenario_key}' not found"
            )

        # Get decisions
        dec_res = (
            db.table("practice_decisions")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .execute()
        )

        decisions = []
        facts = sess["generated_facts"]
        nodes = scenario.get("nodes", {})

        for row in dec_res.data or []:
            node_id = row["node_id"]
            choice_id = row["choice_id"]

            # Reconstruct player input
            player_input = {}
            if node_id in nodes and nodes[node_id].get("player_input"):
                for fact_key, fact_def in scenario.get("facts", {}).items():
                    if fact_def.get("player_input"):
                        player_input[fact_key] = row["input_value"]

            # Find matching choice
            matched_choice = None
            node = nodes.get(node_id)
            if node:
                if node.get("player_input"):
                    # Re-evaluate conditions
                    rules = RulesEngine.evaluate_rules(
                        scenario.get("rules", {}), facts, player_input
                    )
                    for c in node.get("choices", []):
                        cond = c.get("condition")
                        if cond:
                            try:
                                if RulesEngine.evaluate_condition(
                                    cond, facts, player_input, rules
                                ):
                                    matched_choice = c
                                    break
                            except Exception:
                                pass
                else:
                    # Match directly by id
                    for c in node.get("choices", []):
                        if c.get("id") == choice_id:
                            matched_choice = c
                            break

            choice_text = ""
            feedback = ""
            citation = row.get("citation")

            if matched_choice:
                if node.get("player_input"):
                    choice_text = f"Notice Date: {row.get('input_value')}"
                else:
                    choice_text = render_text(
                        matched_choice.get("text", ""), facts, player_input
                    )
                feedback = render_text(
                    matched_choice.get("feedback", ""), facts, player_input
                )
                if not citation:
                    citation = matched_choice.get("citation")

            decisions.append(
                DebriefDecision(
                    node_id=node_id,
                    choice_id=choice_id or "",
                    choice_text=choice_text,
                    is_correct=row["is_correct"],
                    score_awarded=row["score_awarded"],
                    feedback=feedback,
                    citation=citation,
                    issue_tag=row.get("issue_tag"),
                    input_value=row.get("input_value"),
                    time_taken_ms=row.get("time_taken_ms"),
                )
            )

        return DebriefResponse(
            session_id=sess["id"],
            scenario_title=sess["practice_scenarios"]["title"],
            domain=sess["practice_scenarios"]["domain"],
            score=sess["score"],
            max_score=sess["max_score"],
            decisions_count=sess["decisions_count"],
            correct_count=sess["correct_count"],
            started_at=datetime.fromisoformat(sess["started_at"]),
            completed_at=(
                datetime.fromisoformat(sess["completed_at"])
                if sess["completed_at"]
                else None
            ),
            decisions=decisions,
        )

    @staticmethod
    def get_profile(user_id: str) -> PracticeProfileResponse:
        db = get_db()
        res = db.table("practice_profiles").select("*").eq("user_id", user_id).execute()

        details = []
        for row in res.data or []:
            attempts = row["attempts"]
            correct = row["correct"]
            accuracy = correct / attempts if attempts > 0 else 0.0
            details.append(
                BlindSpotDetail(
                    issue_tag=row["issue_tag"],
                    domain=row["domain"],
                    attempts=attempts,
                    correct=correct,
                    accuracy=accuracy,
                    streak=row["streak"],
                    last_attempted=datetime.fromisoformat(row["last_attempted"]),
                )
            )

        blind_spots = sorted(details, key=lambda x: x.accuracy)
        strengths = sorted(details, key=lambda x: x.accuracy, reverse=True)

        return PracticeProfileResponse(blind_spots=blind_spots, strengths=strengths)

    @staticmethod
    def get_history(
        user_id: str, page: int = 1, per_page: int = 10
    ) -> list[SessionHistoryItem]:
        db = get_db()
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page - 1

        res = (
            db.table("practice_sessions")
            .select(
                "id, score, max_score, status, completed_at, practice_scenarios(title, domain, difficulty)"
            )
            .eq("user_id", user_id)
            .order("started_at", desc=True)
            .range(start_idx, end_idx)
            .execute()
        )

        history = []
        for row in res.data or []:
            scen = row.get("practice_scenarios", {})
            history.append(
                SessionHistoryItem(
                    id=row["id"],
                    scenario_title=scen.get("title", ""),
                    domain=scen.get("domain", ""),
                    difficulty=scen.get("difficulty", ""),
                    score=row["score"],
                    max_score=row["max_score"],
                    status=row["status"],
                    completed_at=(
                        datetime.fromisoformat(row["completed_at"])
                        if row.get("completed_at")
                        else None
                    ),
                )
            )
        return history
