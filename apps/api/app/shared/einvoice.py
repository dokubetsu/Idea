"""
E-invoice (IRP / NIC) scaffolding for Indian GST invoices.

Production NIC integration requires GST portal credentials and the
public/private API sandbox. This module:

  1. Builds a standard IRP payload from an invoice row
  2. Provides a pluggable provider (Mock by default, NIC stub when configured)
  3. Stores ack number, signed QR, status on invoices

Env:
  EINVOICE_PROVIDER=mock|nic
  EINVOICE_NIC_BASE_URL=https://...
  EINVOICE_NIC_USERNAME / EINVOICE_NIC_PASSWORD / EINVOICE_NIC_GSTIN
"""

from __future__ import annotations

import hashlib
import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger(__name__)


class EinvoiceResult:
    def __init__(
        self,
        *,
        status: str,
        irn: str | None = None,
        ack_no: str | None = None,
        ack_date: str | None = None,
        signed_qr: str | None = None,
        error: str | None = None,
        raw: dict | None = None,
    ):
        self.status = status
        self.irn = irn
        self.ack_no = ack_no
        self.ack_date = ack_date
        self.signed_qr = signed_qr
        self.error = error
        self.raw = raw or {}

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "irn": self.irn,
            "ack_no": self.ack_no,
            "ack_date": self.ack_date,
            "signed_qr": self.signed_qr,
            "error": self.error,
        }


def build_irp_payload(invoice: dict, *, seller: dict, buyer: dict) -> dict[str, Any]:
    """Construct a NIC-compatible-ish e-invoice document (simplified schema)."""
    return {
        "Version": "1.1",
        "TranDtls": {
            "TaxSch": "GST",
            "SupTyp": "B2B",
            "RegRev": "N",
            "IgstOnIntra": "N",
        },
        "DocDtls": {
            "Typ": "INV",
            "No": invoice.get("invoice_number"),
            "Dt": (invoice.get("created_at") or "")[:10]
            or datetime.now(timezone.utc).strftime("%d/%m/%Y"),
        },
        "SellerDtls": {
            "Gstin": seller.get("gstin") or invoice.get("gstin"),
            "LglNm": seller.get("name") or "LeAd Legal Services",
            "Addr1": seller.get("address") or "India",
            "Loc": seller.get("city") or invoice.get("supplier_state") or "Delhi",
            "Pin": seller.get("pin") or 110001,
            "Stcd": seller.get("state_code") or "07",
        },
        "BuyerDtls": {
            "Gstin": buyer.get("gstin") or "URP",
            "LglNm": buyer.get("name") or "Client",
            "Pos": invoice.get("place_of_supply") or "Delhi",
            "Addr1": buyer.get("address") or "India",
            "Loc": buyer.get("city") or invoice.get("place_of_supply") or "Delhi",
            "Pin": buyer.get("pin") or 110001,
            "Stcd": buyer.get("state_code") or "07",
        },
        "ItemList": [
            {
                "SlNo": "1",
                "PrdDesc": invoice.get("work_summary") or "Legal professional services",
                "HsnCd": invoice.get("hsn_sac") or "998211",
                "Qty": 1,
                "Unit": "OTH",
                "UnitPrice": float(invoice.get("subtotal_inr") or 0),
                "TotAmt": float(invoice.get("subtotal_inr") or 0),
                "AssAmt": float(invoice.get("subtotal_inr") or 0),
                "GstRt": float(invoice.get("gst_percent") or 18),
                "CgstAmt": float(invoice.get("cgst_amount_inr") or 0),
                "SgstAmt": float(invoice.get("sgst_amount_inr") or 0),
                "IgstAmt": float(invoice.get("igst_amount_inr") or 0),
                "TotItemVal": float(invoice.get("total_inr") or 0),
            }
        ],
        "ValDtls": {
            "AssVal": float(invoice.get("subtotal_inr") or 0),
            "CgstVal": float(invoice.get("cgst_amount_inr") or 0),
            "SgstVal": float(invoice.get("sgst_amount_inr") or 0),
            "IgstVal": float(invoice.get("igst_amount_inr") or 0),
            "TotInvVal": float(invoice.get("total_inr") or 0),
        },
    }


class BaseEinvoiceProvider(ABC):
    @abstractmethod
    async def generate(self, payload: dict) -> EinvoiceResult: ...

    @abstractmethod
    async def cancel(self, irn: str, reason: str) -> EinvoiceResult: ...


