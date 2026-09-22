from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Block, Follow, FollowRequest, Post, Story, User
from app.utils.filenames import avatar_url


def is_blocked_either_way(db: Session, a_id: int, b_id: int) -> bool:
    stmt = select(Block.blocker_id).where(
        ((Block.blocker_id == a_id) & (Block.blocked_id == b_id))
        | ((Block.blocker_id == b_id) & (Block.blocked_id == a_id))
    )
    return db.scalar(stmt) is not None


def is_following(db: Session, follower_id: int, followee_id: int) -> bool:
    stmt = select(Follow.follower_id).where(
        Follow.follower_id == follower_id, Follow.followee_id == followee_id
    )
    return db.scalar(stmt) is not None


def has_pending_request(db: Session, requester_id: int, requestee_id: int) -> bool:
    stmt = select(FollowRequest.requester_id).where(
        FollowRequest.requester_id == requester_id, FollowRequest.requestee_id == requestee_id
    )
    return db.scalar(stmt) is not None


def follow_status(db: Session, viewer_id: int | None, target_id: int) -> str:
    if viewer_id is None:
        return "none"
    if viewer_id == target_id:
        return "self"
    if is_following(db, viewer_id, target_id):
        return "following"
    if has_pending_request(db, viewer_id, target_id):
        return "requested"
    return "none"


def can_view_profile(db: Session, viewer_id: int | None, owner: User) -> bool:
    if viewer_id is None:
        return not owner.is_private
    if viewer_id == owner.id:
        return True
    if is_blocked_either_way(db, viewer_id, owner.id):
        return False
    if not owner.is_private:
        return True
    return is_following(db, viewer_id, owner.id)


def post_count(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Post).where(Post.author_id == user_id)) or 0


def follower_count(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Follow).where(Follow.followee_id == user_id)) or 0


def following_count(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Follow).where(Follow.follower_id == user_id)) or 0


def has_active_story(db: Session, user_id: int) -> bool:
    now = datetime.now(timezone.utc)
    stmt = select(Story.id).where(Story.author_id == user_id, Story.expires_at > now)
    return db.scalar(stmt) is not None


def to_user_summary(user: User) -> dict:
    return {"id": user.id, "username": user.username, "avatar_url": avatar_url(user.avatar_path)}


def to_user_public(db: Session, user: User, viewer_id: int | None) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "website": user.website,
        "avatar_url": avatar_url(user.avatar_path),
        "is_private": user.is_private,
        "post_count": post_count(db, user.id),
        "follower_count": follower_count(db, user.id),
        "following_count": following_count(db, user.id),
        "is_following": is_following(db, viewer_id, user.id) if viewer_id is not None else False,
        "is_followed_by": is_following(db, user.id, viewer_id) if viewer_id is not None else False,
        "follow_status": follow_status(db, viewer_id, user.id),
        "has_story": has_active_story(db, user.id),
    }


def to_user_me(db: Session, user: User) -> dict:
    return {**to_user_public(db, user, user.id), "email": user.email}
