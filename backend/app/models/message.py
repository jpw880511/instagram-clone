from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UTCDateTime, utcnow


class Conversation(Base):
    """db.md §3.17 conversations — 1:1 전용, 그룹챗 없음.

    user_low_id/user_high_id는 ON DELETE CASCADE로 걸어 둔다: 참여자 계정이 삭제되면
    그 대화와(하위 messages/conversation_members까지) 함께 정리되어야 하며, 그렇지 않으면
    회원 탈퇴 시 "이 대화에 남아 있는 FK 때문에" 삭제가 막히는 문제가 생긴다.
    """

    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("user_low_id", "user_high_id", name="uq_conversations_users"),
        CheckConstraint("user_low_id < user_high_id", name="ck_conversations_user_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_low_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_high_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow, nullable=False
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", passive_deletes=True
    )
    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", passive_deletes=True
    )


class ConversationMember(Base):
    """db.md §3.18 conversation_members — 멤버별 읽음 커서.

    last_read_message_id 는 messages.id 를 가리키지만 순환 FK를 피하기 위해
    db.md 권장대로 FK 없이 INTEGER NULL 로 둔다(애플리케이션에서만 갱신).
    """

    __tablename__ = "conversation_members"

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    last_read_message_id: Mapped[int | None] = mapped_column(nullable=True)
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)

    conversation: Mapped["Conversation"] = relationship(back_populates="members")


class Message(Base):
    """db.md §3.19 messages"""

    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("kind IN ('text', 'image', 'story_reply')", name="ck_messages_kind"),
        Index("ix_messages_conversation_id_id", "conversation_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    story_id: Mapped[int | None] = mapped_column(
        ForeignKey("stories.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
