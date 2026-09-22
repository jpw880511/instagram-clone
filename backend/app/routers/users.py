from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Follow, FollowRequest, Post, PostSave, PostUserTag, User
from app.schemas.common import Page
from app.schemas.post import PostGridItem
from app.schemas.user import UserMe, UserPublic
from app.services.media import delete_upload_file, save_upload_file
from app.services.notify import create_notification
from app.services.privacy import can_view_profile, is_blocked_either_way, is_following, to_user_me, to_user_public
from app.services.posts import paginated_grid
from app.utils.pagination import clamp_limit, paginate_entities

router = APIRouter(tags=["users"])


def get_user_or_404(db: Session, username: str, viewer_id: int | None) -> User:
    user = db.query(User).filter(User.username == username.lower()).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    if viewer_id is not None and is_blocked_either_way(db, viewer_id, user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    return user


def assert_can_view_grid(db: Session, viewer_id: int, user: User) -> None:
    if not can_view_profile(db, viewer_id, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 계정의 게시물을 볼 수 없습니다.")


@router.get("/users/me", response_model=UserMe)
def get_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return to_user_me(db, user)


@router.patch("/users/me", response_model=UserMe)
async def update_me(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    full_name: str | None = Form(None),
    username: str | None = Form(None),
    bio: str | None = Form(None),
    website: str | None = Form(None),
    is_private: str | None = Form(None),
    remove_avatar: str | None = Form(None),
    avatar: UploadFile | None = File(None),
):
    if username is not None and username.lower() != user.username:
        new_username = username.lower()
        if db.query(User).filter(User.username == new_username, User.id != user.id).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 아이디입니다.")
        user.username = new_username

    if full_name is not None:
        user.full_name = full_name
    if bio is not None:
        user.bio = bio[:150]
    if website is not None:
        user.website = website

    if is_private is not None:
        turning_public = user.is_private and is_private.lower() != "true"
        user.is_private = is_private.lower() == "true"
        if turning_public:
            pending = db.query(FollowRequest).filter(FollowRequest.requestee_id == user.id).all()
            for req in pending:
                db.add(Follow(follower_id=req.requester_id, followee_id=user.id))
                create_notification(db, recipient_id=req.requester_id, actor_id=user.id, type_="follow")
                db.delete(req)

    if avatar is not None:
        relative_path, _media_type = await save_upload_file(avatar, "avatars")
        delete_upload_file(user.avatar_path)
        user.avatar_path = relative_path
    elif remove_avatar is not None and remove_avatar.lower() == "true":
        delete_upload_file(user.avatar_path)
        user.avatar_path = None

    db.commit()
    db.refresh(user)
    return to_user_me(db, user)


@router.get("/users/suggested", response_model=list[UserPublic])
def get_suggested(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    following_ids = {
        row.followee_id for row in db.query(Follow).filter(Follow.follower_id == user.id).all()
    }
    candidate_ids: list[int] = []
    if following_ids:
        rows = (
            db.query(Follow.followee_id)
            .filter(Follow.follower_id.in_(following_ids), ~Follow.followee_id.in_(following_ids | {user.id}))
            .all()
        )
        candidate_ids = [r[0] for r in rows]

    candidates: list[User] = []
    seen: set[int] = set()
    for uid in candidate_ids:
        if uid in seen:
            continue
        seen.add(uid)
        u = db.get(User, uid)
        if u and not is_blocked_either_way(db, user.id, u.id):
            candidates.append(u)
        if len(candidates) >= 5:
            break

    if len(candidates) < 5:
        recent = db.query(User).order_by(User.created_at.desc()).limit(30).all()
        for u in recent:
            if len(candidates) >= 5:
                break
            if u.id == user.id or u.id in seen:
                continue
            if is_following(db, user.id, u.id) or is_blocked_either_way(db, user.id, u.id):
                continue
            seen.add(u.id)
            candidates.append(u)

    return [to_user_public(db, u, user.id) for u in candidates[:5]]


@router.get("/users/{username}", response_model=UserPublic)
def get_user_by_username(
    username: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    target = get_user_or_404(db, username, user.id)
    return to_user_public(db, target, user.id)


@router.get("/users/{username}/posts", response_model=Page[PostGridItem])
def get_user_posts(
    username: str,
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    target = get_user_or_404(db, username, user.id)
    assert_can_view_grid(db, user.id, target)
    stmt = select(Post).where(Post.author_id == target.id, Post.post_type != "reel")
    items, next_cursor = paginated_grid(db, stmt, cursor, clamp_limit(limit))
    return {"items": items, "next_cursor": next_cursor}


@router.get("/users/{username}/tagged", response_model=Page[PostGridItem])
def get_user_tagged(
    username: str,
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    target = get_user_or_404(db, username, user.id)
    assert_can_view_grid(db, user.id, target)
    stmt = (
        select(Post)
        .join(PostUserTag, PostUserTag.post_id == Post.id)
        .where(PostUserTag.user_id == target.id)
    )
    items, next_cursor = paginated_grid(db, stmt, cursor, clamp_limit(limit))
    return {"items": items, "next_cursor": next_cursor}


@router.get("/users/me/saved", response_model=Page[PostGridItem])
def get_my_saved(
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Post)
        .join(PostSave, PostSave.post_id == Post.id)
        .where(PostSave.user_id == user.id)
    )
    items, next_cursor = paginated_grid(db, stmt, cursor, clamp_limit(limit))
    return {"items": items, "next_cursor": next_cursor}


@router.get("/users/{username}/followers", response_model=Page[UserPublic])
def get_followers(
    username: str,
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    target = get_user_or_404(db, username, user.id)
    assert_can_view_grid(db, user.id, target)
    stmt = select(Follow).where(Follow.followee_id == target.id)
    rows, next_cursor = paginate_entities(
        db, stmt, created_at_col=Follow.created_at, id_col=Follow.follower_id,
        cursor=cursor, limit=clamp_limit(limit),
    )
    users = [db.get(User, r.follower_id) for r in rows]
    return {"items": [to_user_public(db, u, user.id) for u in users if u], "next_cursor": next_cursor}


@router.get("/users/{username}/following", response_model=Page[UserPublic])
def get_following(
    username: str,
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    target = get_user_or_404(db, username, user.id)
    assert_can_view_grid(db, user.id, target)
    stmt = select(Follow).where(Follow.follower_id == target.id)
    rows, next_cursor = paginate_entities(
        db, stmt, created_at_col=Follow.created_at, id_col=Follow.followee_id,
        cursor=cursor, limit=clamp_limit(limit),
    )
    users = [db.get(User, r.followee_id) for r in rows]
    return {"items": [to_user_public(db, u, user.id) for u in users if u], "next_cursor": next_cursor}
