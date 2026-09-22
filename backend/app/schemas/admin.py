from datetime import datetime

from pydantic import BaseModel


class AdminLoginIn(BaseModel):
    username: str
    password: str


class AdminTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    is_private: bool
    created_at: datetime
    post_count: int
    follower_count: int


class AdminUsersPage(BaseModel):
    items: list[AdminUserOut]
    total: int
    limit: int
    offset: int


class AdminPostOut(BaseModel):
    id: int
    author_id: int
    author_username: str
    caption: str
    post_type: str
    created_at: datetime
    like_count: int
    comment_count: int
    thumbnail_url: str | None


class AdminPostsPage(BaseModel):
    items: list[AdminPostOut]
    total: int
    limit: int
    offset: int


class DailyCount(BaseModel):
    date: str
    count: int


class AdminStatsOut(BaseModel):
    total_users: int
    total_posts: int
    total_reels: int
    total_comments: int
    total_likes: int
    total_follows: int
    active_stories: int
    total_conversations: int
    total_messages: int
    signups_last_7_days: list[DailyCount]
    posts_last_7_days: list[DailyCount]
