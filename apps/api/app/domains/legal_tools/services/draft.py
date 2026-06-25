"""
Document Draft Service.
Compiles matter facts into standard legal drafts (Vakalatnama, 138 Notice, RERA Form M).
"""
from datetime import date
from typing import Optional, Any
from app.shared.database import get_db
from app.shared.exceptions import NotFound, Forbidden


# ── Templates ─────────────────────────────────────────────────────────

_VAKALATNAMA_TEMPLATE = """
# VAKALATNAMA
**IN THE COURT OF COMPONENT AUTHORITY / JUDICIAL MAGISTRATE / FORUM**

**In the matter of:**
**Complainant / Petitioner:** {client_name}
**Versus**
**Respondent / Defendant:** {opponent_name}

**Case/Matter Category:** {category}
**Matter Reference:** {matter_title} (ID: {matter_id})

---

Know all men by these presents that I/We, the undersigned Complainant/Petitioner, do hereby appoint, nominate, and constitute:

**Advocate Name:** {lawyer_name}
**Bar Council Number:** {bar_council_number}
**Office Address:** {lawyer_address}

as my/our true and lawful Advocate/Attorney to appear, plead, act, and conduct on my/our behalf in the above-mentioned matter/court, to file documents, compromise, sign petitions, and do all such acts necessary for the conduct of the case.

I/We hereby ratify and confirm all acts done by the said Advocate as if done by me/us personally.

**Signed and Delivered on this {day} day of {month}, {year}.**

**Signature of Complainant(s):** 
___________________________
({client_name})

**Accepted by me:**
___________________________
Advocate ({lawyer_name})
""".strip()

_NOTICE_138_TEMPLATE = """
# LEGAL NOTICE (SECTION 138 NI ACT)

**Date:** {notice_date}

**To,**
**Name:** {opponent_name}
**Address:** {opponent_address}

**SUBJECT: LEGAL NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 FOR DISHONOUR OF CHEQUE NO. {cheque_number} FOR ₹{cheque_amount:,}**

Dear Sir/Madam,

Under instructions from and on behalf of my client, **{client_name}** residing at **{client_address}**, I hereby serve you with this Legal Notice under Section 138 of the Negotiable Instruments Act, 1881:

1. That you issued a Cheque bearing No. **{cheque_number}** dated **{cheque_date}** for a sum of **₹{cheque_amount:,}** drawn on **{bank_name}** in favour of my client towards the discharge of your legally enforceable debt and liability (Nature of debt: *{debt_type}*).

2. That my client presented the said cheque for clearance within its validity period. However, the cheque was returned unpaid by the bank on **{dishonour_date}** with the return memo stating reason: **"{dishonour_reason}"**.

3. That my client immediately notified you of the dishonour, but you have failed to make payments due under the cheque.

4. I, therefore, by means of this legal notice, call upon you to pay the entire cheque amount of **₹{cheque_amount:,}** to my client within **15 days** of the receipt of this notice.

5. Please note that if you fail to pay the said sum within 15 days, my client will be constrained to initiate criminal proceedings against you under Section 138 of the Negotiable Instruments Act, 1881, in the competent court of law, entirely at your risk and consequence.

Sincerely,

___________________________
**Advocate {lawyer_name}**
(Bar Council No: {bar_council_number})
Office: {lawyer_address}
""".strip()

_RERA_FORM_M_TEMPLATE = """
# COMPLAINT TO REGULATORY AUTHORITY (FORM M)
**BEFORE THE REAL ESTATE REGULATORY AUTHORITY, STATE OF {state}**

**Between:**
**Complainant:** {client_name} (Address: {client_address})
**And**
**Respondent:** {opponent_name} (Address: {opponent_address})

---

### 1. Particulars of the Complainant:
- **Name:** {client_name}
- **Contact:** Registered with lead.ai

### 2. Particulars of the Respondent (Builder / Promoter):
- **Name:** {opponent_name}
- **Project Name:** {project_name}

### 3. Facts of the Case:
- That the Complainant booked a unit bearing Flat No. **{flat_number}** in the housing project **"{project_name}"** promoted by the Respondent builder.
- That the Complainant has paid a total sum of **₹{total_paid:,}** to the builder till date.
- That as per the Agreement for Sale, the promised possession date was **{promised_date}**.
- That the Respondent promoter has failed to deliver possession of the said unit, resulting in a delay of **{delay_days} days** as of today.

### 4. Relief Sought:
- Directions to the Respondent promoter to pay interest on delayed possession at the statutory rate (SBI MCLR + 2% per annum, computed at **{interest_rate}%**) amounting to **₹{interest_accrued:,}**.
- In the alternative, refund of the entire paid amount of **₹{total_paid:,}** along with interest.

**Verification:**
I, {client_name}, Complainant, do hereby verify that the contents of paragraphs 1 to 4 are true and correct to the best of my knowledge.

**Date:** {today_date}
**Place:** {client_city}

___________________________
**Signature of Complainant**
""".strip()


