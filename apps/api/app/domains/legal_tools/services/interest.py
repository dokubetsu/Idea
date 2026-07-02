"""
Interest Source Service.
Abstracts interest rate definitions and calculations (e.g. SBI MCLR base rates).

H5 NOTE: SBI MCLR is published monthly by RBI. Update DEFAULT_SBI_MCLR and
MCLR_LAST_UPDATED whenever the rate changes to keep RERA interest calculations accurate.
Current rate source: https://homeloans.sbi/resources/pages/mclr
"""

from datetime import date
from typing import Optional


class InterestSource:
    # H5: SBI 1-year MCLR rate (as of the date below). Update this monthly.
    DEFAULT_SBI_MCLR = 9.0  # percent per annum
    MCLR_LAST_UPDATED = date(2026, 7, 1)  # date when this rate was last verified

    # Rate is considered stale if not updated within 35 days (MCLR is monthly)
    STALE_AFTER_DAYS = 35

    @classmethod
    def mclr_is_stale(cls) -> bool:
        """Returns True if the hardcoded MCLR rate has not been updated recently."""
        return (date.today() - cls.MCLR_LAST_UPDATED).days > cls.STALE_AFTER_DAYS

    @classmethod
    def get_rera_rate(cls, custom_rate: Optional[float] = None) -> float:
        """
        Computes the statutory RERA interest rate (SBI MCLR + 2.0% per annum).
        Allows overrides with custom rates.
        """
        if custom_rate is not None:
            if custom_rate < 0:
                raise ValueError("Interest rate cannot be negative")
            return custom_rate

        # Standard formula: SBI MCLR + 2%
        return cls.DEFAULT_SBI_MCLR + 2.0
