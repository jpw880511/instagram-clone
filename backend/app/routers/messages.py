from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import Conversation, ConversationMember, Message, User
from app.schemas.common import OkResponse
from app.schemas.notification import UnreadCountOut
from app.schemas.message import ConversationCreateIn, ConversationOut, MessageOut, MessagesPage
from app.services.media import save_upload_file
from app.services.privacy import is_blocked_either_way, to_user_summary
from app.utils.filenames import to_public_url

router = APIRouter(tags=["messages"])


def _conv_key(a_id: int, b_id: int) -> tuple[int, int]:
    return (a_id, b_id) if a_id < b_id else (b_id, a_id)


def _other_user_id(conv: Conversation, me_id: int) -> int:
    return conv.user_high_id if conv.user_low_id == me_id else conv.user_low_id


def _to_conversation_out(db: Session, conv: Conversation, me_id: int) -> dict:
    other_id = _other_user_id(conv, me_id)
    other = db.get(User, other_id)
    last = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.id.desc())
        .first()
    )
    member = (
        db.query(ConversationMember)
        .filter(ConversationMember.conversation_id == conv.id, ConversationMember.user_id == me_id)
        .first()
    )
    last_read = member.last_read_message_id if member and member.last_read_message_id else 0
    unread = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id, Message.sender_id != me_id, Message.id > last_read)
        .count()
    )
    return {
        "id": conv.id,
        "other_user": to_user_summary(other),
        "last_message": (
            {
                "id": last.id,
                "text": last.text,
                "kind": last.kind,
                "sender_id": last.sender_id,
                "created_at": last.created_at,
            }
            if last
            else None
        ),
        "unread_count": unread,
        "updated_at": conv.updated_at,
        "is_blocked": is_blocked_either_way(db, me_id, other_id),
    }


def _to_message_out(m: Message) -> dict:
    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "sender_id": m.sender_id,
        "kind": m.kind,
        "text": m.text,
        # DB엔 상대경로로 저장되지만(§3.4), 응답의 file_path는 ChatPane.jsx가 <img src=...>로
        # 바로 렌더링하는 절대 URL이어야 한다 — backend.md §4.11 참고.
        "file_path": to_public_url(m.file_path) if m.file_path else None,
        "story_id": m.story_id,
        "created_at": m.created_at,
    }


@router.get("/conversations", response_model=list[ConversationOut])
def get_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    convs = (
        db.query(Conversation)
        .filter((Conversation.user_low_id == user.id) | (Conversation.user_high_id == user.id))
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [_to_conversation_out(db, c, user.id) for c in convs]


@router.get("/conversations/unread-count", response_model=UnreadCountOut)
def get_unread_conversation_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """안 읽은 메시지가 있는 대화 수 — 사이드바 메시지 아이콘의 빨간 배지용."""
    convs = (
        db.query(Conversation)
        .filter((Conversation.user_low_id == user.id) | (Conversation.user_high_id == user.id))
        .all()
    )
    count = sum(1 for c in convs if _to_conversation_out(db, c, user.id)["unread_count"] > 0)
    return {"count": count}


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    target = db.get(User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    if is_blocked_either_way(db, user.id, target.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="차단된 사용자입니다.")

    low, high = _conv_key(user.id, target.id)
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_low_id == low, Conversation.user_high_id == high)
        .first()
    )
    if conv is None:
        conv = Conversation(user_low_id=low, user_high_id=high)
        db.add(conv)
        db.flush()
        db.add(ConversationMember(conversation_id=conv.id, user_id=user.id))
        db.add(ConversationMember(conversation_id=conv.id, user_id=target.id))
        db.commit()
        db.refresh(conv)
    return _to_conversation_out(db, conv, user.id)


def _get_conversation_or_404(db: Session, conversation_id: int, me_id: int) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None or (conv.user_low_id != me_id and conv.user_high_id != me_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="대화를 찾을 수 없습니다.")
    return conv


@router.get("/conversations/{conversation_id}/messages", response_model=MessagesPage)
def get_messages(
    conversation_id: int,
    after_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_conversation_or_404(db, conversation_id, user.id)
    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    if after_id:
        query = query.filter(Message.id > after_id)
    messages = query.order_by(Message.id.asc()).all()
    return {"items": [_to_message_out(m) for m in messages]}


@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = _get_conversation_or_404(db, conversation_id, user.id)
    other_id = _other_user_id(conv, user.id)
    if is_blocked_either_way(db, user.id, other_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="차단된 사용자에게 메시지를 보낼 수 없습니다.")

    content_type = request.headers.get("content-type", "")
    text = ""
    kind = "text"
    story_id: int | None = None
    file_path: str | None = None

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        kind = str(form.get("kind") or "image")
        text = str(form.get("text") or "")
        upload = form.get("file")
        if upload is not None:
            file_path, _media_type = await save_upload_file(upload, "messages")
    else:
        body = await request.json() if await request.body() else {}
        text = body.get("text") or ""
        kind = body.get("kind") or "text"
        story_id = body.get("story_id")

    if kind not in ("text", "image", "story_reply"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="kind가 올바르지 않습니다.")
    if kind != "image" and not text.strip() and not story_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="메시지 내용이 없습니다.")

    message = Message(
        conversation_id=conversation_id,
        sender_id=user.id,
        kind=kind,
        text=text,
        file_path=file_path,
        story_id=story_id,
    )
    db.add(message)
    db.flush()  # message.created_at(콜러블 default)을 확정시켜야 conv.updated_at에 복사할 수 있다
    conv.updated_at = message.created_at
    db.commit()
    db.refresh(message)
    return _to_message_out(message)


@router.post("/conversations/{conversation_id}/read", response_model=OkResponse)
def mark_conversation_read(
    conversation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    _get_conversation_or_404(db, conversation_id, user.id)
    last = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .first()
    )
    member = (
        db.query(ConversationMember)
        .filter(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user.id)
        .first()
    )
    if member is None:
        member = ConversationMember(conversation_id=conversation_id, user_id=user.id)
        db.add(member)
    member.last_read_message_id = last.id if last else None
    db.commit()
    return {"ok": True}
