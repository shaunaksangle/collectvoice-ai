from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class CallOutcome(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "call_outcomes"

    call_attempt_id: Mapped[str] = mapped_column(ForeignKey("call_attempts.id", ondelete="CASCADE"), unique=True, nullable=False)
    campaign_id: Mapped[str | None] = mapped_column(ForeignKey("campaigns.id", ondelete="SET NULL"), index=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    outcome_type: Mapped[str] = mapped_column(String(80), nullable=False)
    disposition: Mapped[str | None] = mapped_column(String(80))
    summary: Mapped[str | None] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text)
    detected_intent: Mapped[str | None] = mapped_column(String(120))
    sentiment: Mapped[str | None] = mapped_column(String(50))
    promise_date: Mapped[date | None] = mapped_column(Date)
    promise_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    callback_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    callback_reason: Mapped[str | None] = mapped_column(Text)
    human_review_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    next_action: Mapped[str | None] = mapped_column(String(120))

    call_attempt = relationship("CallAttempt", back_populates="outcome")
    case = relationship("Case", back_populates="outcomes")
