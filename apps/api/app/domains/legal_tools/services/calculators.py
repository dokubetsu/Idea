"""
Legal Tools Calculators.
Contains separate calculator services for Cheque Bounce, RERA delays, and Summary Suits.
"""

from datetime import date, timedelta
from typing import Optional, Any
from decimal import Decimal
from app.domains.legal_tools.services.interest import InterestSource
from app.shared.court_calendar import next_working_day


class ChequeBounceCalculator:
    @staticmethod
    def calculate(
        cheque_date: date,
        dishonour_date: date,
        notice_date: Optional[date] = None,
        notice_receipt_date: Optional[date] = None,
        complaint_filed_date: Optional[date] = None,
        current_date: Optional[date] = None,
    ) -> dict[str, Any]:
        """
        Calculates timelines and limitation periods under Section 138 of the Negotiable Instruments Act.
        """
        # 1. Validation checks
        if dishonour_date < cheque_date:
            raise ValueError("Dishonour date cannot be earlier than cheque date")
        if notice_date and notice_date < dishonour_date:
            raise ValueError("Notice date cannot be earlier than dishonour date")
        if notice_receipt_date and notice_date and notice_receipt_date < notice_date:
            raise ValueError(
                "Notice receipt date cannot be earlier than notice sent date"
            )
        if (
            complaint_filed_date
            and notice_receipt_date
            and complaint_filed_date < notice_receipt_date
        ):
            raise ValueError(
                "Complaint filing date cannot be earlier than notice receipt date"
            )

        now = current_date or date.today()

        # 2. Presentation limit (Must be within 3 months)
        from dateutil.relativedelta import relativedelta

        presentation_deadline = cheque_date + relativedelta(months=3)
        presentation_days = (dishonour_date - cheque_date).days
        presentation_valid = dishonour_date <= presentation_deadline

        # 3. Notice limit (Must be sent within 30 days of dishonour)
        notice_days = None
        notice_valid = None
        if notice_date:
            notice_days = (notice_date - dishonour_date).days
            notice_valid = notice_days <= 30

        # 4. Wait period & Filing window (15-day grace period, 30-day filing window)
        wait_end_date = None
        filing_start_date = None
        filing_deadline = None
        filing_valid = None

        if notice_receipt_date:
            wait_end_date = notice_receipt_date + timedelta(days=15)
            filing_start_date = wait_end_date + timedelta(days=1)
            raw_deadline = wait_end_date + relativedelta(months=1)
            filing_deadline = next_working_day(raw_deadline)

            if complaint_filed_date:
                filing_valid = (
                    filing_start_date <= complaint_filed_date <= filing_deadline
                )

        # 5. Determine status and colors
        status = "safe"
        reason = "Awaiting notice tracking"
        color = "green"

        if not presentation_valid:
            status = "expired"
            reason = f"Cheque presented to bank on {dishonour_date}, which is after the 3-month presentation deadline ({presentation_deadline})."
            color = "red"
        elif notice_date and not notice_valid:
            status = "expired"
            reason = f"Legal notice was sent {notice_days} days after dishonour (maximum allowed: 30 days)."
            color = "red"
        elif not notice_date:
            # Notice not sent yet
            raw_notice_due = dishonour_date + timedelta(days=30)
            notice_due = next_working_day(raw_notice_due)
            days_left = (notice_due - now).days
            if days_left < 0:
                status = "expired"
                reason = f"Notice sending deadline ({notice_due}) has passed. Limitation expired."
                color = "red"
            elif days_left <= 7:
                status = "action_required"
                reason = f"Action required: Notice deadline is close. Send notice before {notice_due} ({days_left} days remaining)."
                color = "yellow"
            else:
                status = "safe"
                reason = f"Prepare legal notice. Deadline to send notice is {notice_due} ({days_left} days remaining)."
                color = "green"
        elif notice_date and not notice_receipt_date:
            # Notice sent, check if too much time has passed
            notice_max_wait = notice_date + timedelta(days=30)
            if now > notice_max_wait:
                status = "action_required"
                reason = "Notice sent but delivery receipt date not recorded. Confirm receipt date to calculate wait window."
                color = "yellow"
            else:
                status = "safe"
                reason = "Notice sent. Confirm delivery/receipt date to trigger grace period timer."
                color = "green"
        elif notice_receipt_date:
            days_since_receipt = (now - notice_receipt_date).days
            total_window_days = (filing_deadline - notice_receipt_date).days

            if complaint_filed_date:
                if filing_valid:
                    status = "safe"
                    reason = f"Complaint filed successfully on {complaint_filed_date} within the statutory window."
                    color = "green"
                else:
                    status = "expired"
                    reason = f"Complaint was filed outside the statutory window (required: {filing_start_date} to {filing_deadline})."
                    color = "red"
            else:
                if days_since_receipt <= 15:
                    status = "safe"
                    days_left = 15 - days_since_receipt
                    status = "action_required" if days_left <= 3 else "safe"
                    color = "yellow" if days_left <= 3 else "green"
                    reason = f"Grace period active. Complainant must wait {days_left} more days (grace ends {wait_end_date})."
                elif 15 < days_since_receipt <= total_window_days:
                    days_left = total_window_days - days_since_receipt
                    status = "action_required"
                    color = "yellow"
                    reason = f"Filing window active! File complaint in court before {filing_deadline} ({days_left} days remaining)."
                else:
                    status = "expired"
                    reason = f"Filing deadline ({filing_deadline}) has passed. File delay condonation application under Section 5 of the Limitation Act, 1963."
                    color = "red"

        return {
            "presentation_days": presentation_days,
            "presentation_valid": presentation_valid,
            "presentation_deadline": str(presentation_deadline),
            "notice_days": notice_days,
            "notice_valid": notice_valid,
            "wait_end_date": str(wait_end_date) if wait_end_date else None,
            "filing_start_date": str(filing_start_date) if filing_start_date else None,
            "filing_deadline": str(filing_deadline) if filing_deadline else None,
            "filing_valid": filing_valid,
            "status": status,
            "reason": reason,
            "color": color,
        }


