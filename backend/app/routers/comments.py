from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Comment, CommentLike, Post, User
from app.schemas.comment import CommentIn, CommentLikeOut, CommentOut
from app.schemas.common import OkResponse, Page
from app.services.caption import extract_mentions
from app.services.notify import create_notification
from app.services.privacy import can_view_profile, to_user_summary
from app.utils.pagination import clamp_limit, paginate_entities

router = APIRouter(tags=["comments"])


def _reply_count(db: Session, comment_id: int) -> int:
    return db.query(Comment).filter(Comment.parent_id == comment_id).count()


def _like_count(db: Session, comment_id: int) -> int:
    return db.query(CommentLike).filter(CommentLike.comment_id == comment_id).count()


def _is_liked(db: Session, comment_id: int, user_id: int) -> bool:
    return (
        db.query(CommentLike)
        .filter(CommentLike.comment_id == comment_id, CommentLike.user_id == user_id)
        .first()
        is not None
    )


def _to_comment_out(db: Session, comment: Comment, viewer_id: int) -> dict:
    author = db.get(User, comment.author_id)
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "author": to_user_summary(author),
        "parent_id": comment.parent_id,
        "text": comment.text,
        "created_at": comment.created_at,
        "like_count": _like_count(db, comment.id),
        "liked": _is_liked(db, comment.id, viewer_id),
        "reply_count": _reply_count(db, comment.id),
    }


def _get_post_visible_or_404(db: Session, post_id: int, viewer_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="게시물을 찾을 수 없습니다.")
    author = db.get(User, post.author_id)
    if not can_view_profile(db, viewer_id, author):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 계정의 게시물을 볼 수 없습니다.")
    return post


@router.get("/posts/{post_id}/comments", response_model=Page[CommentOut])
def get_comments(
    post_id: int,
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_post_visible_or_404(db, post_id, user.id)
    stmt = select(Comment).where(Comment.post_id == post_id, Comment.parent_id.is_(None))
    rows, next_cursor = paginate_entities(
        db, stmt, created_at_col=Comment.created_at, id_col=Comment.id,
        cursor=cursor, limit=clamp_limit(limit),
    )
    return {"items": [_to_comment_out(db, c, user.id) for c in rows], "next_cursor": next_cursor}


@router.get("/comments/{comment_id}/replies", response_model=list[CommentOut])
def get_replies(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    replies = (
        db.query(Comment)
        .filter(Comment.parent_id == comment_id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
        .all()
    )
    return [_to_comment_out(db, c, user.id) for c in replies]


@router.post("/posts/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: int,
    payload: CommentIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = _get_post_visible_or_404(db, post_id, user.id)

    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.get(Comment, parent_id)
        if parent is None or parent.post_id != post_id or parent.parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="같은 게시물의 최상위 댓글에만 답글을 달 수 있습니다.",
            )

    comment = Comment(post_id=post_id, author_id=user.id, parent_id=parent_id, text=payload.text)
    db.add(comment)
    db.flush()

    create_notification(
        db, recipient_id=post.author_id, actor_id=user.id, type_="comment", post_id=post_id, comment_id=comment.id
    )
    for uname in extract_mentions(payload.text):
        mentioned = db.query(User).filter(User.username == uname).first()
        if mentioned:
            create_notification(
                db, recipient_id=mentioned.id, actor_id=user.id, type_="mention", post_id=post_id
            )

    db.commit()
    db.refresh(comment)
    return _to_comment_out(db, comment, user.id)


@router.delete("/comments/{comment_id}", response_model=OkResponse)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="댓글을 찾을 수 없습니다.")
    post = db.get(Post, comment.post_id)
    if comment.author_id != user.id and (post is None or post.author_id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다.")
    db.delete(comment)
    db.commit()
    return {"ok": True}


@router.post("/comments/{comment_id}/like", response_model=CommentLikeOut)
def like_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.get(Comment, comment_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="댓글을 찾을 수 없습니다.")
    if not _is_liked(db, comment_id, user.id):
        db.add(CommentLike(comment_id=comment_id, user_id=user.id))
    db.commit()
    return {"liked": True}


@router.delete("/comments/{comment_id}/like", response_model=CommentLikeOut)
def unlike_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(CommentLike).filter(
        CommentLike.comment_id == comment_id, CommentLike.user_id == user.id
    ).delete()
    db.commit()
    return {"liked": False}
