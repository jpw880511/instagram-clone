from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UTCDateTime, utcnow


class Story(Base):
    """db.md §3.15 stories — 만료 행은 GET 시 필터, 물리 삭제는 선택 배치."""

    __tablename__ = "stories"
    __table_args__ = (
        CheckConstraint("media_type IN ('image', 'video')", name="ck_stories_media_type"),
        Index("ix_stories_author_expires", "author_id", "expires_at"),
        Index("ix_stories_expires_at", "expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)

    views: Mapped[list["StoryView"]] = relationship(
        back_populates="story", cascade="all, delete-orphan", passive_deletes=True
    )


class StoryView(Base):
    """db.md §3.16 story_views"""

    __tablename__ = "story_views"

    story_id: Mapped[int] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    viewed_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)

    story: Mapped["Story"] = relationship(back_populates="views")