class RERACalculator:
    @staticmethod
    def calculate(
        total_paid_amount: Optional[float],
        promised_possession_date: date,
        actual_possession_date: Optional[date] = None,
        custom_interest_rate: Optional[float] = None,
        current_date: Optional[date] = None,
        installments: Optional[list[dict]] = None,
    ) -> dict[str, Any]:
        """
        Calculates delayed possession interest (SBI MCLR + 2% per annum) under RERA 2016.
        """
        end_date = actual_possession_date or current_date or date.today()

        if end_date < promised_possession_date:
            amount = total_paid_amount or 0.0
            if installments:
                amount = sum(inst["amount"] for inst in installments)
            return {
                "delay_days": 0,
                "interest_rate": 0.0,
                "interest_accrued": 0.0,
                "total_claim": float(amount),
                "status": "safe",
                "reason": "Project promised possession date has not yet been reached.",
                "color": "green",
            }

        delay_days = (end_date - promised_possession_date).days

        # Fetch dynamic rate via InterestSource
        rate_percent = InterestSource.get_rera_rate(custom_rate=custom_interest_rate)
        rate_decimal = Decimal(str(rate_percent)) / Decimal("100.0")

        # Compile installments list
        if installments:
            inst_list = installments
        else:
            if not total_paid_amount or total_paid_amount <= 0:
                raise ValueError("Total paid amount must be greater than zero")
            inst_list = [
                {"amount": total_paid_amount, "paid_date": promised_possession_date}
            ]

        total_paid = Decimal("0.0")
        total_interest = Decimal("0.0")

        for inst in inst_list:
            amt = Decimal(str(inst["amount"]))
            paid_d = inst["paid_date"]
            if isinstance(paid_d, str):
                paid_d = date.fromisoformat(paid_d)

            d_start = max(promised_possession_date, paid_d)
            inst_delay = (end_date - d_start).days
            if inst_delay < 0:
                inst_delay = 0

            # Interest: Principal * rate * (delay_days / days_in_year)
            days_in_year = (
                Decimal("365.25") if installments is not None else Decimal("365.0")
            )
            inst_interest = amt * rate_decimal * (Decimal(inst_delay) / days_in_year)
            total_interest += inst_interest
            total_paid += amt

        # Round amounts
        total_interest_rounded = round(total_interest, 2)
        total_claim_rounded = round(total_paid + total_interest_rounded, 2)

        return {
            "delay_days": delay_days,
            "interest_rate": rate_percent,
            "interest_accrued": float(total_interest_rounded),
            "total_claim": float(total_claim_rounded),
            "status": "action_required" if delay_days > 0 else "safe",
            "reason": f"Possession is delayed by {delay_days} days. Builder owes ₹{float(total_interest_rounded):,.2f} in interest.",
            "color": "yellow" if delay_days > 0 else "green",
            "mclr_rate_is_stale": InterestSource.mclr_is_stale(),
            "mclr_last_updated": str(InterestSource.MCLR_LAST_UPDATED),
        }


