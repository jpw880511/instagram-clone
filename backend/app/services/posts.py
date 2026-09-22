from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Comment, Post, PostLike, PostSave, PostUserTag, User
from app.services.media import delete_upload_file
from app.services.privacy import to_user_summary
from app.utils.filenames import to_public_url
from app.utils.pagination import paginate_entities


def count_likes(db: Session, post_id: int) -> int:
    return db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)) or 0


def count_comments(db: Session, post_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Comment).where(Comment.post_id == post_id)) or 0


def is_liked_by(db: Session, post_id: int, viewer_id: int | None) -> bool:
    if viewer_id is None:
        return False
    stmt = select(PostLike.user_id).where(PostLike.post_id == post_id, PostLike.user_id == viewer_id)
    return db.scalar(stmt) is not None


def is_saved_by(db: Session, post_id: int, viewer_id: int | None) -> bool:
    if viewer_id is None:
        return False
    stmt = select(PostSave.user_id).where(PostSave.post_id == post_id, PostSave.user_id == viewer_id)
    return db.scalar(stmt) is not None


def to_grid_item(db: Session, post: Post) -> dict:
    media = sorted(post.media, key=lambda m: m.sort_order)
    thumb = media[0] if media else None
    return {
        "id": post.id,
        "thumbnail_url": to_public_url(thumb.file_path) if thumb else None,
        "like_count": count_likes(db, post.id),
        "comment_count": count_comments(db, post.id),
        "media_count": len(media),
        "post_type": post.post_type,
    }


def to_post_out(db: Session, post: Post, viewer_id: int | None) -> dict:
    author = db.get(User, post.author_id)
    media = sorted(post.media, key=lambda m: m.sort_order)
    tagged_rows = db.query(PostUserTag).filter(PostUserTag.post_id == post.id).all()
    tagged_users = [db.get(User, t.user_id) for t in tagged_rows]
    return {
        "id": post.id,
        "author": to_user_summary(author),
        "caption": post.caption,
        "location": post.location,
        "post_type": post.post_type,
        "created_at": post.created_at,
        "media": [
            {
                "id": m.id,
                "url": to_public_url(m.file_path),
                "media_type": m.media_type,
                "sort_order": m.sort_order,
                "width": m.width,
                "height": m.height,
            }
            for m in media
        ],
        "like_count": count_likes(db, post.id),
        "comment_count": count_comments(db, post.id),
        "liked": is_liked_by(db, post.id, viewer_id),
        "saved": is_saved_by(db, post.id, viewer_id),
        "tagged_users": [to_user_summary(u) for u in tagged_users if u],
    }


def delete_post_with_files(db: Session, post: Post) -> None:
    """DB에서 post를 지우기 전, 연결된 미디어 파일을 디스크에서 먼저 정리한다.

    본인 삭제(routers/posts.py)와 관리자 삭제(routers/admin.py) 양쪽에서 재사용한다.
    """
    for media in post.media:
        delete_upload_file(media.file_path)
    db.delete(post)


def paginated_grid(db: Session, stmt, cursor: str | None, limit: int) -> tuple[list[dict], str | None]:
    posts, next_cursor = paginate_entities(
        db, stmt, created_at_col=Post.created_at, id_col=Post.id, cursor=cursor, limit=limit
    )
    return [to_grid_item(db, p) for p in posts], next_cursor


def paginated_post_out(
    db: Session, stmt, cursor: str | None, limit: int, viewer_id: int | None
) -> tuple[list[dict], str | None]:
    posts, next_cursor = paginate_entities(
        db, stmt, created_at_col=Post.created_at, id_col=Post.id, cursor=cursor, limit=limit
    )
    return [to_post_out(db, p, viewer_id) for p in posts], next_cursor
