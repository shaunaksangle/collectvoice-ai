from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.session import SessionLocal  # noqa: E402
from app.models.case import Case  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.schemas.call_queue import CallQueueGenerateRequest  # noqa: E402
from app.schemas.campaigns import CampaignCaseAttachRequest, CampaignCreate  # noqa: E402
from app.schemas.mock_calls import MockCallRunRequest  # noqa: E402
from app.services.call_queue.call_queue_service import generate_call_queue  # noqa: E402
from app.services.campaigns.campaign_service import attach_cases_to_campaign, create_campaign  # noqa: E402
from app.services.mock_calls.mock_call_service import run_mock_call  # noqa: E402

DEMO_REFERENCE_PREFIX = "CVAI-DEMO"

CUSTOMER_CASE_DATA = [
    {
        "name": "Aarav Menon",
        "phone": "9000001001",
        "email": "aarav.menon.demo@example.com",
        "city": "Bengaluru",
        "state": "Karnataka",
        "case_reference": "CVAI-DEMO-LN-1001",
        "lender": "Nava Bharat Credit",
        "principal": "85000.00",
        "outstanding": "27450.00",
        "emi": "7250.00",
        "dpd": 42,
        "priority": "high",
        "agent": "Agent Kavya",
        "status": "open",
    },
    {
        "name": "Diya Iyer",
        "phone": "9000001002",
        "email": "diya.iyer.demo@example.com",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "case_reference": "CVAI-DEMO-LN-1002",
        "lender": "MetroFin Lending",
        "principal": "62000.00",
        "outstanding": "18800.00",
        "emi": "5200.00",
        "dpd": 12,
        "priority": "normal",
        "agent": "Agent Rohan",
        "status": "open",
    },
    {
        "name": "Kabir Shah",
        "phone": "9000001003",
        "email": "kabir.shah.demo@example.com",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "case_reference": "CVAI-DEMO-LN-1003",
        "lender": "Pragati Urban Finance",
        "principal": "145000.00",
        "outstanding": "56300.00",
        "emi": "11800.00",
        "dpd": 68,
        "priority": "critical",
        "agent": "Agent Meera",
        "status": "open",
    },
    {
        "name": "Meera Nair",
        "phone": "9000001004",
        "email": "meera.nair.demo@example.com",
        "city": "Kochi",
        "state": "Kerala",
        "case_reference": "CVAI-DEMO-LN-1004",
        "lender": "BluePeak NBFC",
        "principal": "54000.00",
        "outstanding": "9600.00",
        "emi": "4800.00",
        "dpd": 5,
        "priority": "low",
        "agent": "Agent Kavya",
        "status": "open",
    },
    {
        "name": "Rohan Bansal",
        "phone": "9000001005",
        "email": "rohan.bansal.demo@example.com",
        "city": "Jaipur",
        "state": "Rajasthan",
        "case_reference": "CVAI-DEMO-LN-1005",
        "lender": "Nava Bharat Credit",
        "principal": "98000.00",
        "outstanding": "41250.00",
        "emi": "8900.00",
        "dpd": 33,
        "priority": "high",
        "agent": "Agent Farhan",
        "status": "open",
    },
    {
        "name": "Ishita Rao",
        "phone": "9000001006",
        "email": "ishita.rao.demo@example.com",
        "city": "Hyderabad",
        "state": "Telangana",
        "case_reference": "CVAI-DEMO-LN-1006",
        "lender": "MetroFin Lending",
        "principal": "73000.00",
        "outstanding": "22100.00",
        "emi": "6100.00",
        "dpd": 18,
        "priority": "normal",
        "agent": "Agent Rohan",
        "status": "open",
    },
    {
        "name": "Farhan Ali",
        "phone": "9000001007",
        "email": "farhan.ali.demo@example.com",
        "city": "Lucknow",
        "state": "Uttar Pradesh",
        "case_reference": "CVAI-DEMO-LN-1007",
        "lender": "Pragati Urban Finance",
        "principal": "118000.00",
        "outstanding": "48700.00",
        "emi": "10200.00",
        "dpd": 77,
        "priority": "critical",
        "agent": "Agent Meera",
        "status": "open",
    },
    {
        "name": "Kavya Desai",
        "phone": "9000001008",
        "email": "kavya.desai.demo@example.com",
        "city": "Pune",
        "state": "Maharashtra",
        "case_reference": "CVAI-DEMO-LN-1008",
        "lender": "BluePeak NBFC",
        "principal": "66000.00",
        "outstanding": "15450.00",
        "emi": "5500.00",
        "dpd": 9,
        "priority": "normal",
        "agent": "Agent Farhan",
        "status": "open",
    },
    {
        "name": "Nikhil Verma",
        "phone": "9000001009",
        "email": "nikhil.verma.demo@example.com",
        "city": "Delhi",
        "state": "Delhi",
        "case_reference": "CVAI-DEMO-LN-1009",
        "lender": "Nava Bharat Credit",
        "principal": "132000.00",
        "outstanding": "68200.00",
        "emi": "12400.00",
        "dpd": 95,
        "priority": "critical",
        "agent": "Agent Kavya",
        "status": "open",
    },
    {
        "name": "Tara Kulkarni",
        "phone": "9000001010",
        "email": "tara.kulkarni.demo@example.com",
        "city": "Mumbai",
        "state": "Maharashtra",
        "case_reference": "CVAI-DEMO-LN-1010",
        "lender": "MetroFin Lending",
        "principal": "59000.00",
        "outstanding": "13250.00",
        "emi": "5000.00",
        "dpd": 21,
        "priority": "high",
        "agent": "Agent Rohan",
        "status": "open",
    },
]


