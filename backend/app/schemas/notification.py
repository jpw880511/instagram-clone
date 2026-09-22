from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserSummary


class PostRef(BaseModel):
    id: int
    thumbnail_url: str | None = None


class NotificationOut(BaseModel):
    id: int
    type: str
    actor: UserSummary
    post: PostRef | None
    comment_preview: str | None
    is_read: bool
    created_at: datetime


class NotificationReadIn(BaseModel):
    ids: list[int] | None = None


class UnreadCountOut(BaseModel):
    count: int
