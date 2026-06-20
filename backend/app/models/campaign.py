from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Campaign(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "campaigns"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    campaign_type: Mapped[str] = mapped_column(String(80), default="custom", nullable=False)
    lender_name: Mapped[str | None] = mapped_column(String(255), index=True)
    priority_filter: Mapped[str | None] = mapped_column(String(50))
    status_filter: Mapped[str | None] = mapped_column(String(50))
    assigned_agent_filter: Mapped[str | None] = mapped_column(String(255))
    min_dpd: Mapped[int | None] = mapped_column(Integer)
    max_dpd: Mapped[int | None] = mapped_column(Integer)
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    created_by = relationship("User", back_populates="campaigns")
    call_attempts = relationship("CallAttempt", back_populates="campaign")
    campaign_cases = relationship("CampaignCase", back_populates="campaign", cascade="all, delete-orphan")