class SummarySuitCalculator:
    @staticmethod
    def calculate(
        claim_amount: float,
        due_date: date,
        state: str = "default",
        current_date: Optional[date] = None,
    ) -> dict[str, Any]:
        """
        Checks 3-year civil recovery limitations and estimates court fees under Order 37 CPC.
        """
        if claim_amount <= 0:
            raise ValueError("Claim amount must be greater than zero")

        now = current_date or date.today()

        # 1. Limitation Check (3 years from due date)
        from dateutil.relativedelta import relativedelta

        raw_limitation_expiry = due_date + relativedelta(years=3)
        limitation_expiry = next_working_day(raw_limitation_expiry)

        days_left = (limitation_expiry - now).days

        status = "safe"
        color = "green"
        reason = f"Active limitation. Suit must be filed before {limitation_expiry} ({days_left} days remaining)."

        if days_left < 0:
            status = "expired"
            color = "red"
            reason = (
                f"Limitation period expired on {limitation_expiry}. Suit time-barred."
            )
        elif days_left <= 30:
            status = "action_required"
            color = "yellow"
            reason = f"Action required: Limitation expiring soon! File before {limitation_expiry} ({days_left} days remaining)."

        # 2. Court Fees Calculation using Decimal
        claim_dec = Decimal(str(claim_amount))
        court_fee_dec = Decimal("0.0")
        state_cleaned = state.strip().lower()

        if state_cleaned == "delhi":
            if claim_dec <= Decimal("20000"):
                court_fee_dec = Decimal("1000.0")
            elif claim_dec <= Decimal("50000"):
                court_fee_dec = Decimal("1000.0") + (
                    claim_dec - Decimal("20000")
                ) * Decimal("0.025")
            elif claim_dec <= Decimal("2000000"):
                court_fee_dec = Decimal("1750.0") + (
                    claim_dec - Decimal("50000")
                ) * Decimal("0.015")
            else:
                court_fee_dec = Decimal("31000.0") + (
                    claim_dec - Decimal("2000000")
                ) * Decimal("0.01")
        elif state_cleaned == "maharashtra":
            if claim_dec <= Decimal("10000"):
                court_fee_dec = Decimal("200.0")
            elif claim_dec <= Decimal("50000"):
                court_fee_dec = Decimal("200.0") + (
                    claim_dec - Decimal("10000")
                ) * Decimal("0.02")
            elif claim_dec <= Decimal("1000000"):
                court_fee_dec = Decimal("1000.0") + (
                    claim_dec - Decimal("50000")
                ) * Decimal("0.01")
            else:
                fee = Decimal("10500.0") + (claim_dec - Decimal("1000000")) * Decimal(
                    "0.005"
                )
                court_fee_dec = min(Decimal("300000.0"), fee)
        else:
            court_fee_dec = max(Decimal("1000.0"), claim_dec * Decimal("0.015"))

        court_fee = float(round(court_fee_dec, 2))
        fee_note = (
            "Court fees are estimated at a default of 1.5% for states outside Delhi and Maharashtra."
            if state_cleaned not in ("delhi", "maharashtra")
            else None
        )

        return {
            "limitation_expiry": str(limitation_expiry),
            "days_remaining": days_left,
            "court_fee": court_fee,
            "fee_note": fee_note,
            "status": status,
            "reason": reason,
            "color": color,
        }
