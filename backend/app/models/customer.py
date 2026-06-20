from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Customer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customers"

    external_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    alternate_phone: Mapped[str | None] = mapped_column(String(32))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    preferred_language: Mapped[str] = mapped_column(String(20), default="en-IN", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    cases = relationship("Case", back_populates="customer", cascade="all, delete-orphan")
    call_attempts = relationship("CallAttempt", back_populates="customer")
