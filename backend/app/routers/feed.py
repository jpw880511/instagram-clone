from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_current_user_optional, get_db
from app.models import Block, Follow, Post, PostLike, User
from app.schemas.common import Page
from app.schemas.post import PostGridItem, PostOut
from app.services.posts import paginated_post_out, to_grid_item
from app.utils.pagination import clamp_limit

router = APIRouter(tags=["feed"])


def _blocked_ids(db: Session, viewer_id: int) -> set[int]:
    rows = db.query(Block).filter((Block.blocker_id == viewer_id) | (Block.blocked_id == viewer_id)).all()
    return {r.blocked_id if r.blocker_id == viewer_id else r.blocker_id for r in rows}


def _visibility_clause(db: Session, viewer_id: int | None):
    """can_view_profile과 동등한 SQL 조건: 공개 계정 OR 본인 OR 팔로우 중인 비공개 계정."""
    followee_and_self: set[int] = {viewer_id} if viewer_id is not None else set()
    if viewer_id is not None:
        followee_and_self |= {
            r[0] for r in db.query(Follow.followee_id).filter(Follow.follower_id == viewer_id).all()
        }
    return or_(User.is_private.is_(False), Post.author_id.in_(followee_and_self or {-1}))


@router.get("/feed", response_model=Page[PostOut])
def get_feed(
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    following_ids = {
        r[0] for r in db.query(Follow.followee_id).filter(Follow.follower_id == user.id).all()
    }
    author_ids = following_ids | {user.id}
    blocked = _blocked_ids(db, user.id)

    stmt = select(Post).where(Post.author_id.in_(author_ids), Post.post_type != "reel")
    if blocked:
        stmt = stmt.where(~Post.author_id.in_(blocked))

    items, next_cursor = paginated_post_out(db, stmt, cursor, clamp_limit(limit, default=10), user.id)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/feed/public", response_model=Page[PostOut])
def get_public_feed(
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    viewer_id = user.id if user else None
    stmt = (
        select(Post)
        .join(User, User.id == Post.author_id)
        .where(Post.post_type != "reel", _visibility_clause(db, viewer_id))
    )
    if viewer_id is not None:
        blocked = _blocked_ids(db, viewer_id)
        if blocked:
            stmt = stmt.where(~Post.author_id.in_(blocked))

    items, next_cursor = paginated_post_out(db, stmt, cursor, clamp_limit(limit, default=10), viewer_id)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/explore", response_model=Page[PostGridItem])
def get_explore(
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    like_count_subq = (
        select(func.count()).select_from(PostLike).where(PostLike.post_id == Post.id).scalar_subquery()
    )
    stmt = (
        select(Post)
        .join(User, User.id == Post.author_id)
        .where(User.is_private.is_(False), Post.author_id != user.id)
        .order_by(like_count_subq.desc(), Post.created_at.desc(), Post.id.desc())
    )

    limit_val = clamp_limit(limit, default=12)
    offset = int(cursor) if cursor else 0
    rows = db.execute(stmt.offset(offset).limit(limit_val + 1)).scalars().all()
    has_more = len(rows) > limit_val
    page = rows[:limit_val]
    next_cursor = str(offset + limit_val) if has_more else None

    return {"items": [to_grid_item(db, p) for p in page], "next_cursor": next_cursor}


@router.get("/reels", response_model=Page[PostOut])
def get_reels(
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Post)
        .join(User, User.id == Post.author_id)
        .where(Post.post_type == "reel", _visibility_clause(db, user.id))
    )
    blocked = _blocked_ids(db, user.id)
    if blocked:
        stmt = stmt.where(~Post.author_id.in_(blocked))

    items, next_cursor = paginated_post_out(db, stmt, cursor, clamp_limit(limit, default=5), user.id)
    return {"items": items, "next_cursor": next_cursor}
