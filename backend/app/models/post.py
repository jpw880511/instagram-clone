from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UTCDateTime, utcnow


class Post(Base):
    """db.md §3.6 posts"""

    __tablename__ = "posts"
    __table_args__ = (
        CheckConstraint("post_type IN ('post', 'reel')", name="ck_posts_post_type"),
        # 캡션은 CreatePostModal의 maxLength={2200}과 동일한 상한(댓글과도 동일).
        CheckConstraint("length(caption) <= 2200", name="ck_posts_caption_len"),
        CheckConstraint("length(location) <= 100", name="ck_posts_location_len"),
        Index("ix_posts_author_id_created_at", "author_id", "created_at"),
        Index("ix_posts_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    caption: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    post_type: Mapped[str] = mapped_column(String(10), nullable=False, default="post")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow, nullable=False
    )

    media: Mapped[list["PostMedia"]] = relationship(
        back_populates="post", cascade="all, delete-orphan", passive_deletes=True,
        order_by="PostMedia.sort_order",
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="post", cascade="all, delete-orphan", passive_deletes=True
    )


class PostMedia(Base):
    """db.md §3.7 post_media"""

    __tablename__ = "post_media"
    __table_args__ = (
        CheckConstraint("media_type IN ('image', 'video')", name="ck_post_media_media_type"),
        UniqueConstraint("post_id", "sort_order", name="uq_post_media_post_id_sort_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    post: Mapped["Post"] = relationship(back_populates="media")


class PostLike(Base):
    """db.md §3.8 post_likes"""

    __tablename__ = "post_likes"
    __table_args__ = (Index("ix_post_likes_post_id", "post_id"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)


class PostSave(Base):
    """db.md §3.9 post_saves"""

    __tablename__ = "post_saves"
    __table_args__ = (Index("ix_post_saves_user_id_created_at", "user_id", "created_at"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)


class PostUserTag(Base):
    """db.md §3.10 post_user_tags — 게시물 위 사람 태그."""

    __tablename__ = "post_user_tags"

    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)


class Hashtag(Base):
    """db.md §3.11 hashtags"""

    __tablename__ = "hashtags"
    __table_args__ = (CheckConstraint("length(name) BETWEEN 1 AND 50", name="ck_hashtags_name_len"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)


class PostHashtag(Base):
    """db.md §3.12 post_hashtags"""

    __tablename__ = "post_hashtags"
    __table_args__ = (Index("ix_post_hashtags_hashtag_id", "hashtag_id"),)

    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    hashtag_id: Mapped[int] = mapped_column(ForeignKey("hashtags.id", ondelete="CASCADE"), primary_key=True)


class Comment(Base):
    """db.md §3.13 comments — 대댓글만 parent_id NOT NULL (앱에서 강제)."""

    __tablename__ = "comments"
    __table_args__ = (
        CheckConstraint("length(text) BETWEEN 1 AND 2200", name="ck_comments_text_len"),
        Index("ix_comments_post_id_parent_id_created", "post_id", "parent_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True
    )
    text: Mapped[str] = mapped_column(String(2200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)

    post: Mapped["Post"] = relationship(back_populates="comments")
    replies: Mapped[list["Comment"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan", passive_deletes=True
    )
    parent: Mapped["Comment | None"] = relationship(back_populates="replies", remote_side=[id])


class CommentLike(Base):
    """db.md §3.14 comment_likes"""

    __tablename__ = "comment_likes"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)
