import base64
from datetime import datetime, timezone

from sqlalchemy import Select
from sqlalchemy.orm import Session

DEFAULT_LIMIT = 20
MAX_LIMIT = 50


def clamp_limit(limit: int | None, default: int = DEFAULT_LIMIT) -> int:
    if not limit or limit <= 0:
        return default
    return min(limit, MAX_LIMIT)


def encode_cursor(created_at: datetime, id_: int) -> str:
    raw = f"{created_at.isoformat()}|{id_}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
    created_at_str, id_str = raw.rsplit("|", 1)
    created_at = datetime.fromisoformat(created_at_str)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return created_at, int(id_str)


def paginate_entities(
    db: Session,
    stmt: Select,
    *,
    created_at_col,
    id_col,
    cursor: str | None,
    limit: int,
) -> tuple[list, str | None]:
    """(created_at, id) 커서 기반 페이지네이션. entity 단위 select에 사용한다.

    backend.md §3.3: 커서는 `{created_at}|{id}`를 URL-safe 인코딩한 불투명 문자열이고,
    `next_cursor`는 현재 페이지 마지막 항목을 가리킨다(그다음 항목이 아님).
    """
    if cursor:
        c_created, c_id = decode_cursor(cursor)
        stmt = stmt.where(
            (created_at_col < c_created) | ((created_at_col == c_created) & (id_col < c_id))
        )
    stmt = stmt.order_by(created_at_col.desc(), id_col.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())

    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = None
    if has_more and page:
        last = page[-1]
        next_cursor = encode_cursor(getattr(last, created_at_col.key), getattr(last, id_col.key))
    return page, next_cursor
