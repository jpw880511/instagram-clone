from pydantic import BaseModel

from app.schemas.post import PostGridItem
from app.schemas.user import UserPublic


class HashtagOut(BaseModel):
    name: str
    post_count: int


class SearchOut(BaseModel):
    users: list[UserPublic]
    hashtags: list[HashtagOut]


class HashtagDetailOut(BaseModel):
    name: str
    post_count: int
    items: list[PostGridItem]
    next_cursor: str | None
