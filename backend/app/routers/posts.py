import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Hashtag, Post, PostHashtag, PostLike, PostMedia, PostSave, PostUserTag, User
from app.schemas.common import OkResponse
from app.schemas.post import LikeToggleOut, PostOut, SaveToggleOut
from app.schemas.user import UserPublic
from app.services.caption import extract_hashtags, extract_mentions
from app.services.media import save_upload_file
from app.services.notify import create_notification
from app.services.posts import count_likes, delete_post_with_files, to_post_out
from app.services.privacy import can_view_profile, to_user_public

router = APIRouter(tags=["posts"])


def _sync_hashtags(db: Session, post: Post, caption: str) -> None:
    db.query(PostHashtag).filter(PostHashtag.post_id == post.id).delete()
    for name in extract_hashtags(caption):
        tag = db.query(Hashtag).filter(Hashtag.name == name).first()
        if tag is None:
            tag = Hashtag(name=name)
            db.add(tag)
            db.flush()
        db.add(PostHashtag(post_id=post.id, hashtag_id=tag.id))


def _notify_mentions(db: Session, caption: str, actor: User, post_id: int) -> None:
    for uname in extract_mentions(caption):
        mentioned = db.query(User).filter(User.username == uname).first()
        if mentioned:
            create_notification(
                db, recipient_id=mentioned.id, actor_id=actor.id, type_="mention", post_id=post_id
            )


@router.post("/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    files: list[UploadFile] = File(...),
    caption: str = Form(""),
    location: str = Form(""),
    post_type: str = Form("post"),
    tagged_usernames: str = Form("[]"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if post_type not in ("post", "reel"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="post_type이 올바르지 않습니다.")
    if not files:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="파일을 1개 이상 업로드하세요.")
    if len(files) > 10:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="파일은 최대 10개입니다.")
    if post_type == "reel" and len(files) != 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="릴스는 파일 1개만 허용됩니다.")

    try:
        tagged_list = json.loads(tagged_usernames) if tagged_usernames else []
    except (json.JSONDecodeError, TypeError):
        tagged_list = []

    post = Post(author_id=user.id, caption=caption, location=location, post_type=post_type)
    db.add(post)
    db.flush()

    for index, file in enumerate(files):
        relative_path, media_type = await save_upload_file(file, "posts")
        db.add(
            PostMedia(
                post_id=post.id, file_path=relative_path, media_type=media_type, sort_order=index
            )
        )

    _sync_hashtags(db, post, caption)
    _notify_mentions(db, caption, user, post.id)

    for uname in tagged_list:
        tagged_user = db.query(User).filter(User.username == str(uname).lower()).first()
        if tagged_user:
            db.add(PostUserTag(post_id=post.id, user_id=tagged_user.id))
            create_notification(
                db, recipient_id=tagged_user.id, actor_id=user.id, type_="tag", post_id=post.id
            )

    db.commit()
    db.refresh(post)
    return to_post_out(db, post, user.id)


def _get_post_or_404(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="게시물을 찾을 수 없습니다.")
    return post


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    post = _get_post_or_404(db, post_id)
    author = db.get(User, post.author_id)
    if not can_view_profile(db, user.id, author):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 계정의 게시물을 볼 수 없습니다.")
    return to_post_out(db, post, user.id)


@router.delete("/posts/{post_id}", response_model=OkResponse)
def delete_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    post = _get_post_or_404(db, post_id)
    if post.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인 게시물만 삭제할 수 있습니다.")
    delete_post_with_files(db, post)
    db.commit()
    return {"ok": True}


@router.post("/posts/{post_id}/like", response_model=LikeToggleOut)
def like_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    post = _get_post_or_404(db, post_id)
    exists = (
        db.query(PostLike).filter(PostLike.post_id == post_id, PostLike.user_id == user.id).first()
    )
    if not exists:
        db.add(PostLike(post_id=post_id, user_id=user.id))
        create_notification(db, recipient_id=post.author_id, actor_id=user.id, type_="like", post_id=post_id)
    db.commit()
    return {"liked": True, "like_count": count_likes(db, post_id)}


@router.delete("/posts/{post_id}/like", response_model=LikeToggleOut)
def unlike_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_post_or_404(db, post_id)
    db.query(PostLike).filter(PostLike.post_id == post_id, PostLike.user_id == user.id).delete()
    db.commit()
    return {"liked": False, "like_count": count_likes(db, post_id)}


@router.post("/posts/{post_id}/save", response_model=SaveToggleOut)
def save_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_post_or_404(db, post_id)
    exists = (
        db.query(PostSave).filter(PostSave.post_id == post_id, PostSave.user_id == user.id).first()
    )
    if not exists:
        db.add(PostSave(post_id=post_id, user_id=user.id))
    db.commit()
    return {"saved": True}


@router.delete("/posts/{post_id}/save", response_model=SaveToggleOut)
def unsave_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_post_or_404(db, post_id)
    db.query(PostSave).filter(PostSave.post_id == post_id, PostSave.user_id == user.id).delete()
    db.commit()
    return {"saved": False}


@router.get("/posts/{post_id}/likers", response_model=list[UserPublic])
def get_likers(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_post_or_404(db, post_id)
    rows = db.query(PostLike).filter(PostLike.post_id == post_id).all()
    users = [db.get(User, r.user_id) for r in rows]
    return [to_user_public(db, u, user.id) for u in users if u]
