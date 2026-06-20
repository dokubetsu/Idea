"""
Interest Source Service.
Abstracts interest rate definitions and calculations (e.g. SBI MCLR base rates).
"""
from typing import Optional


class InterestSource:
    DEFAULT_SBI_MCLR = 8.5  # Standard base rate in percentage

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
