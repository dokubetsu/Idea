"""
Indian court working-day calendar.

National holidays + 2nd/4th Saturday closures apply nationwide.
Optional *state* argument adds state High Court / district gazetted holidays
for major states (best-effort; not a substitute for official court calendars).
"""

from __future__ import annotations

from datetime import date, timedelta

NATIONAL_HOLIDAYS = {
    # 2025
    date(2025, 1, 26),
    date(2025, 3, 14),
    date(2025, 4, 14),
    date(2025, 4, 18),
    date(2025, 8, 15),
    date(2025, 10, 2),
    date(2025, 10, 20),
    date(2025, 12, 25),
    # 2026
    date(2026, 1, 26),  # Republic Day
    date(2026, 3, 10),  # Maha Shivaratri
    date(2026, 3, 31),  # Id-ul-Fitr (tentative)
    date(2026, 4, 2),  # Ram Navami
    date(2026, 4, 3),  # Good Friday
    date(2026, 4, 14),  # Dr. Ambedkar Jayanti
    date(2026, 5, 25),  # Buddha Purnima
    date(2026, 8, 15),  # Independence Day
    date(2026, 10, 2),  # Gandhi Jayanti
    date(2026, 10, 9),  # Diwali (tentative)
    date(2026, 11, 19),  # Guru Nanak Jayanti
    date(2026, 12, 25),  # Christmas
}

# State-specific gazetted holidays (illustrative 2026 set; extend via config as needed)
STATE_HOLIDAYS: dict[str, set[date]] = {
    "maharashtra": {
        date(2026, 5, 1),  # Maharashtra Day
        date(2026, 4, 14),  # Dr. Ambedkar Jayanti (state observance)
        date(2026, 8, 19),  # Gokulashtami (approx)
        date(2026, 9, 17),  # Ganesh Chaturthi (approx public)
    },
    "delhi": {
        date(2026, 3, 14),  # Holi (tentative)
        date(2026, 10, 10),  # Govardhan Puja (tentative)
        date(2026, 11, 5),  # Chhath (optional)
    },
    "karnataka": {
        date(2026, 11, 1),  # Kannada Rajyotsava
        date(2026, 4, 14),  # Ambedkar Jayanti
    },
    "tamil nadu": {
        date(2026, 1, 14),  # Pongal
        date(2026, 1, 15),  # Thiruvalluvar Day
        date(2026, 4, 14),  # Tamil New Year / Ambedkar
    },
    "west bengal": {
        date(2026, 1, 23),  # Netaji Jayanti
        date(2026, 4, 14),  # Poila Boishakh / Ambedkar
        date(2026, 10, 11),  # Durga Puja window (sample)
        date(2026, 10, 12),
    },
    "gujarat": {
        date(2026, 1, 14),  # Uttarayan
        date(2026, 10, 31),  # Sardar Patel Jayanti
    },
    "uttar pradesh": {
        date(2026, 3, 14),  # Holi
        date(2026, 8, 26),  # Janmashtami (approx)
    },
    "rajasthan": {
        date(2026, 3, 30),  # Rajasthan Day
        date(2026, 3, 14),  # Holi
    },
    "telangana": {
        date(2026, 6, 2),  # Telangana Formation Day
        date(2026, 4, 14),
    },
    "kerala": {
        date(2026, 8, 28),  # Onam (approx first day public)
        date(2026, 4, 14),  # Vishu / Ambedkar
    },
}


def _normalize_state_key(state: str | None) -> str | None:
    if not state:
        return None
    return str(state).strip().lower()


def is_second_saturday(d: date) -> bool:
    return d.weekday() == 5 and 8 <= d.day <= 14


def is_fourth_saturday(d: date) -> bool:
    return d.weekday() == 5 and 22 <= d.day <= 28


def is_court_working_day(d: date, state: str | None = None) -> bool:
    """
    Return True if courts are expected to sit on date *d*.

    When *state* is provided, also excludes that state's holiday set.
    """
    if d.weekday() == 6:  # Sunday
        return False
    if is_second_saturday(d):
        return False
    if is_fourth_saturday(d):
        return False
    # Fixed national holidays for any year
    if (
        (d.month == 1 and d.day == 26)
        or (d.month == 8 and d.day == 15)
        or (d.month == 10 and d.day == 2)
        or (d.month == 12 and d.day == 25)
    ):
        return False
    if d in NATIONAL_HOLIDAYS:
        return False

    key = _normalize_state_key(state)
    if key and d in STATE_HOLIDAYS.get(key, set()):
        return False
    return True


def next_working_day(d: date, state: str | None = None) -> date:
    """If the day is a court holiday, returns the next working day."""
    curr = d
    # Safety cap avoids infinite loops on bad calendars
    for _ in range(366):
        if is_court_working_day(curr, state=state):
            return curr
        curr += timedelta(days=1)
    return curr


def list_supported_states() -> list[str]:
    return sorted({k.title() for k in STATE_HOLIDAYS} | {"National"})
