from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserSummary


class PostMediaOut(BaseModel):
    id: int
    url: str
    media_type: str
    sort_order: int
    width: int | None = None
    height: int | None = None


class PostOut(BaseModel):
    id: int
    author: UserSummary
    caption: str
    location: str
    post_type: str
    created_at: datetime
    media: list[PostMediaOut]
    like_count: int
    comment_count: int
    liked: bool
    saved: bool
    tagged_users: list[UserSummary]


class PostGridItem(BaseModel):
    id: int
    thumbnail_url: str | None = None
    like_count: int
    comment_count: int
    media_count: int
    post_type: str


class LikeToggleOut(BaseModel):
    liked: bool
    like_count: int


class SaveToggleOut(BaseModel):
    saved: bool
