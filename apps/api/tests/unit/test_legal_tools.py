"""
Unit tests for India Legal Tools (Calculators & Interest).
"""

import pytest
from datetime import date
from app.domains.legal_tools.services.interest import InterestSource
from app.domains.legal_tools.services.calculators import (
    ChequeBounceCalculator,
    RERACalculator,
    SummarySuitCalculator,
)


def test_interest_source():
    # RERA dynamic rate default
    assert InterestSource.get_rera_rate() == 11.0

    # Custom rate override
    assert InterestSource.get_rera_rate(custom_rate=12.0) == 12.0

    # Negative interest safety check
    with pytest.raises(ValueError, match="Interest rate cannot be negative"):
        InterestSource.get_rera_rate(custom_rate=-1.5)


def test_cheque_bounce_calculator_timelines():
    # 1. Safe Scenario: presented on time, notice sent on time, filed in window
    cheque = date(2026, 3, 1)
    dishonour = date(2026, 3, 5)  # 4 days presentation (valid <= 90)
    notice = date(2026, 3, 20)  # 15 days notice sent (valid <= 30)
    receipt = date(2026, 3, 22)  # received. wait ends April 6 (receipt + 15)
    filed = date(2026, 4, 10)  # filed. window is April 7 to May 6.

    res = ChequeBounceCalculator.calculate(
        cheque_date=cheque,
        dishonour_date=dishonour,
        notice_date=notice,
        notice_receipt_date=receipt,
        complaint_filed_date=filed,
        current_date=date(2026, 4, 12),
    )
    assert res["presentation_valid"] is True
    assert res["notice_valid"] is True
    assert res["filing_valid"] is True
    assert res["status"] == "safe"
    assert "filed successfully" in res["reason"]

    # 2. Expired notice deadline (> 30 days dishonour)
    bad_notice = date(2026, 4, 10)
    res_bad = ChequeBounceCalculator.calculate(
        cheque_date=cheque,
        dishonour_date=dishonour,
        notice_date=bad_notice,
        current_date=date(2026, 4, 12),
    )
    assert res_bad["notice_valid"] is False
    assert res_bad["status"] == "expired"
    assert "sent 36 days after dishonour" in res_bad["reason"]


def test_cheque_bounce_leap_year():
    # Leap year edge case: cheque written Feb 28, 2028 (leap year), dishonoured Feb 29, 2028
    cheque = date(2028, 2, 28)
    dishonour = date(2028, 2, 29)
    res = ChequeBounceCalculator.calculate(
        cheque_date=cheque, dishonour_date=dishonour, current_date=date(2028, 3, 1)
    )
    assert res["presentation_valid"] is True
    assert res["status"] == "safe"


def test_cheque_bounce_validation_safety():
    # Dates out of order checks
    cheque = date(2026, 3, 1)
    dishonour_earlier = date(2026, 2, 28)
    with pytest.raises(
        ValueError, match="Dishonour date cannot be earlier than cheque date"
    ):
        ChequeBounceCalculator.calculate(
            cheque_date=cheque, dishonour_date=dishonour_earlier
        )


def test_rera_calculator_delay_interest():
    # Delay possession scenario
    promised = date(2025, 12, 31)
    possession = date(2026, 12, 31)  # 1 year delay (365 days)
    paid = 1000000.0  # 10 Lakh

    res = RERACalculator.calculate(
        total_paid_amount=paid,
        promised_possession_date=promised,
        actual_possession_date=possession,
    )
    assert res["delay_days"] == 365
    assert res["interest_rate"] == 11.0
    # simple interest: 10 Lakh * 11.0% * 1 year = 1,10,000 INR
    assert res["interest_accrued"] == 110000.0
    assert res["total_claim"] == 1110000.0
    assert res["status"] == "action_required"

    # Zero paid safety check
    with pytest.raises(ValueError, match="Total paid amount must be greater than zero"):
        RERACalculator.calculate(total_paid_amount=0, promised_possession_date=promised)


def test_summary_suit_calculator_cpc():
    # CPC Order 37 check. Valid suit (less than 3 years)
    due = date(2024, 6, 1)
    filed = date(2026, 6, 1)

    res = SummarySuitCalculator.calculate(
        claim_amount=500000.0, due_date=due, state="delhi", current_date=filed
    )
    # Expiry date should be June 1, 2027 (3 years)
    assert res["limitation_expiry"] == "2027-06-01"
    assert res["days_remaining"] == 365
    assert res["status"] == "safe"

    # Check Delhi court fees for 5 Lakh
    # Scale: ₹1,750 + 1.5% of excess over 50,000 = 1,750 + (4,50,000 * 0.015) = 1,750 + 6,750 = 8,500
    assert res["court_fee"] == 8500.0

    # Expired suit (more than 3 years)
    res_expired = SummarySuitCalculator.calculate(
        claim_amount=500000.0,
        due_date=due,
        state="delhi",
        current_date=date(2028, 6, 1),
    )
    assert res_expired["days_remaining"] < 0
    assert res_expired["status"] == "expired"


