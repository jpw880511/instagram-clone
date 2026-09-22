from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import get_current_user, get_db
from app.models import Follow, Story, StoryView, User
from app.schemas.common import OkResponse
from app.schemas.story import StoryOut, StoryTrayItem, StoryViewerOut
from app.services.media import save_upload_file
from app.services.privacy import can_view_profile, to_user_summary
from app.utils.filenames import avatar_url, to_public_url

router = APIRouter(tags=["stories"])


def _active_stories(db: Session, author_id: int) -> list[Story]:
    now = datetime.now(timezone.utc)
    return (
        db.query(Story)
        .filter(Story.author_id == author_id, Story.expires_at > now)
        .order_by(Story.created_at.asc())
        .all()
    )


def _has_viewed(db: Session, story_id: int, viewer_id: int) -> bool:
    return (
        db.query(StoryView)
        .filter(StoryView.story_id == story_id, StoryView.user_id == viewer_id)
        .first()
        is not None
    )


@router.get("/stories/tray", response_model=list[StoryTrayItem])
def get_story_tray(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    following_ids = [
        r[0] for r in db.query(Follow.followee_id).filter(Follow.follower_id == user.id).all()
    ]
    candidate_ids = [user.id, *following_ids]

    groups: list[dict] = []
    for uid in candidate_ids:
        stories = _active_stories(db, uid)
        if uid != user.id and not stories:
            continue
        has_unseen = uid != user.id and any(not _has_viewed(db, s.id, user.id) for s in stories)
        latest_at = stories[-1].created_at if stories else None
        u = db.get(User, uid)
        groups.append(
            {
                "user": to_user_summary(u),
                "has_unseen": has_unseen,
                "latest_at": latest_at,
                "story_count": len(stories),
                "_is_me": uid == user.id,
            }
        )

    groups.sort(
        key=lambda g: (
            0 if g["_is_me"] else 1,
            0 if g["has_unseen"] else 1,
            -(g["latest_at"].timestamp() if g["latest_at"] else 0),
        )
    )
    for g in groups:
        g.pop("_is_me", None)
    return groups


@router.get("/stories/user/{username}", response_model=list[StoryOut])
def get_user_stories(username: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    target = db.query(User).filter(User.username == username.lower()).first()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    if not can_view_profile(db, user.id, target):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="스토리를 볼 수 없습니다.")

    stories = _active_stories(db, target.id)
    author_summary = to_user_summary(target)
    return [
        {
            "id": s.id,
            "author": author_summary,
            "url": to_public_url(s.file_path),
            "media_type": s.media_type,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "viewed": _has_viewed(db, s.id, user.id),
        }
        for s in stories
    ]


@router.post("/stories", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
async def create_story(
    file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    relative_path, media_type = await save_upload_file(file, "stories")
    now = datetime.now(timezone.utc)
    story = Story(
        author_id=user.id,
        file_path=relative_path,
        media_type=media_type,
        expires_at=now + timedelta(hours=settings.story_ttl_hours),
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return {
        "id": story.id,
        "author": to_user_summary(user),
        "url": to_public_url(story.file_path),
        "media_type": story.media_type,
        "created_at": story.created_at,
        "expires_at": story.expires_at,
        "viewed": False,
    }


@router.post("/stories/{story_id}/view", response_model=OkResponse)
def view_story(story_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    story = db.get(Story, story_id)
    if story is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="스토리를 찾을 수 없습니다.")
    if story.author_id != user.id and not _has_viewed(db, story_id, user.id):
        db.add(StoryView(story_id=story_id, user_id=user.id))
        db.commit()
    return {"ok": True}


@router.get("/stories/{story_id}/viewers", response_model=list[StoryViewerOut])
def get_story_viewers(story_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    story = db.get(Story, story_id)
    if story is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="스토리를 찾을 수 없습니다.")
    if story.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인만 조회할 수 있습니다.")

    views = db.query(StoryView).filter(StoryView.story_id == story_id).all()
    result = []
    for v in views:
        viewer = db.get(User, v.user_id)
        if viewer:
            result.append(
                {
                    "id": viewer.id,
                    "username": viewer.username,
                    "avatar_url": avatar_url(viewer.avatar_path),
                    "viewed_at": v.viewed_at,
                }
            )
    return result
