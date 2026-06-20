from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.case import Case
from app.models.customer import Customer
from app.services.cases.upload_parser import ParsedUpload
from app.services.cases.upload_validation import build_case_upload_preview


def commit_case_upload(db: Session, parsed_upload: ParsedUpload) -> dict[str, Any]:
    preview = build_case_upload_preview(parsed_upload)
    errors = list(preview["errors"])
    saved_cases: list[dict[str, str]] = []
    existing_case_references: list[str] = []

    valid_rows = [row for row in preview["preview_data"] if row.get("is_valid")]
    if not valid_rows:
        return _build_commit_response(
            preview=preview,
            saved_cases=saved_cases,
            existing_case_references=existing_case_references,
            errors=errors,
        )

    candidate_references = [_text(row.get("case_reference")) for row in valid_rows]
    candidate_references = [reference for reference in candidate_references if reference is not None]

    try:
        with db.begin():
            existing_references = set(
                db.scalars(
                    select(Case.external_reference).where(Case.external_reference.in_(candidate_references))
                ).all()
            )

            for row in valid_rows:
                case_reference = _text(row.get("case_reference"))
                if case_reference is None:
                    continue

                if case_reference in existing_references:
                    existing_case_references.append(case_reference)
                    continue

                try:
                    with db.begin_nested():
                        customer = _get_or_create_customer(db, row)
                        case = _build_case(customer=customer, row=row, case_reference=case_reference)
                        db.add(case)
                        db.flush()
                        saved_cases.append({"id": case.id, "case_reference": case.external_reference or case_reference})
                        existing_references.add(case_reference)
                except Exception as exc:  # noqa: BLE001
                    errors.append(
                        {
                            "row_number": int(row.get("row_number", 0)),
                            "field": "row",
                            "issue": f"could not save row: {exc.__class__.__name__}",
                            "original_value": case_reference,
                        }
                    )
    except SQLAlchemyError as exc:
        db.rollback()
        errors.append(
            {
                "row_number": 0,
                "field": "database",
                "issue": f"commit failed: {exc.__class__.__name__}",
                "original_value": None,
            }
        )

    return _build_commit_response(
        preview=preview,
        saved_cases=saved_cases,
        existing_case_references=existing_case_references,
        errors=errors,
    )


def _get_or_create_customer(db: Session, row: dict[str, Any]) -> Customer:
    phone_number = _required_text(row.get("phone_number"), "phone_number")
    customer = db.scalar(select(Customer).where(Customer.phone_number == phone_number))

    if customer is None:
        customer = Customer(
            full_name=_required_text(row.get("customer_name"), "customer_name"),
            phone_number=phone_number,
            email=_text(row.get("email")),
            alternate_phone=_text(row.get("alternate_phone")),
            city=_text(row.get("city")),
            state=_text(row.get("state")),
        )
        db.add(customer)
        db.flush()
        return customer

    _update_if_present(customer, "full_name", row.get("customer_name"))
    _update_if_present(customer, "email", row.get("email"))
    _update_if_present(customer, "alternate_phone", row.get("alternate_phone"))
    _update_if_present(customer, "city", row.get("city"))
    _update_if_present(customer, "state", row.get("state"))
    return customer


def _build_case(*, customer: Customer, row: dict[str, Any], case_reference: str) -> Case:
    outstanding_amount = _required_decimal(row.get("outstanding_amount"), "outstanding_amount")

    return Case(
        customer_id=customer.id,
        external_reference=case_reference,
        principal_amount=outstanding_amount,
        outstanding_amount=outstanding_amount,
        emi_amount=_optional_decimal(row.get("emi_amount")),
        currency="INR",
        lender_name=_text(row.get("lender_name")),
        due_date=_optional_date(row.get("due_date")),
        dpd=_optional_int(row.get("dpd")),
        priority=_text(row.get("priority")) or "normal",
        assigned_agent=_text(row.get("assigned_agent")),
        status=_text(row.get("status")) or "open",
    )


def _build_commit_response(
    *,
    preview: dict[str, Any],
    saved_cases: list[dict[str, str]],
    existing_case_references: list[str],
    errors: list[dict[str, Any]],
) -> dict[str, Any]:
    total_rows = int(preview["total_rows"])
    saved_rows = len(saved_cases)
    skipped_rows = total_rows - saved_rows

    if saved_rows > 0:
        message = f"Saved {saved_rows} case row(s)."
    elif preview["valid_rows"] == 0:
        message = "No valid rows to save."
    else:
        message = "No new cases saved."

    return {
        "total_rows": total_rows,
        "saved_rows": saved_rows,
        "skipped_rows": skipped_rows,
        "invalid_rows": int(preview["invalid_rows"]),
        "duplicate_rows": int(preview["duplicate_rows"]),
        "errors": errors,
        "saved_cases": saved_cases,
        "existing_case_references": existing_case_references,
        "message": message,
    }


def _update_if_present(model: Customer, field_name: str, value: Any) -> None:
    cleaned_value = _text(value)
    if cleaned_value is not None:
        setattr(model, field_name, cleaned_value)


def _required_text(value: Any, field_name: str) -> str:
    cleaned_value = _text(value)
    if cleaned_value is None:
        raise ValueError(f"{field_name} is required")
    return cleaned_value


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _required_decimal(value: Any, field_name: str) -> Decimal:
    decimal_value = _optional_decimal(value)
    if decimal_value is None:
        raise ValueError(f"{field_name} is required")
    return decimal_value


def _optional_decimal(value: Any) -> Decimal | None:
    text = _text(value)
    if text is None:
        return None
    return Decimal(text.replace(",", ""))


def _optional_date(value: Any) -> date | None:
    text = _text(value)
    if text is None:
        return None
    return date.fromisoformat(text)


def _optional_int(value: Any) -> int | None:
    text = _text(value)
    if text is None:
        return None
    return int(Decimal(text))
