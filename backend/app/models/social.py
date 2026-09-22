from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, UTCDateTime, utcnow


class Follow(Base):
    """db.md §3.3 follows — 수락된 팔로우만 저장."""

    __tablename__ = "follows"
    __table_args__ = (
        CheckConstraint("follower_id != followee_id", name="ck_follows_no_self"),
        Index("ix_follows_followee_id", "followee_id"),
    )

    follower_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    followee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)


class FollowRequest(Base):
    """db.md §3.4 follow_requests — 수락 시 삭제 후 follows insert."""

    __tablename__ = "follow_requests"
    __table_args__ = (
        CheckConstraint("requester_id != requestee_id", name="ck_follow_requests_no_self"),
    )

    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    requestee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)


class Block(Base):
    """db.md §3.5 blocks"""

    __tablename__ = "blocks"
    __table_args__ = (
        CheckConstraint("blocker_id != blocked_id", name="ck_blocks_no_self"),
    )

    blocker_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    blocked_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)
