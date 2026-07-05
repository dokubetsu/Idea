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
    date(2026, 4, 3),  # Good Friday (Easter 2026 = April 5; GF = April 3)
    date(2026, 4, 14),  # Dr. Ambedkar Jayanti
    date(2026, 5, 25),  # Buddha Purnima
    date(2026, 8, 15),  # Independence Day
    date(2026, 10, 2),  # Gandhi Jayanti
    date(2026, 10, 9),  # Diwali (tentative)
    date(2026, 11, 19),  # Guru Nanak Jayanti
    date(2026, 12, 25),  # Christmas
}


def is_second_saturday(d: date) -> bool:
    # Saturday is 5 (0 = Monday, 6 = Sunday)
    # The second Saturday always falls on a date from 8 to 14
    return d.weekday() == 5 and 8 <= d.day <= 14


def is_fourth_saturday(d: date) -> bool:
    # The fourth Saturday always falls on a date from 22 to 28
    # Most Indian District Courts, Consumer Forums, and RERA authorities
    # observe both 2nd AND 4th Saturday closures per SC administrative
    # orders (2014) and state gazette notifications.
    return d.weekday() == 5 and 22 <= d.day <= 28


def is_court_working_day(d: date) -> bool:
    if d.weekday() == 6:  # Sunday
        return False
    if is_second_saturday(d):
        return False
    if is_fourth_saturday(d):
        return False
    if d in NATIONAL_HOLIDAYS:
        return False
    return True


def next_working_day(d: date) -> date:
    """If the day is a court holiday, returns the next working day."""
    curr = d
    while not is_court_working_day(curr):
        curr += timedelta(days=1)
    return curr
