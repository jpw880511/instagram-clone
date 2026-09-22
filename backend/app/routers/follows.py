from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Block, Follow, FollowRequest, User
from app.schemas.common import OkResponse
from app.schemas.user import FollowStatusOut
from app.services.notify import create_notification
from app.services.privacy import is_blocked_either_way, is_following

router = APIRouter(tags=["follows"])


def _get_target_or_404(db: Session, username: str) -> User:
    target = db.query(User).filter(User.username == username.lower()).first()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    return target


@router.post("/users/{username}/follow", response_model=FollowStatusOut)
def follow_user(username: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    target = _get_target_or_404(db, username)
    if target.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신을 팔로우할 수 없습니다.")
    if is_blocked_either_way(db, user.id, target.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="차단된 사용자입니다.")

    if is_following(db, user.id, target.id):
        db.commit()
        return {"follow_status": "following"}

    if target.is_private:
        exists = (
            db.query(FollowRequest)
            .filter(FollowRequest.requester_id == user.id, FollowRequest.requestee_id == target.id)
            .first()
        )
        if not exists:
            db.add(FollowRequest(requester_id=user.id, requestee_id=target.id))
            create_notification(db, recipient_id=target.id, actor_id=user.id, type_="follow_request")
        db.commit()
        return {"follow_status": "requested"}

    db.add(Follow(follower_id=user.id, followee_id=target.id))
    create_notification(db, recipient_id=target.id, actor_id=user.id, type_="follow")
    db.commit()
    return {"follow_status": "following"}


@router.delete("/users/{username}/follow", response_model=FollowStatusOut)
def unfollow_user(username: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    target = _get_target_or_404(db, username)
    db.query(Follow).filter(
        Follow.follower_id == user.id, Follow.followee_id == target.id
    ).delete()
    db.query(FollowRequest).filter(
        FollowRequest.requester_id == user.id, FollowRequest.requestee_id == target.id
    ).delete()
    db.commit()
    return {"follow_status": "none"}


@router.post("/follow-requests/{user_id}/accept", response_model=OkResponse)
def accept_follow_request(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    req = (
        db.query(FollowRequest)
        .filter(FollowRequest.requester_id == user_id, FollowRequest.requestee_id == user.id)
        .first()
    )
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="요청을 찾을 수 없습니다.")
    db.delete(req)
    db.add(Follow(follower_id=user_id, followee_id=user.id))
    create_notification(db, recipient_id=user_id, actor_id=user.id, type_="follow")
    db.commit()
    return {"ok": True}


@router.post("/follow-requests/{user_id}/reject", response_model=OkResponse)
def reject_follow_request(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(FollowRequest).filter(
        FollowRequest.requester_id == user_id, FollowRequest.requestee_id == user.id
    ).delete()
    db.commit()
    return {"ok": True}


@router.post("/users/{username}/block", response_model=OkResponse)
def block_user(username: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    target = _get_target_or_404(db, username)
    if target.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신을 차단할 수 없습니다.")

    exists = (
        db.query(Block)
        .filter(Block.blocker_id == user.id, Block.blocked_id == target.id)
        .first()
    )
    if not exists:
        db.add(Block(blocker_id=user.id, blocked_id=target.id))

    db.query(Follow).filter(
        ((Follow.follower_id == user.id) & (Follow.followee_id == target.id))
        | ((Follow.follower_id == target.id) & (Follow.followee_id == user.id))
    ).delete()
    db.query(FollowRequest).filter(
        ((FollowRequest.requester_id == user.id) & (FollowRequest.requestee_id == target.id))
        | ((FollowRequest.requester_id == target.id) & (FollowRequest.requestee_id == user.id))
    ).delete()
    db.commit()
    return {"ok": True}
