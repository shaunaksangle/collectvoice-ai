from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class HumanCallback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "human_callbacks"

    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True, nullable=False)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    call_attempt_id: Mapped[str | None] = mapped_column(ForeignKey("call_attempts.id", ondelete="SET NULL"))
    assigned_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    preferred_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(50), default="normal", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open", nullable=False)
    assigned_agent: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    case = relationship("Case", back_populates="human_callbacks")
    call_attempt = relationship("CallAttempt", back_populates="human_callbacks")
    assigned_user = relationship("User", back_populates="assigned_callbacks")
