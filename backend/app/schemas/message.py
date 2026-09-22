from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserSummary


class ConversationCreateIn(BaseModel):
    user_id: int


class LastMessageOut(BaseModel):
    id: int
    text: str
    kind: str
    sender_id: int
    created_at: datetime


class ConversationOut(BaseModel):
    id: int
    other_user: UserSummary
    last_message: LastMessageOut | None
    unread_count: int
    updated_at: datetime
    is_blocked: bool


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    kind: str
    text: str
    file_path: str | None
    story_id: int | None
    created_at: datetime


class MessagesPage(BaseModel):
    items: list[MessageOut]
