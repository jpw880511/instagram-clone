from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.user import UserSummary


class CommentIn(BaseModel):
    text: str
    parent_id: int | None = None

    @field_validator("text")
    @classmethod
    def _text_len(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 2200):
            raise ValueError("댓글 내용을 입력하세요.")
        return v


class CommentOut(BaseModel):
    id: int
    post_id: int
    author: UserSummary
    parent_id: int | None
    text: str
    created_at: datetime
    like_count: int
    liked: bool
    reply_count: int


class CommentLikeOut(BaseModel):
    liked: bool
