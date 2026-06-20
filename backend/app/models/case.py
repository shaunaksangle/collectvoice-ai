from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Case(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "cases"

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True, nullable=False)
    external_reference: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    principal_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    outstanding_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    emi_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    lender_name: Mapped[str | None] = mapped_column(String(255), index=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    dpd: Mapped[int | None] = mapped_column(Integer)
    priority: Mapped[str] = mapped_column(String(50), default="normal", index=True, nullable=False)
    assigned_agent: Mapped[str | None] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(50), default="open", nullable=False)
    case_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    customer = relationship("Customer", back_populates="cases")
    call_attempts = relationship("CallAttempt", back_populates="case")
    outcomes = relationship("CallOutcome", back_populates="case")
    promise_to_pay_records = relationship("PromiseToPay", back_populates="case")
    human_callbacks = relationship("HumanCallback", back_populates="case")
    campaign_links = relationship("CampaignCase", back_populates="case", cascade="all, delete-orphan")
