from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import UUIDPrimaryKeyMixin


class CampaignCase(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "campaign_cases"
    __table_args__ = (
        UniqueConstraint("campaign_id", "case_id", name="uq_campaign_cases_campaign_id_case_id"),
    )

    campaign_id: Mapped[str] = mapped_column(String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    campaign = relationship("Campaign", back_populates="campaign_cases")
    case = relationship("Case", back_populates="campaign_links")
