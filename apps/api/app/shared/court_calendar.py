from datetime import date, timedelta

NATIONAL_HOLIDAYS_2025 = {
    date(2025, 1, 26),  # Republic Day
    date(2025, 8, 15),  # Independence Day
    date(2025, 10, 2),  # Gandhi Jayanti
    date(2025, 10, 20),  # Diwali
    date(2025, 12, 25),  # Christmas
}


def is_second_saturday(d: date) -> bool:
    # Saturday is 5 (0 = Monday, 6 = Sunday)
    # The second Saturday always falls on a date from 8 to 14
    return d.weekday() == 5 and 8 <= d.day <= 14


def is_court_working_day(d: date) -> bool:
    if d.weekday() == 6:  # Sunday
        return False
    if is_second_saturday(d):
        return False
    if d in NATIONAL_HOLIDAYS_2025:
        return False
    return True


def next_working_day(d: date) -> date:
    """If the day is a court holiday, returns the next working day."""
    curr = d
    while not is_court_working_day(curr):
        curr += timedelta(days=1)
    return curr
