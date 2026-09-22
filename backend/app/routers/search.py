from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Follow, Hashtag, Post, PostHashtag, User
from app.schemas.search import HashtagDetailOut, SearchOut
from app.services.posts import paginated_grid
from app.services.privacy import can_view_profile, is_blocked_either_way, to_user_public
from app.utils.pagination import clamp_limit

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchOut)
def search(
    q: str = Query(""),
    type: str = Query("all"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = q.strip().lower()
    result: dict = {"users": [], "hashtags": []}
    if not query:
        return result

    if type in ("user", "all"):
        candidates = (
            db.query(User)
            .filter(
                User.id != user.id,
                (User.username.contains(query)) | (func.lower(User.full_name).contains(query)),
            )
            .limit(50)
            .all()
        )
        users = [u for u in candidates if not is_blocked_either_way(db, user.id, u.id)][:20]
        result["users"] = [to_user_public(db, u, user.id) for u in users]

    if type in ("hashtag", "all"):
        rows = (
            db.query(Hashtag, func.count(PostHashtag.post_id).label("post_count"))
            .join(PostHashtag, PostHashtag.hashtag_id == Hashtag.id)
            .filter(Hashtag.name.contains(query))
            .group_by(Hashtag.id)
            .order_by(func.count(PostHashtag.post_id).desc())
            .limit(20)
            .all()
        )
        result["hashtags"] = [{"name": tag.name, "post_count": count} for tag, count in rows]

    return result


@router.get("/hashtags/{name}", response_model=HashtagDetailOut)
def get_hashtag(
    name: str,
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tag_name = name.lower()
    tag = db.query(Hashtag).filter(Hashtag.name == tag_name).first()
    if tag is None:
        return {"name": tag_name, "post_count": 0, "items": [], "next_cursor": None}

    stmt = (
        select(Post)
        .join(PostHashtag, PostHashtag.post_id == Post.id)
        .join(User, User.id == Post.author_id)
        .where(PostHashtag.hashtag_id == tag.id)
    )
    visible_stmt = stmt.where(
        (User.is_private.is_(False))
        | (Post.author_id == user.id)
        | (Post.author_id.in_(_followee_ids(db, user.id)))
    )

    total = db.scalar(
        select(func.count()).select_from(visible_stmt.subquery())
    ) or 0
    items, next_cursor = paginated_grid(db, visible_stmt, cursor, clamp_limit(limit))
    return {"name": tag_name, "post_count": total, "items": items, "next_cursor": next_cursor}


def _followee_ids(db: Session, user_id: int) -> set[int]:
    return {r[0] for r in db.query(Follow.followee_id).filter(Follow.follower_id == user_id).all()} or {-1}
