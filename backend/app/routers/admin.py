import hmac

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import get_current_admin, get_db
from app.models import Post, User
from app.schemas.admin import (
    AdminLoginIn,
    AdminPostsPage,
    AdminStatsOut,
    AdminTokenOut,
    AdminUsersPage,
)
from app.schemas.common import OkResponse
from app.services.admin import compute_stats, delete_user_cascade
from app.services.posts import count_comments, count_likes, delete_post_with_files
from app.services.privacy import follower_count, post_count
from app.utils.filenames import to_public_url
from app.utils.security import create_admin_token

router = APIRouter(prefix="/admin", tags=["admin"])


def _sort_key(value):
    """대소문자 구분 없이 정렬되도록 문자열만 소문자로 내린다."""
    return value.lower() if isinstance(value, str) else value


def _sort_and_page(items: list[dict], sort: str, order: str, allowed: set[str], limit: int, offset: int):
    if sort not in allowed:
        sort = "created_at"
    items.sort(key=lambda it: _sort_key(it[sort]), reverse=(order != "asc"))
    total = len(items)
    return items[offset : offset + limit], total


@router.post("/login", response_model=AdminTokenOut)
def admin_login(payload: AdminLoginIn):
    valid = hmac.compare_digest(payload.username, settings.admin_username) and hmac.compare_digest(
        payload.password, settings.admin_password
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 올바르지 않습니다."
        )
    return {"access_token": create_admin_token(), "token_type": "bearer"}


@router.get("/stats", response_model=AdminStatsOut, dependencies=[Depends(get_current_admin)])
def admin_stats(db: Session = Depends(get_db)):
    return compute_stats(db)


_USER_SORT_KEYS = {"id", "username", "email", "full_name", "created_at", "post_count", "follower_count", "is_private"}


@router.get("/users", response_model=AdminUsersPage, dependencies=[Depends(get_current_admin)])
def admin_list_users(
    q: str = Query(""),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.filter(
            (User.username.like(like)) | (User.email.like(like)) | (func.lower(User.full_name).like(like))
        )

    rows = query.all()
    items = [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "is_private": u.is_private,
            "created_at": u.created_at,
            "post_count": post_count(db, u.id),
            "follower_count": follower_count(db, u.id),
        }
        for u in rows
    ]
    page, total = _sort_and_page(items, sort, order, _USER_SORT_KEYS, limit, offset)
    return {"items": page, "total": total, "limit": limit, "offset": offset}


@router.delete("/users/{user_id}", response_model=OkResponse, dependencies=[Depends(get_current_admin)])
def admin_delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    delete_user_cascade(db, user)
    db.commit()
    return {"ok": True}


_POST_SORT_KEYS = {"id", "author_username", "caption", "post_type", "created_at", "like_count", "comment_count"}


@router.get("/posts", response_model=AdminPostsPage, dependencies=[Depends(get_current_admin)])
def admin_list_posts(
    q: str = Query(""),
    author: str = Query(""),
    post_type: str = Query(""),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Post)
    if q.strip():
        query = query.filter(func.lower(Post.caption).like(f"%{q.strip().lower()}%"))
    if post_type in ("post", "reel"):
        query = query.filter(Post.post_type == post_type)
    rows = query.all()

    author_needle = author.strip().lower()
    items = []
    for p in rows:
        post_author = db.get(User, p.author_id)
        author_username = post_author.username if post_author else "(알 수 없음)"
        if author_needle and author_needle not in author_username.lower():
            continue
        media = sorted(p.media, key=lambda m: m.sort_order)
        thumb = to_public_url(media[0].file_path) if media else None
        items.append(
            {
                "id": p.id,
                "author_id": p.author_id,
                "author_username": author_username,
                "caption": p.caption,
                "post_type": p.post_type,
                "created_at": p.created_at,
                "like_count": count_likes(db, p.id),
                "comment_count": count_comments(db, p.id),
                "thumbnail_url": thumb,
            }
        )

    page, total = _sort_and_page(items, sort, order, _POST_SORT_KEYS, limit, offset)
    return {"items": page, "total": total, "limit": limit, "offset": offset}


@router.delete("/posts/{post_id}", response_model=OkResponse, dependencies=[Depends(get_current_admin)])
def admin_delete_post(post_id: int, db: Session = Depends(get_db)):
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="게시물을 찾을 수 없습니다.")
    delete_post_with_files(db, post)
    db.commit()
    return {"ok": True}
