from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PromiseToPay(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "promise_to_pay"

    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    call_attempt_id: Mapped[str | None] = mapped_column(ForeignKey("call_attempts.id", ondelete="SET NULL"))
    promised_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    promised_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    source: Mapped[str] = mapped_column(String(80), default="mock_call", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    case = relationship("Case", back_populates="promise_to_pay_records")
    call_attempt = relationship("CallAttempt", back_populates="promise_to_pay_records")
