from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class CallAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "call_attempts"

    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True, nullable=False)
    campaign_id: Mapped[str | None] = mapped_column(ForeignKey("campaigns.id", ondelete="SET NULL"), index=True)
    provider: Mapped[str] = mapped_column(String(50), default="mock", nullable=False)
    provider_call_id: Mapped[str | None] = mapped_column(String(255), index=True)
    phone_number: Mapped[str | None] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True, nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    transcript: Mapped[str | None] = mapped_column(Text)
    recording_url: Mapped[str | None] = mapped_column(String(500))
    failure_reason: Mapped[str | None] = mapped_column(Text)
    last_error: Mapped[str | None] = mapped_column(Text)

    case = relationship("Case", back_populates="call_attempts")
    customer = relationship("Customer", back_populates="call_attempts")
    campaign = relationship("Campaign", back_populates="call_attempts")
    outcome = relationship("CallOutcome", back_populates="call_attempt", uselist=False)
    promise_to_pay_records = relationship("PromiseToPay", back_populates="call_attempt")
    human_callbacks = relationship("HumanCallback", back_populates="call_attempt")