class DocumentDraftService:
    @staticmethod
    def generate(matter_id: str, document_type: str, current_user: Any) -> dict[str, Any]:
        """
        Retrieves matter and verified facts, merges them into templates, and returns the markdown draft.
        """
        db = get_db()

        # 1. Fetch Matter details
        m_res = db.table("matters").select("*, profiles!user_id(full_name, city, state)").eq("id", matter_id).execute()
        if not m_res.data:
            raise NotFound("Matter")
        matter = m_res.data[0]

        # Enforce authorization (CR-5)
        is_owner = matter.get("user_id") == current_user.id
        is_lawyer = matter.get("lawyer_id") == current_user.id
        is_admin = getattr(current_user, "role", None) == "admin"
        if not (is_owner or is_lawyer or is_admin):
            raise Forbidden("You are not authorized to view document drafts for this matter.")

        client_profile = matter.pop("profiles", {}) or {}

        lawyer_name = "[Advocate Name]"
        bar_council = "[Bar Council Registration Number]"
        lawyer_address = "[Advocate Office Address]"
        if matter.get("lawyer_id"):
            l_res = db.table("profiles").select("full_name, city, state").eq("id", matter["lawyer_id"]).execute()
            if l_res.data:
                lawyer_name = l_res.data[0]["full_name"]
                city = l_res.data[0].get("city")
                state = l_res.data[0].get("state")
                if city and state:
                    lawyer_address = f"{city}, {state}"
                elif city or state:
                    lawyer_address = city or state
            lp_res = db.table("lawyer_profiles").select("bar_council_id").eq("id", matter["lawyer_id"]).execute()
            if lp_res.data:
                bar_council = lp_res.data[0].get("bar_council_id") or bar_council

        # 3. Fetch Matter Facts
        f_res = db.table("facts").select("key, value").eq("matter_id", matter_id).execute()
        
        def _escape(val: str) -> str:
            return str(val).replace("{", "{{").replace("}", "}}")
            
        facts_dict = {f["key"]: _escape(f["value"]) for f in f_res.data} if f_res.data else {}

        # 4. Process variables for templates
        today = date.today()
        client_name = client_profile.get("full_name") or "[Client Name]"
        client_city = client_profile.get("city") or "[City]"
        client_state = client_profile.get("state") or "[State]"
        client_address = f"{client_city}, {client_state}"

        opponent_name = facts_dict.get("opponent_name") or facts_dict.get("builder_name") or "[Opponent Name]"
        opponent_address = facts_dict.get("property_location") or "[Opponent Address]"

        # Generate Vakalatnama
        if document_type == "vakalatnama":
            draft = _VAKALATNAMA_TEMPLATE.format(
                client_name=client_name,
                opponent_name=opponent_name,
                category=matter["category"].replace("_", " ").title(),
                matter_title=matter["title"],
                matter_id=matter_id,
                lawyer_name=lawyer_name,
                bar_council_number=bar_council,
                lawyer_address=lawyer_address,
                day=today.strftime("%d"),
                month=today.strftime("%B"),
                year=today.strftime("%Y")
            )
        
        # Generate Notice 138 (Cheque Bounce)
        elif document_type == "legal_notice_138":
            try:
                cheque_amount = float(facts_dict.get("cheque_amount", "0"))
            except ValueError:
                cheque_amount = 0.0

            draft = _NOTICE_138_TEMPLATE.format(
                notice_date=facts_dict.get("notice_date") or today.isoformat(),
                opponent_name=opponent_name,
                opponent_address=opponent_address,
                cheque_number=facts_dict.get("cheque_number") or "[Cheque Number]",
                cheque_amount=cheque_amount,
                cheque_date=facts_dict.get("cheque_date") or "[Cheque Date]",
                bank_name=facts_dict.get("bank_name") or "[Bank Name]",
                client_name=client_name,
                client_address=client_address,
                debt_type=facts_dict.get("underlying_debt_type") or "outstanding legal dues",
                dishonour_date=facts_dict.get("dishonour_date") or "[Dishonour Date]",
                dishonour_reason=facts_dict.get("dishonour_reason") or "Funds Insufficient",
                lawyer_name=lawyer_name,
                bar_council_number=bar_council,
                lawyer_address=lawyer_address
            )
            
        # Generate RERA Form M
        elif document_type == "rera_complaint_form_m":
            try:
                total_paid = float(facts_dict.get("total_paid_amount", "0"))
            except ValueError:
                total_paid = 0.0

            # Calculate RERA delayed interest metrics using RERACalculator
            from app.domains.legal_tools.services.calculators import RERACalculator
            promised_date_str = facts_dict.get("promised_possession_date")
            delay_days = 0
            interest_rate = 10.5
            interest_accrued = 0.0
            
            if promised_date_str:
                try:
                    promised_date = date.fromisoformat(promised_date_str)
                    calc_res = RERACalculator.calculate(
                        total_paid_amount=total_paid if total_paid > 0 else 1.0,
                        promised_possession_date=promised_date
                    )
                    delay_days = calc_res["delay_days"]
                    interest_rate = calc_res["interest_rate"]
                    interest_accrued = calc_res["interest_accrued"] if total_paid > 0 else 0.0
                except Exception:
                    pass

            draft = _RERA_FORM_M_TEMPLATE.format(
                state=client_state.upper(),
                client_name=client_name,
                client_address=client_address,
                opponent_name=opponent_name,
                opponent_address=opponent_address,
                project_name=facts_dict.get("project_name") or "[Project Name]",
                flat_number=facts_dict.get("flat_number") or "[Flat Number]",
                total_paid=total_paid,
                promised_date=promised_date_str or "[Promised Possession Date]",
                delay_days=delay_days,
                interest_rate=interest_rate,
                interest_accrued=interest_accrued,
                today_date=today.isoformat(),
                client_city=client_city
            )
        else:
            raise ValueError(f"Unsupported document type: {document_type}")

        return {
            "matter_id": matter_id,
            "document_type": document_type,
            "title": document_type.replace("_", " ").title(),
            "draft_content": draft
        }
