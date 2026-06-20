from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import SessionLocal  # noqa: E402
from app.models.call_attempt import CallAttempt  # noqa: E402
from app.models.call_outcome import CallOutcome  # noqa: E402
from app.models.campaign import Campaign  # noqa: E402
from app.models.campaign_case import CampaignCase  # noqa: E402
from app.models.case import Case  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.models.human_callback import HumanCallback  # noqa: E402
from app.models.promise_to_pay import PromiseToPay  # noqa: E402

RESET_FLAG = "ALLOW_DEMO_RESET"


def delete_rows(db: Session, model: type) -> int:
    result = db.execute(delete(model))
    return int(result.rowcount or 0)


def reset_demo_data() -> dict[str, int]:
    if os.getenv(RESET_FLAG, "").strip().lower() != "true":
        print(f"Demo reset skipped. Set {RESET_FLAG}=true to delete local demo data.")
        return {}

    delete_order = [
        ("call_outcomes", CallOutcome),
        ("promise_to_pay", PromiseToPay),
        ("human_callbacks", HumanCallback),
        ("call_attempts", CallAttempt),
        ("campaign_cases", CampaignCase),
        ("campaigns", Campaign),
        ("cases", Case),
        ("customers", Customer),
    ]

    deleted_counts: dict[str, int] = {}
    with SessionLocal() as db:
        try:
            for table_name, model in delete_order:
                deleted_counts[table_name] = delete_rows(db, model)
            db.commit()
        except Exception:
            db.rollback()
            raise

    print("Local demo workflow data reset complete.")
    for table_name, count in deleted_counts.items():
        print(f"- {table_name}: {count} deleted")
    return deleted_counts


if __name__ == "__main__":
    reset_demo_data()
