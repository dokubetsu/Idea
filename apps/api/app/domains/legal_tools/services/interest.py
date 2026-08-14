"""
Interest Source Service.
Abstracts interest rate definitions (SBI MCLR base rates) for RERA etc.

Priority for MCLR:
  1. settings.SBI_MCLR_RATE env override (ops can set monthly without redeploy)
  2. Optional live fetch from SBI_MCLR_FETCH_URL (JSON {"rate": 9.0, "as_of": "YYYY-MM-DD"})
  3. Hardcoded DEFAULT_SBI_MCLR fallback

Source reference: https://homeloans.sbi/resources/pages/mclr
"""

from __future__ import annotations

import logging
from datetime import date, datetime

log = logging.getLogger(__name__)


class InterestSource:
    # Fallback when no env / feed is configured
    DEFAULT_SBI_MCLR = 9.0  # percent per annum
    MCLR_LAST_UPDATED = date(2026, 7, 1)
    STALE_AFTER_DAYS = 35

    _cached_rate: float | None = None
    _cached_as_of: date | None = None

    @classmethod
    def mclr_is_stale(cls, as_of: date | None = None) -> bool:
        ref = as_of or cls.MCLR_LAST_UPDATED
        return (date.today() - ref).days > cls.STALE_AFTER_DAYS

    @classmethod
    def get_sbi_mclr(cls, *, force_refresh: bool = False) -> dict:
        """
        Resolve current SBI 1-year MCLR.

        Returns dict: rate, as_of (ISO date), source, stale (bool)
        """
        from app.config import settings

        # 1. Explicit env override
        if settings.SBI_MCLR_RATE is not None and settings.SBI_MCLR_RATE > 0:
            as_of = date.today()
            if settings.SBI_MCLR_AS_OF:
                try:
                    as_of = date.fromisoformat(settings.SBI_MCLR_AS_OF)
                except ValueError:
                    pass
            return {
                "rate": float(settings.SBI_MCLR_RATE),
                "as_of": as_of.isoformat(),
                "source": "env",
                "stale": cls.mclr_is_stale(as_of),
                "rera_statutory_rate": float(settings.SBI_MCLR_RATE) + 2.0,
            }

        # 2. Live / file feed
        if settings.SBI_MCLR_FETCH_URL and (force_refresh or cls._cached_rate is None):
            try:
                cls._fetch_and_cache(settings.SBI_MCLR_FETCH_URL)
            except Exception as e:
                log.warning("MCLR fetch failed, using fallback: %s", e)

        if cls._cached_rate is not None and cls._cached_as_of is not None:
            return {
                "rate": cls._cached_rate,
                "as_of": cls._cached_as_of.isoformat(),
                "source": "feed",
                "stale": cls.mclr_is_stale(cls._cached_as_of),
                "rera_statutory_rate": cls._cached_rate + 2.0,
            }

        # 3. Hardcoded default
        return {
            "rate": cls.DEFAULT_SBI_MCLR,
            "as_of": cls.MCLR_LAST_UPDATED.isoformat(),
            "source": "default",
            "stale": cls.mclr_is_stale(cls.MCLR_LAST_UPDATED),
            "rera_statutory_rate": cls.DEFAULT_SBI_MCLR + 2.0,
        }

    @classmethod
    def _fetch_and_cache(cls, url: str) -> None:
        """
        Expect JSON: {"rate": 8.95, "as_of": "2026-07-01"}
        or {"mclr": 8.95, "effective_date": "2026-07-01"}
        """
        import httpx

        with httpx.Client(timeout=8.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()

        rate = data.get("rate", data.get("mclr"))
        as_of_raw = data.get("as_of", data.get("effective_date"))
        if rate is None:
            raise ValueError("MCLR feed missing rate")
        rate_f = float(rate)
        if rate_f <= 0 or rate_f > 30:
            raise ValueError(f"MCLR rate out of range: {rate_f}")

        as_of = date.today()
        if as_of_raw:
            if isinstance(as_of_raw, str):
                as_of = date.fromisoformat(as_of_raw[:10])
            elif isinstance(as_of_raw, datetime):
                as_of = as_of_raw.date()

        cls._cached_rate = rate_f
        cls._cached_as_of = as_of
        log.info("MCLR cache updated: %s%% as of %s", rate_f, as_of)

    @classmethod
    def get_rera_rate(cls, custom_rate: float | None = None) -> float:
        """
        Statutory RERA interest: SBI MCLR + 2.0% p.a. (or custom override).
        """
        if custom_rate is not None:
            if custom_rate < 0:
                raise ValueError("Interest rate cannot be negative")
            return custom_rate

        info = cls.get_sbi_mclr()
        return float(info["rera_statutory_rate"])
