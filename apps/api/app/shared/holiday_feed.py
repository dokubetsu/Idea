"""
Court holiday feed: fetch JSON calendars into court_holiday_cache and merge
with static STATE_HOLIDAYS in court_calendar.

Expected feed JSON:
  {
    "state": "Maharashtra",
    "year": 2026,
    "holidays": ["2026-05-01", "2026-08-19"]
  }
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from app.shared.court_calendar import STATE_HOLIDAYS, _normalize_state_key

log = logging.getLogger(__name__)


def _parse_dates(items: list) -> set[date]:
    out: set[date] = set()
    for item in items:
        if isinstance(item, str):
            out.add(date.fromisoformat(item[:10]))
        elif isinstance(item, dict) and item.get("date"):
            out.add(date.fromisoformat(str(item["date"])[:10]))
    return out


def fetch_holiday_feed(url: str) -> dict:
    import httpx

    with httpx.Client(timeout=15.0) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.json()


def apply_feed_to_memory(data: dict) -> int:
    """Merge feed holidays into in-process STATE_HOLIDAYS. Returns count added."""
    state = _normalize_state_key(data.get("state") or data.get("state_key"))
    if not state:
        raise ValueError("Feed missing state")
    holidays = _parse_dates(data.get("holidays") or [])
    existing = STATE_HOLIDAYS.setdefault(state, set())
    before = len(existing)
    existing |= holidays
    return len(existing) - before


def cache_feed_to_db(db, data: dict, source_url: str | None = None) -> dict:
    state = (
        _normalize_state_key(data.get("state") or data.get("state_key")) or "national"
    )
    year = int(data.get("year") or date.today().year)
    holidays = [d.isoformat() for d in sorted(_parse_dates(data.get("holidays") or []))]
    row = {
        "state_key": state,
        "year": year,
        "holidays": holidays,
        "source_url": source_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    # upsert by unique (state_key, year)
    existing = (
        db.table("court_holiday_cache")
        .select("id")
        .eq("state_key", state)
        .eq("year", year)
        .execute()
        .data
    )
    if existing:
        db.table("court_holiday_cache").update(row).eq(
            "id", existing[0]["id"]
        ).execute()
        row["id"] = existing[0]["id"]
    else:
        ins = db.table("court_holiday_cache").insert(row).execute()
        if ins.data:
            row = ins.data[0]
    apply_feed_to_memory({"state": state, "holidays": holidays})
    return row


def load_cached_holidays(db, state: str | None = None, year: int | None = None) -> int:
    """Load DB cache into memory. Returns number of dates merged."""
    year = year or date.today().year
    q = db.table("court_holiday_cache").select("*").eq("year", year)
    if state:
        q = q.eq("state_key", _normalize_state_key(state) or state)
    rows = q.execute().data or []
    total = 0
    for row in rows:
        total += apply_feed_to_memory(
            {"state": row.get("state_key"), "holidays": row.get("holidays") or []}
        )
    return total


async def refresh_holiday_feed(db, url: str | None = None) -> dict:
    from app.config import settings

    feed_url = url or settings.COURT_HOLIDAY_FEED_URL
    if not feed_url:
        # Still try loading DB cache
        n = load_cached_holidays(db)
        return {"source": "cache_only", "merged": n, "url": None}

    data = fetch_holiday_feed(feed_url)
    # Support list of state payloads
    if isinstance(data, list):
        merged = 0
        for item in data:
            cache_feed_to_db(db, item, source_url=feed_url)
            merged += apply_feed_to_memory(item)
        return {"source": "feed", "merged": merged, "url": feed_url}

    row = cache_feed_to_db(db, data, source_url=feed_url)
    return {
        "source": "feed",
        "merged": len(data.get("holidays") or []),
        "url": feed_url,
        "cache": row,
    }
