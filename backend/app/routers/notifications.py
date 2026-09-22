from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Comment, Notification, Post, User
from app.schemas.common import OkResponse, Page
from app.schemas.notification import NotificationOut, NotificationReadIn, UnreadCountOut
from app.services.privacy import to_user_summary
from app.utils.filenames import to_public_url
from app.utils.pagination import clamp_limit, paginate_entities

router = APIRouter(tags=["notifications"])


def _to_notification_out(db: Session, n: Notification) -> dict:
    actor = db.get(User, n.actor_id)
    post_ref = None
    if n.post_id:
        post = db.get(Post, n.post_id)
        if post:
            media = sorted(post.media, key=lambda m: m.sort_order)
            thumb = to_public_url(media[0].file_path) if media else None
            post_ref = {"id": post.id, "thumbnail_url": thumb}

    comment_preview = None
    if n.comment_id:
        comment = db.get(Comment, n.comment_id)
        if comment:
            comment_preview = comment.text[:60]

    return {
        "id": n.id,
        "type": n.type,
        "actor": to_user_summary(actor),
        "post": post_ref,
        "comment_preview": comment_preview,
        "is_read": n.is_read,
        "created_at": n.created_at,
    }


@router.get("/notifications", response_model=Page[NotificationOut])
def get_notifications(
    cursor: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Notification).where(Notification.recipient_id == user.id)
    rows, next_cursor = paginate_entities(
        db, stmt, created_at_col=Notification.created_at, id_col=Notification.id,
        cursor=cursor, limit=clamp_limit(limit),
    )
    return {"items": [_to_notification_out(db, n) for n in rows], "next_cursor": next_cursor}


@router.post("/notifications/read", response_model=OkResponse)
def mark_notifications_read(
    payload: NotificationReadIn | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.recipient_id == user.id)
    if payload and payload.ids:
        query = query.filter(Notification.id.in_(payload.ids))
    query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.get("/notifications/unread-count", response_model=UnreadCountOut)
def get_unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = (
        db.query(Notification)
        .filter(Notification.recipient_id == user.id, Notification.is_read.is_(False))
        .count()
    )
    return {"count": count}
