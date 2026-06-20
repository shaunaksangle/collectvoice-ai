from app.db.session import Base

# Import models so Alembic can discover the full metadata graph.
from app.models import (  # noqa: F401
    AuditLog,
    CallAttempt,
    CallOutcome,
    Campaign,
    CampaignCase,
    Case,
    Customer,
    HumanCallback,
    PromiseToPay,
    User,
)
