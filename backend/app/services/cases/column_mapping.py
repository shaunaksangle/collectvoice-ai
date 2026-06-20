from __future__ import annotations

from dataclasses import dataclass
import re

COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "customer_name": ("customer_name", "name", "borrower_name"),
    "phone_number": ("phone", "mobile", "mobile_number", "contact_number", "phone_number"),
    "case_reference": ("case_id", "case_reference", "loan_id", "account_number", "agreement_id"),
    "lender_name": ("lender", "lender_name", "bank", "nbfc", "client"),
    "outstanding_amount": ("outstanding", "outstanding_amount", "due_amount", "pending_amount", "amount_due"),
    "emi_amount": ("emi", "emi_amount", "installment_amount"),
    "due_date": ("due_date", "payment_due_date", "emi_due_date"),
    "dpd": ("dpd", "days_past_due", "overdue_days"),
    "priority": ("priority", "risk", "risk_level"),
    "assigned_agent": ("agent", "assigned_agent", "collector"),
    "status": ("status", "case_status"),
    "city": ("city", "location"),
    "state": ("state",),
    "email": ("email", "email_id"),
    "alternate_phone": ("alternate_phone", "alt_phone", "secondary_mobile"),
}


@dataclass(frozen=True)
class UploadColumnMapping:
    original_to_field: dict[str, str]
    field_to_originals: dict[str, list[str]]


def normalize_column_name(value: object) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def build_upload_column_mapping(headers: list[str]) -> UploadColumnMapping:
    alias_lookup = {
        normalize_column_name(alias): field
        for field, aliases in COLUMN_ALIASES.items()
        for alias in aliases
    }

    original_to_field: dict[str, str] = {}
    field_to_originals: dict[str, list[str]] = {}

    for header in headers:
        normalized_header = normalize_column_name(header)
        field = alias_lookup.get(normalized_header)
        if field is None:
            continue

        original_to_field[header] = field
        field_to_originals.setdefault(field, []).append(header)

    return UploadColumnMapping(
        original_to_field=original_to_field,
        field_to_originals=field_to_originals,
    )
