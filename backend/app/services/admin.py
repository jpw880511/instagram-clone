from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Comment,
    Conversation,
    Follow,
    Message,
    Post,
    PostLike,
    Story,
    User,
)
from app.services.media import delete_upload_file


def _count(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def _daily_counts(db: Session, model, created_at_col) -> list[dict]:
    """최근 7일(오늘 포함) 일자별 생성 건수. 데이터가 적은 관리자 대시보드용이라
    파이썬에서 버킷팅한다 — SQLite 방언별 날짜 함수 차이를 피하기 위함."""
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)

    buckets: dict[str, int] = {}
    for i in range(7):
        buckets[(start + timedelta(days=i)).date().isoformat()] = 0

    rows = db.query(created_at_col).filter(created_at_col >= start).all()
    for (created_at,) in rows:
        key = created_at.date().isoformat()
        if key in buckets:
            buckets[key] += 1

    return [{"date": d, "count": c} for d, c in buckets.items()]


def compute_stats(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "total_users": _count(db, User),
        "total_posts": db.scalar(
            select(func.count()).select_from(Post).where(Post.post_type == "post")
        )
        or 0,
        "total_reels": db.scalar(
            select(func.count()).select_from(Post).where(Post.post_type == "reel")
        )
        or 0,
        "total_comments": _count(db, Comment),
        "total_likes": _count(db, PostLike),
        "total_follows": _count(db, Follow),
        "active_stories": db.scalar(
            select(func.count()).select_from(Story).where(Story.expires_at > now)
        )
        or 0,
        "total_conversations": _count(db, Conversation),
        "total_messages": _count(db, Message),
        "signups_last_7_days": _daily_counts(db, User, User.created_at),
        "posts_last_7_days": _daily_counts(db, Post, Post.created_at),
    }


def delete_user_cascade(db: Session, user: User) -> None:
    """회원 탈퇴(관리자). DB 행 정리는 FK ON DELETE CASCADE에 맡기고(db.md §4),
    여기서는 커밋 전에 지워질 행이 가리키던 디스크 파일만 먼저 정리한다.
    """
    if user.avatar_path:
        delete_upload_file(user.avatar_path)

    posts = db.query(Post).filter(Post.author_id == user.id).all()
    for post in posts:
        for media in post.media:
            delete_upload_file(media.file_path)

    stories = db.query(Story).filter(Story.author_id == user.id).all()
    for story in stories:
        delete_upload_file(story.file_path)

    messages = (
        db.query(Message)
        .filter(Message.sender_id == user.id, Message.file_path.isnot(None))
        .all()
    )
    for message in messages:
        delete_upload_file(message.file_path)

    db.delete(user)
