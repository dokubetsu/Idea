import os
import glob
import yaml  # type: ignore[import-untyped]
import logging

log = logging.getLogger(__name__)

_scenarios_cache: dict[str, dict] = {}


def get_scenarios_dir() -> str:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, "..", "..", "..", "scenarios"))


def _validate_graph(nodes: dict) -> None:
    if "start" not in nodes:
        raise ValueError("Scenario must have a 'start' node")

    visited = set()
    rec_stack = set()

    def dfs(node_id):
        if node_id in rec_stack:
            raise ValueError(f"Cycle detected in graph involving node '{node_id}'")
        if node_id in visited:
            return

        rec_stack.add(node_id)

        node = nodes.get(node_id)
        if not node:
            raise ValueError(f"Node '{node_id}' not found in scenario nodes")

        choices = node.get("choices") or []
        for choice in choices:
            target = choice.get("leads_to")
            if target:
                if target not in nodes:
                    raise ValueError(
                        f"Choice '{choice.get('id')}' in node '{node_id}' leads to non-existent node '{target}'"
                    )
                dfs(target)

        rec_stack.remove(node_id)
        visited.add(node_id)

    dfs("start")

    # Verify all nodes are reachable
    all_nodes = set(nodes.keys())
    unreachable = all_nodes - visited
    if unreachable:
        raise ValueError(f"Unreachable nodes detected: {unreachable}")


def load_all_scenarios() -> None:
    _scenarios_cache.clear()
    scenarios_dir = get_scenarios_dir()
    if not os.path.exists(scenarios_dir):
        log.warning(f"Scenarios directory not found at {scenarios_dir}")
        return

    pattern_yaml = os.path.join(scenarios_dir, "**", "*.yaml")
    pattern_yml = os.path.join(scenarios_dir, "**", "*.yml")
    files = glob.glob(pattern_yaml, recursive=True) + glob.glob(
        pattern_yml, recursive=True
    )

    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            if not data or "meta" not in data or "nodes" not in data:
                log.warning(f"Invalid scenario file {file_path}")
                continue

            scenario_id = data["meta"]["id"]
            _validate_graph(data["nodes"])

            _scenarios_cache[scenario_id] = data
            log.info(f"Loaded scenario '{scenario_id}' from {file_path}")
        except Exception as e:
            log.error(f"Failed to load scenario from {file_path}: {e}")
            raise e


def get_scenario(key: str) -> dict | None:
    return _scenarios_cache.get(key)


def get_all_cached_scenarios() -> dict:
    return _scenarios_cache


def sync_to_database() -> None:
    from app.shared.database import get_service_role_db

    db = get_service_role_db()
    for key, scenario in _scenarios_cache.items():
        meta = scenario.get("meta", {})
        row = {
            "scenario_key": key,
            "title": meta.get("title"),
            "domain": meta.get("domain"),
            "difficulty": meta.get("difficulty"),
            "based_on": meta.get("based_on"),
            "estimated_minutes": meta.get("estimated_minutes", 5),
            "tags": meta.get("tags", []),
            "version": meta.get("version", 1),
            "is_active": meta.get("is_active", True),
        }

        existing = (
            db.table("practice_scenarios")
            .select("id")
            .eq("scenario_key", key)
            .execute()
        )
        if existing.data:
            db.table("practice_scenarios").update(row).eq("scenario_key", key).execute()
        else:
            db.table("practice_scenarios").insert(row).execute()
    log.info(f"Synced {len(_scenarios_cache)} scenarios to database.")
