from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification

_DEDUPE_WINDOW = timedelta(hours=24)


def create_notification(
    db: Session,
    *,
    recipient_id: int,
    actor_id: int,
    type_: str,
    post_id: int | None = None,
    comment_id: int | None = None,
) -> None:
    """본인 액션은 알림을 만들지 않는다. 'like'는 24시간 내 동일 알림을 갱신(bump)한다."""
    if recipient_id == actor_id:
        return

    now = datetime.now(timezone.utc)

    if type_ == "like":
        stmt = select(Notification).where(
            Notification.recipient_id == recipient_id,
            Notification.actor_id == actor_id,
            Notification.type == "like",
            Notification.post_id == post_id,
            Notification.created_at >= now - _DEDUPE_WINDOW,
        )
        existing = db.scalars(stmt).first()
        if existing is not None:
            existing.created_at = now
            existing.is_read = False
            return

    db.add(
        Notification(
            recipient_id=recipient_id,
            actor_id=actor_id,
            type=type_,
            post_id=post_id,
            comment_id=comment_id,
        )
    )
