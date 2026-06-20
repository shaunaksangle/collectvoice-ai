from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from app.services.cases.column_mapping import COLUMN_ALIASES, UploadColumnMapping, build_upload_column_mapping
from app.services.cases.upload_parser import ParsedUpload, ParsedUploadRow

REQUIRED_FIELDS = ("customer_name", "phone_number", "case_reference", "outstanding_amount")


def build_case_upload_preview(parsed_upload: ParsedUpload) -> dict[str, Any]:
    column_mapping = build_upload_column_mapping(parsed_upload.headers)
    errors: list[dict[str, Any]] = []
    preview_data: list[dict[str, Any]] = []
    invalid_row_numbers: set[int] = set()
    duplicate_row_numbers: set[int] = set()
    seen_case_references: dict[str, int] = {}

    for parsed_row in parsed_upload.rows:
        normalized_row, row_errors = _validate_row(parsed_row, column_mapping)

        case_reference = normalized_row.get("case_reference")
        if not _is_blank(case_reference):
            duplicate_key = str(case_reference).strip().lower()
            if duplicate_key in seen_case_references:
                duplicate_row_numbers.add(parsed_row.row_number)
                row_errors.append(
                    _error(
                        parsed_row.row_number,
                        "case_reference",
                        f"duplicate case_reference in uploaded file; first seen on row {seen_case_references[duplicate_key]}",
                        case_reference,
                    )
                )
            else:
                seen_case_references[duplicate_key] = parsed_row.row_number

        if row_errors:
            invalid_row_numbers.add(parsed_row.row_number)

        errors.extend(row_errors)
        preview_data.append(
            {
                "row_number": parsed_row.row_number,
                "is_valid": not row_errors,
                **normalized_row,
            }
        )

    total_rows = len(parsed_upload.rows)
    invalid_rows = len(invalid_row_numbers)

    return {
        "total_rows": total_rows,
        "valid_rows": total_rows - invalid_rows,
        "invalid_rows": invalid_rows,
        "duplicate_rows": len(duplicate_row_numbers),
        "errors": errors,
        "normalized_columns": column_mapping.original_to_field,
        "preview_data": preview_data,
    }


def _validate_row(parsed_row: ParsedUploadRow, column_mapping: UploadColumnMapping) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    normalized_row = _normalize_row(parsed_row.data, column_mapping)
    row_errors: list[dict[str, Any]] = []

    for field in REQUIRED_FIELDS:
        if _is_blank(normalized_row.get(field)):
            issue = "required column is missing" if field not in column_mapping.field_to_originals else "is required"
            row_errors.append(_error(parsed_row.row_number, field, issue, normalized_row.get(field)))

    outstanding_value = normalized_row.get("outstanding_amount")
    if not _is_blank(outstanding_value):
        parsed_outstanding = _parse_decimal(outstanding_value)
        if parsed_outstanding is None:
            row_errors.append(_error(parsed_row.row_number, "outstanding_amount", "must be numeric", outstanding_value))
        else:
            normalized_row["outstanding_amount"] = str(parsed_outstanding)

    emi_value = normalized_row.get("emi_amount")
    if not _is_blank(emi_value):
        parsed_emi = _parse_decimal(emi_value)
        if parsed_emi is None:
            row_errors.append(_error(parsed_row.row_number, "emi_amount", "must be numeric", emi_value))
        else:
            normalized_row["emi_amount"] = str(parsed_emi)

    due_date_value = normalized_row.get("due_date")
    if not _is_blank(due_date_value):
        parsed_due_date = _parse_date(due_date_value)
        if parsed_due_date is None:
            row_errors.append(_error(parsed_row.row_number, "due_date", "must be a valid date", due_date_value))
        else:
            normalized_row["due_date"] = parsed_due_date.isoformat()

    dpd_value = normalized_row.get("dpd")
    if not _is_blank(dpd_value):
        parsed_dpd = _parse_decimal(dpd_value)
        if parsed_dpd is None:
            row_errors.append(_error(parsed_row.row_number, "dpd", "must be numeric", dpd_value))
        else:
            normalized_row["dpd"] = int(parsed_dpd) if parsed_dpd == parsed_dpd.to_integral_value() else float(parsed_dpd)

    return _json_safe_row(normalized_row), row_errors


def _normalize_row(raw_row: dict[str, Any], column_mapping: UploadColumnMapping) -> dict[str, Any]:
    normalized_row: dict[str, Any] = {field: None for field in COLUMN_ALIASES}

    for field, source_headers in column_mapping.field_to_originals.items():
        values = [raw_row.get(header) for header in source_headers]
        selected = next((value for value in values if not _is_blank(value)), values[0] if values else None)
        normalized_row[field] = _clean_text_value(selected)

    return normalized_row


def _parse_decimal(value: Any) -> Decimal | None:
    if isinstance(value, Decimal):
        return value

    if isinstance(value, int):
        return Decimal(value)

    if isinstance(value, float):
        return Decimal(str(value))

    text = str(value).strip().replace(",", "")
    text = text.lstrip("$ ")
    if text == "":
        return None

    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _parse_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    text = str(value).strip()
    if text == "":
        return None

    for date_format in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d.%m.%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue

    return None


def _clean_text_value(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped != "" else None
    return value


def _json_safe_row(row: dict[str, Any]) -> dict[str, Any]:
    return {key: _json_safe_value(value) for key, value in row.items()}


def _json_safe_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, date):
        return value.isoformat()

    if isinstance(value, Decimal):
        return str(value)

    return value


def _is_blank(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _error(row_number: int, field: str, issue: str, original_value: Any) -> dict[str, Any]:
    return {
        "row_number": row_number,
        "field": field,
        "issue": issue,
        "original_value": _json_safe_value(original_value),
    }