class MockEinvoiceProvider(BaseEinvoiceProvider):
    """Deterministic offline IRP mock for dev/CI."""

    async def generate(self, payload: dict) -> EinvoiceResult:
        doc_no = payload.get("DocDtls", {}).get("No") or "UNKNOWN"
        raw = json.dumps(payload, sort_keys=True)
        irn = hashlib.sha256(raw.encode()).hexdigest()
        ack = f"ACK{irn[:12].upper()}"
        qr = f"GST-EINVOICE-MOCK|{doc_no}|{irn[:16]}|{ack}"
        now = datetime.now(timezone.utc).isoformat()
        return EinvoiceResult(
            status="generated",
            irn=irn,
            ack_no=ack,
            ack_date=now,
            signed_qr=qr,
            raw={"provider": "mock", "payload_hash": irn[:16]},
        )

    async def cancel(self, irn: str, reason: str) -> EinvoiceResult:
        return EinvoiceResult(
            status="cancelled",
            irn=irn,
            error=None,
            raw={"provider": "mock", "reason": reason},
        )


class NicEinvoiceProvider(BaseEinvoiceProvider):
    """
    Skeleton NIC IRP client. Does not ship live credentials.
    Wire EINVOICE_NIC_* env vars and implement auth token exchange per NIC docs.
    """

    def __init__(self, base_url: str, username: str, password: str, gstin: str):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.gstin = gstin

    async def generate(self, payload: dict) -> EinvoiceResult:
        import httpx

        if not self.base_url or not self.username:
            return EinvoiceResult(
                status="failed",
                error="NIC e-invoice not configured (EINVOICE_NIC_BASE_URL / credentials)",
            )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Placeholder: real NIC flow requires auth token + signed request
                resp = await client.post(
                    f"{self.base_url}/invoice",
                    json=payload,
                    headers={"gstin": self.gstin},
                    auth=(self.username, self.password),
                )
                if resp.status_code >= 400:
                    return EinvoiceResult(
                        status="failed",
                        error=f"NIC HTTP {resp.status_code}: {resp.text[:300]}",
                    )
                data = resp.json()
                return EinvoiceResult(
                    status="generated",
                    irn=data.get("Irn") or data.get("irn"),
                    ack_no=data.get("AckNo") or data.get("ack_no"),
                    ack_date=data.get("AckDt") or data.get("ack_date"),
                    signed_qr=data.get("SignedQRCode") or data.get("signed_qr"),
                    raw=data,
                )
        except Exception as e:
            log.exception("NIC e-invoice generate failed")
            return EinvoiceResult(status="failed", error=str(e))

    async def cancel(self, irn: str, reason: str) -> EinvoiceResult:
        return EinvoiceResult(
            status="failed",
            irn=irn,
            error="NIC cancel not implemented in this skeleton — use portal or extend provider",
        )


def get_einvoice_provider() -> BaseEinvoiceProvider:
    from app.config import settings

    provider = (settings.EINVOICE_PROVIDER or "mock").lower()
    if provider == "nic":
        return NicEinvoiceProvider(
            base_url=settings.EINVOICE_NIC_BASE_URL,
            username=settings.EINVOICE_NIC_USERNAME,
            password=settings.EINVOICE_NIC_PASSWORD,
            gstin=settings.EINVOICE_NIC_GSTIN or settings.GST_SUPPLIER_GSTIN,
        )
    return MockEinvoiceProvider()


async def generate_einvoice_for_invoice(
    db, invoice: dict, *, seller: dict | None = None, buyer: dict | None = None
) -> dict:
    """Generate e-invoice and persist IRP fields on the invoice row."""
    provider = get_einvoice_provider()
    payload = build_irp_payload(invoice, seller=seller or {}, buyer=buyer or {})
    result = await provider.generate(payload)

    update = {
        "e_invoice_status": result.status,
        "e_invoice_ack_no": result.ack_no,
        "e_invoice_ack_date": result.ack_date,
        "e_invoice_signed_qr": result.signed_qr,
        "e_invoice_error": result.error,
    }
    if result.irn:
        update["irn"] = result.irn
    if result.signed_qr:
        update["qr_code_data"] = result.signed_qr

    db.table("invoices").update(update).eq("id", invoice["id"]).execute()
    return {**invoice, **update, **result.to_dict()}
