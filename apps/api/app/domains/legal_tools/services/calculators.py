"""
Legal Tools Calculators.
Contains separate calculator services for Cheque Bounce, RERA delays, and Summary Suits.
"""
from datetime import date, timedelta
from typing import Optional, Any
from app.domains.legal_tools.services.interest import InterestSource


class ChequeBounceCalculator:
    @staticmethod
    def calculate(
        cheque_date: date,
        dishonour_date: date,
        notice_date: Optional[date] = None,
        notice_receipt_date: Optional[date] = None,
        complaint_filed_date: Optional[date] = None,
        current_date: Optional[date] = None
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
            raise ValueError("Notice receipt date cannot be earlier than notice sent date")
        if complaint_filed_date and notice_receipt_date and complaint_filed_date < notice_receipt_date:
            raise ValueError("Complaint filing date cannot be earlier than notice receipt date")

        now = current_date or date.today()

        # 2. Presentation limit (Must be within 3 months)
        # NI Act specifies 3 months. We use a strict calendar calculation using relativedelta.
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
            filing_deadline = wait_end_date + timedelta(days=30)
            
            if complaint_filed_date:
                filing_valid = filing_start_date <= complaint_filed_date <= filing_deadline

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
            notice_due = dishonour_date + timedelta(days=30)
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
                elif 15 < days_since_receipt <= 45:
                    days_left = 45 - days_since_receipt
                    status = "action_required"
                    color = "yellow"
                    reason = f"Filing window active! File complaint in court before {filing_deadline} ({days_left} days remaining)."
                else:
                    status = "expired"
                    reason = f"Filing deadline ({filing_deadline}) has passed. File delay condonation application (Sec 142 NI Act)."
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
            "color": color
        }


class RERACalculator:
    @staticmethod
    def calculate(
        total_paid_amount: float,
        promised_possession_date: date,
        actual_possession_date: Optional[date] = None,
        custom_interest_rate: Optional[float] = None,
        current_date: Optional[date] = None
    ) -> dict[str, Any]:
        """
        Calculates delayed possession interest (SBI MCLR + 2% per annum) under RERA 2016.
        """
        if total_paid_amount <= 0:
            raise ValueError("Total paid amount must be greater than zero")

        end_date = actual_possession_date or current_date or date.today()
        
        if end_date < promised_possession_date:
            # Not delayed yet
            return {
                "delay_days": 0,
                "interest_rate": 0.0,
                "interest_accrued": 0.0,
                "total_claim": total_paid_amount,
                "status": "safe",
                "reason": "Project promised possession date has not yet been reached.",
                "color": "green"
            }

        delay_days = (end_date - promised_possession_date).days
        
        # Fetch dynamic rate via InterestSource
        rate_percent = InterestSource.get_rera_rate(custom_rate=custom_interest_rate)
        
        # Simple interest formula per annum: P * R * T
        time_years = delay_days / 365.0
        interest_accrued = total_paid_amount * (rate_percent / 100.0) * time_years

        # Round amounts
        interest_accrued = round(interest_accrued, 2)
        total_claim = round(total_paid_amount + interest_accrued, 2)

        return {
            "delay_days": delay_days,
            "interest_rate": rate_percent,
            "interest_accrued": interest_accrued,
            "total_claim": total_claim,
            "status": "action_required" if delay_days > 0 else "safe",
            "reason": f"Possession is delayed by {delay_days} days. Builder owes ₹{interest_accrued:,.2f} in interest.",
            "color": "yellow" if delay_days > 0 else "green"
        }


class SummarySuitCalculator:
    @staticmethod
    def calculate(
        claim_amount: float,
        due_date: date,
        state: str = "default",
        current_date: Optional[date] = None
    ) -> dict[str, Any]:
        """
        Checks 3-year civil recovery limitations and estimates court fees under Order 37 CPC.
        """
        if claim_amount <= 0:
            raise ValueError("Claim amount must be greater than zero")

        now = current_date or date.today()

        # 1. Limitation Check (3 years from due date)
        # A leap year safe calculation adds 3 years
        try:
            limitation_expiry = due_date.replace(year=due_date.year + 3)
        except ValueError:
            # Handles Feb 29 leap day edge case
            limitation_expiry = due_date + timedelta(days=3*365 + 1)
            
        days_left = (limitation_expiry - now).days

        status = "safe"
        color = "green"
        reason = f"Active limitation. Suit must be filed before {limitation_expiry} ({days_left} days remaining)."

        if days_left < 0:
            status = "expired"
            color = "red"
            reason = f"Limitation period expired on {limitation_expiry}. Suit time-barred."
        elif days_left <= 30:
            status = "action_required"
            color = "yellow"
            reason = f"Action required: Limitation expiring soon! File before {limitation_expiry} ({days_left} days remaining)."

        # 2. Court Fees Calculation
        court_fee = 0.0
        state_cleaned = state.strip().lower()

        if state_cleaned == "delhi":
            if claim_amount <= 20000:
                court_fee = 1000.0
            elif claim_amount <= 50000:
                court_fee = 1000.0 + (claim_amount - 20000) * 0.025
            elif claim_amount <= 2000000:
                court_fee = 1750.0 + (claim_amount - 50000) * 0.015
            else:
                court_fee = 31000.0 + (claim_amount - 2000000) * 0.01
        elif state_cleaned == "maharashtra":
            # Maharashtra Court Fees Act Schedule
            if claim_amount <= 10000:
                court_fee = 200.0
            elif claim_amount <= 50000:
                court_fee = 200.0 + (claim_amount - 10000) * 0.02
            elif claim_amount <= 1000000:
                court_fee = 1000.0 + (claim_amount - 50000) * 0.01
            else:
                # Capped at 3,00,000 INR
                fee = 10500.0 + (claim_amount - 1000000) * 0.005
                court_fee = min(300000.0, fee)
        else:
            # Default fallback 1.5%, min 1000
            court_fee = max(1000.0, claim_amount * 0.015)

        court_fee = round(court_fee, 2)
        fee_note = "Court fees are estimated at a default of 1.5% for states outside Delhi and Maharashtra." if state_cleaned not in ("delhi", "maharashtra") else None

        return {
            "limitation_expiry": str(limitation_expiry),
            "days_remaining": days_left,
            "court_fee": court_fee,
            "fee_note": fee_note,
            "status": status,
            "reason": reason,
            "color": color
        }
