"""
Indian GST helpers for legal invoices (SAC 998211 — legal services).

Place of supply for services (typically recipient location under IGST Act s.12).
Tax split:
  - Intra-state: CGST 9% + SGST 9%
  - Inter-state: IGST 18%
"""

from __future__ import annotations
from dataclasses import dataclass

GST_RATE_PERCENT = 18.0
HALF_RATE = GST_RATE_PERCENT / 2.0

# Normalized state name → GST place-of-supply label (state name used on invoices)
STATE_PLACE_OF_SUPPLY: dict[str, str] = {
    "andhra pradesh": "Andhra Pradesh",
    "arunachal pradesh": "Arunachal Pradesh",
    "assam": "Assam",
    "bihar": "Bihar",
    "chhattisgarh": "Chhattisgarh",
    "goa": "Goa",
    "gujarat": "Gujarat",
    "haryana": "Haryana",
    "himachal pradesh": "Himachal Pradesh",
    "jharkhand": "Jharkhand",
    "karnataka": "Karnataka",
    "kerala": "Kerala",
    "madhya pradesh": "Madhya Pradesh",
    "maharashtra": "Maharashtra",
    "manipur": "Manipur",
    "meghalaya": "Meghalaya",
    "mizoram": "Mizoram",
    "nagaland": "Nagaland",
    "odisha": "Odisha",
    "orissa": "Odisha",
    "punjab": "Punjab",
    "rajasthan": "Rajasthan",
    "sikkim": "Sikkim",
    "tamil nadu": "Tamil Nadu",
    "telangana": "Telangana",
    "tripura": "Tripura",
    "uttar pradesh": "Uttar Pradesh",
    "uttarakhand": "Uttarakhand",
    "west bengal": "West Bengal",
    "delhi": "Delhi",
    "nct of delhi": "Delhi",
    "new delhi": "Delhi",
    "jammu and kashmir": "Jammu and Kashmir",
    "jammu & kashmir": "Jammu and Kashmir",
    "ladakh": "Ladakh",
    "chandigarh": "Chandigarh",
    "puducherry": "Puducherry",
    "pondicherry": "Puducherry",
    "andaman and nicobar islands": "Andaman and Nicobar Islands",
    "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "lakshadweep": "Lakshadweep",
}

# Default supplier (platform / firm) state when lawyer profile has no state
DEFAULT_SUPPLIER_STATE = "Delhi"
DEFAULT_GSTIN = "07LEADG1234A1Z5"  # placeholder demo GSTIN (Delhi series 07)


@dataclass(frozen=True)
class GstBreakdown:
    place_of_supply: str
    supplier_state: str
    is_inter_state: bool
    gst_percent: float
    cgst_amount_inr: float
    sgst_amount_inr: float
    igst_amount_inr: float
    gst_amount_inr: float
    total_inr: float
    gstin: str
    hsn_sac: str = "998211"


def normalize_state(state: str | None) -> str | None:
    if not state or not str(state).strip():
        return None
    key = str(state).strip().lower()
    return STATE_PLACE_OF_SUPPLY.get(key, str(state).strip().title())


def resolve_place_of_supply(
    *,
    client_state: str | None = None,
    lawyer_state: str | None = None,
    explicit: str | None = None,
) -> str:
    """Prefer explicit → client (recipient) → lawyer → default."""
    for candidate in (explicit, client_state, lawyer_state, DEFAULT_SUPPLIER_STATE):
        resolved = normalize_state(candidate)
        if resolved:
            return resolved
    return DEFAULT_SUPPLIER_STATE


def compute_gst(
    subtotal: float,
    *,
    place_of_supply: str,
    supplier_state: str | None = None,
    gstin: str | None = None,
) -> GstBreakdown:
    pos = normalize_state(place_of_supply) or DEFAULT_SUPPLIER_STATE
    supplier = normalize_state(supplier_state) or DEFAULT_SUPPLIER_STATE
    inter = pos.casefold() != supplier.casefold()
    sub = max(0.0, float(subtotal))
    total_gst = round(sub * GST_RATE_PERCENT / 100, 2)

    if inter:
        cgst = sgst = 0.0
        igst = total_gst
    else:
        cgst = round(sub * HALF_RATE / 100, 2)
        sgst = round(total_gst - cgst, 2)  # absorb rounding on SGST
        igst = 0.0

    total = round(sub + total_gst, 2)
    return GstBreakdown(
        place_of_supply=pos,
        supplier_state=supplier,
        is_inter_state=inter,
        gst_percent=GST_RATE_PERCENT,
        cgst_amount_inr=cgst,
        sgst_amount_inr=sgst,
        igst_amount_inr=igst,
        gst_amount_inr=total_gst,
        total_inr=total,
        gstin=gstin or DEFAULT_GSTIN,
    )