def seed_demo_data() -> dict[str, object]:
    with SessionLocal() as db:
        existing_demo_cases = int(
            db.scalar(select(func.count(Case.id)).where(Case.external_reference.like(f"{DEMO_REFERENCE_PREFIX}-%")))
            or 0
        )
        if existing_demo_cases:
            print(
                f"Demo seed skipped. Found {existing_demo_cases} existing {DEMO_REFERENCE_PREFIX} cases. "
                "Run reseed_demo_data.py for a clean demo dataset."
            )
            return {"created": False, "existing_demo_cases": existing_demo_cases}

        customers: list[Customer] = []
        cases: list[Case] = []
        due_base = date.today()

        for index, row in enumerate(CUSTOMER_CASE_DATA, start=1):
            customer = Customer(
                external_id=f"DEMO-CUST-{index:03d}",
                full_name=row["name"],
                phone_number=row["phone"],
                email=row["email"],
                city=row["city"],
                state=row["state"],
                preferred_language="en-IN",
                status="active",
            )
            case = Case(
                customer=customer,
                external_reference=row["case_reference"],
                principal_amount=Decimal(row["principal"]),
                outstanding_amount=Decimal(row["outstanding"]),
                emi_amount=Decimal(row["emi"]),
                currency="INR",
                lender_name=row["lender"],
                due_date=due_base - timedelta(days=int(row["dpd"])),
                dpd=int(row["dpd"]),
                priority=row["priority"],
                assigned_agent=row["agent"],
                status=row["status"],
                case_metadata={"demo": True, "portfolio": "June mock collection demo"},
            )
            customers.append(customer)
            cases.append(case)

        db.add_all(customers)
        db.commit()
        for customer in customers:
            db.refresh(customer)
        for case in cases:
            db.refresh(case)

        high_dpd_campaign = create_campaign(
            db,
            CampaignCreate(
                name="June High DPD Payment Follow-up",
                description="Demo campaign for high-risk overdue accounts.",
                status="ready",
                campaign_type="payment_follow_up",
                priority_filter="high",
                status_filter="open",
                min_dpd=30,
                max_dpd=120,
            ),
        )
        reminder_campaign = create_campaign(
            db,
            CampaignCreate(
                name="June Early Reminder Campaign",
                description="Demo campaign for early-stage reminder calls.",
                status="ready",
                campaign_type="reminder",
                status_filter="open",
                min_dpd=1,
                max_dpd=29,
            ),
        )

        high_dpd_case_ids = [case.id for case in cases if (case.dpd or 0) >= 30]
        reminder_case_ids = [case.id for case in cases if (case.dpd or 0) < 30]
        attach_cases_to_campaign(
            db,
            high_dpd_campaign["id"],
            CampaignCaseAttachRequest(case_ids=high_dpd_case_ids),
        )
        attach_cases_to_campaign(
            db,
            reminder_campaign["id"],
            CampaignCaseAttachRequest(case_ids=reminder_case_ids),
        )

        high_queue = generate_call_queue(db, high_dpd_campaign["id"], CallQueueGenerateRequest())
        reminder_queue = generate_call_queue(
            db,
            reminder_campaign["id"],
            CallQueueGenerateRequest(scheduled_at=datetime.now(timezone.utc) + timedelta(hours=3)),
        )

        call_attempt_ids = high_queue["created_call_attempt_ids"] + reminder_queue["created_call_attempt_ids"]
        outcome_plan = [
            (
                "promise_to_pay",
                {
                    "promise_date": date.today() + timedelta(days=5),
                    "promise_amount": Decimal("7500.00"),
                    "notes": "Demo: customer committed to pay after salary credit.",
                },
            ),
            ("no_answer", {"notes": "Demo: phone rang but customer did not answer."}),
            (
                "dispute",
                {
                    "callback_reason": "Customer requested a statement review before making payment.",
                    "notes": "Demo: dispute routed for human review.",
                },
            ),
            ("already_paid", {"notes": "Demo: customer claimed payment was already completed yesterday."}),
            (
                "callback_requested",
                {
                    "callback_reason": "Customer asked for a callback after 6 PM.",
                    "notes": "Demo: customer prefers evening discussion with a human agent.",
                },
            ),
        ]

        mock_results = []
        for call_attempt_id, (outcome_type, options) in zip(call_attempt_ids, outcome_plan, strict=False):
            result = run_mock_call(
                db,
                call_attempt_id,
                MockCallRunRequest(outcome_type=outcome_type, **options),
            )
            mock_results.append(result)

    print("Demo data seed complete.")
    print(f"- customers: {len(customers)} created")
    print(f"- cases: {len(cases)} created")
    print("- campaigns: 2 created")
    print(f"- campaign case links: {len(high_dpd_case_ids) + len(reminder_case_ids)} created")
    print(f"- call attempts: {len(call_attempt_ids)} created")
    print(f"- mock call outcomes: {len(mock_results)} created")
    print("- expected follow-ups: 1 promise-to-pay, 2 human callbacks")

    return {
        "created": True,
        "customers": len(customers),
        "cases": len(cases),
        "campaigns": 2,
        "campaign_case_links": len(high_dpd_case_ids) + len(reminder_case_ids),
        "call_attempts": len(call_attempt_ids),
        "mock_outcomes": len(mock_results),
        "campaign_ids": [high_dpd_campaign["id"], reminder_campaign["id"]],
    }


if __name__ == "__main__":
    seed_demo_data()
