from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserSummary


class StoryTrayItem(BaseModel):
    user: UserSummary
    has_unseen: bool
    latest_at: datetime | None
    story_count: int


class StoryOut(BaseModel):
    id: int
    author: UserSummary
    url: str
    media_type: str
    created_at: datetime
    expires_at: datetime
    viewed: bool


class StoryViewerOut(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    viewed_at: datetime