def test_document_draft_generation(mock_db):
    # 1. Setup mock records on the mock client tables
    mock_db.table("matters").data = [
        {
            "id": "matter-123",
            "user_id": "client-123",
            "lawyer_id": "lawyer-123",
            "category": "cheque_bounce",
            "title": "Unpaid retail invoice dues",
            "summary": "Opposition bounced the cheque issued for salary clearance.",
            "profiles": {
                "full_name": "Rahul Sharma",
                "city": "Pune",
                "state": "Maharashtra",
            },
        }
    ]

    mock_db.table("profiles").data = [
        {
            "id": "lawyer-123",
            "full_name": "Advocate Smita Patil",
            "city": "Pune",
            "state": "Maharashtra",
        }
    ]

    mock_db.table("lawyer_profiles").data = [
        {"id": "lawyer-123", "bar_council_id": "MAH/9988/2020"}
    ]

    mock_db.table("facts").data = [
        {"matter_id": "matter-123", "key": "cheque_number", "value": "123456"},
        {"matter_id": "matter-123", "key": "cheque_amount", "value": "250000"},
        {"matter_id": "matter-123", "key": "cheque_date", "value": "2026-03-01"},
        {"matter_id": "matter-123", "key": "bank_name", "value": "ICICI Bank"},
        {"matter_id": "matter-123", "key": "dishonour_date", "value": "2026-03-05"},
        {
            "matter_id": "matter-123",
            "key": "dishonour_reason",
            "value": "Account Closed",
        },
    ]

    class MockUser:
        def __init__(self, uid, role="user"):
            self.id = uid
            self.role = role

    current_user = MockUser("client-123")

    from app.domains.legal_tools.services.draft import DocumentDraftService

    # 2. Generate Vakalatnama
    res_v = DocumentDraftService.generate("matter-123", "vakalatnama", current_user)
    assert "VAKALATNAMA" in res_v["draft_content"]
    assert "Rahul Sharma" in res_v["draft_content"]
    assert "Advocate Smita Patil" in res_v["draft_content"]
    assert "MAH/9988/2020" in res_v["draft_content"]

    # 3. Generate Section 138 Notice
    res_n = DocumentDraftService.generate(
        "matter-123", "legal_notice_138", current_user
    )
    assert "LEGAL NOTICE (SECTION 138 NI ACT)" in res_n["draft_content"]
    assert "123456" in res_n["draft_content"]
    assert "250,000" in res_n["draft_content"]
    assert "ICICI Bank" in res_n["draft_content"]
    assert "Account Closed" in res_n["draft_content"]


def test_leap_year_suit_limitation():
    # Leap year: Feb 29, 2024. 3 years later should be Feb 28, 2027.
    # Since Feb 28, 2027 is a Sunday, the court calendar extends it to March 1, 2027 (Monday).
    due = date(2024, 2, 29)
    res = SummarySuitCalculator.calculate(
        claim_amount=500000.0,
        due_date=due,
        state="delhi",
        current_date=date(2027, 3, 1),
    )
    assert res["limitation_expiry"] == "2027-03-01"
    assert res["days_remaining"] == 0
    assert res["status"] == "action_required"

    # One day later should be expired
    res_expired = SummarySuitCalculator.calculate(
        claim_amount=500000.0,
        due_date=due,
        state="delhi",
        current_date=date(2027, 3, 2),
    )
    assert res_expired["days_remaining"] < 0
    assert res_expired["status"] == "expired"


def test_cheque_bounce_calendar_month():
    # Test calendar month calculation under Section 142(b) NI Act.
    # Cause of action arises after 15 days of notice receipt.
    # e.g., notice received Jan 16, 2026 -> wait ends Jan 31, 2026.
    # Under calendar month, Jan 31 + 1 month = Feb 28 (non-leap year).
    cheque = date(2026, 1, 1)
    dishonour = date(2026, 1, 5)
    notice = date(2026, 1, 15)
    receipt = date(2026, 1, 16)  # wait ends Jan 31

    res = ChequeBounceCalculator.calculate(
        cheque_date=cheque,
        dishonour_date=dishonour,
        notice_date=notice,
        notice_receipt_date=receipt,
        complaint_filed_date=date(2026, 2, 28),
        current_date=date(2026, 2, 28),
    )
    assert res["filing_valid"] is True

    # Mar 1 should be invalid (expired)
    res_expired = ChequeBounceCalculator.calculate(
        cheque_date=cheque,
        dishonour_date=dishonour,
        notice_date=notice,
        notice_receipt_date=receipt,
        complaint_filed_date=date(2026, 3, 1),
        current_date=date(2026, 3, 1),
    )
    assert res_expired["filing_valid"] is False


def test_cheque_bounce_dynamic_filing_window():
    # Test during a 31-day month (e.g. March)
    cheque = date(2026, 3, 1)
    dishonour = date(2026, 3, 5)
    notice = date(2026, 3, 10)
    receipt = date(2026, 3, 12)
    # wait_end_date is March 27.
    # filing_deadline is wait_end_date + relativedelta(months=1) which is April 27.
    # total_window_days = (April 27 - March 12) = 46 days.
    # If now is April 12, days_since_receipt = 31 days.
    res = ChequeBounceCalculator.calculate(
        cheque_date=cheque,
        dishonour_date=dishonour,
        notice_date=notice,
        notice_receipt_date=receipt,
        current_date=date(2026, 4, 12),
    )
    # total_window_days = 46. days_left = 46 - 31 = 15 days.
    assert "15 days remaining" in res["reason"]
