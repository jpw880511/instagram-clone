"""데모 데이터 시드 스크립트.

    cd backend
    python -m app.seed

frontend/src/mocks/seed.js와 같은 계정 구성(사용자 9명, 팔로우/팔로우요청, 게시물,
댓글/대댓글, 좋아요, 저장, 사람 태그, 스토리, 알림 6종, 대화+메시지)을 채워서
mock에서 실제 API로 전환해도 데모 화면이 그대로 보이게 한다(backend.md §7).

실행 전 DB가 비어 있지 않으면(이미 시드했으면) 아무 것도 하지 않고 종료한다 —
개발 중 반복 실행해도 중복 데이터가 쌓이지 않는다.
"""

import struct
import sys
import zlib
from datetime import datetime, timedelta, timezone

from app import models as m
from app.database import Base, SessionLocal, engine
from app.config import settings
from app.services.caption import extract_hashtags, extract_mentions
from app.utils.security import hash_password
import os


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- 자리표시 이미지 (외부 의존성 없이 순수 파이썬으로 PNG 생성) ----------


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))


def make_solid_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    row = b"\x00" + bytes(rgb) * width
    idat = zlib.compress(row * height)
    return sig + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", idat) + _png_chunk(b"IEND", b"")


_PALETTE = [
    (240, 128, 128), (135, 206, 235), (144, 238, 144), (255, 218, 185),
    (221, 160, 221), (255, 228, 181), (176, 224, 230), (255, 182, 193),
]


def _write_seed_image(subdir: str, name: str, color_index: int, size=(600, 600)) -> str:
    relative_path = f"{subdir}/seed-{name}.png"
    dest = os.path.join(settings.upload_dir, subdir, f"seed-{name}.png")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(make_solid_png(size[0], size[1], _PALETTE[color_index % len(_PALETTE)]))
    return relative_path


# ---------- 사용자 ----------

USERS = [
    dict(username="demo", email="demo@example.com", password="demo1234", full_name="데모 계정",
         bio="Gram 클론 데모 계정입니다\n피드를 자유롭게 눌러보세요.", website="https://example.com", is_private=False),
    dict(username="alex", email="alex@example.com", password="alex1234", full_name="Alex Kim",
         bio="여행 · 사진 · 커피", website="", is_private=False),
    dict(username="sam", email="sam@example.com", password="sam1234", full_name="Sam Park",
         bio="비공개 계정입니다.", website="", is_private=True),
    dict(username="mia.j", email="mia@example.com", password="mia12345", full_name="Mia Jung",
         bio="일상 기록", website="", is_private=False),
    dict(username="noah", email="noah@example.com", password="noah1234", full_name="Noah Lee",
         bio="러닝 · 등산", website="", is_private=False),
    dict(username="olivia", email="olivia@example.com", password="olivia123", full_name="Olivia Cho",
         bio="요리 그리고 강아지", website="https://olivia.example.com", is_private=False),
    dict(username="jin", email="jin@example.com", password="jin12345", full_name="Jin Ho",
         bio="", website="", is_private=False),
    dict(username="liam", email="liam@example.com", password="liam1234", full_name="Liam Song",
         bio="음악", website="", is_private=False),
    dict(username="test", email="test@gmail.com", password="12345", full_name="테스트 계정",
         bio="QA용 테스트 계정입니다.", website="", is_private=False),
]

# (follower, followee)
FOLLOWS = [
    ("demo", "alex"), ("alex", "demo"),
    ("mia.j", "demo"), ("demo", "noah"), ("demo", "olivia"),
    ("alex", "mia.j"), ("noah", "alex"), ("olivia", "alex"), ("jin", "alex"),
    ("liam", "demo"), ("test", "demo"), ("test", "alex"), ("mia.j", "test"),
]

# (requester, requestee) — sam은 비공개라 demo의 팔로우는 요청 상태로 남는다.
FOLLOW_REQUESTS = [("demo", "sam")]

# (author, caption, post_type, tagged_usernames)
POSTS = [
    ("demo", "오늘 노을이 미쳤다 #sunset @alex 와 함께", "post", ["alex"]),
    ("demo", "새로 산 카메라 테스트 #camera #test", "post", []),
    ("alex", "제주도 여행 마지막 날 #jeju #travel", "post", []),
    ("alex", "커피 한 잔의 여유", "post", []),
    ("alex", "짧은 브이로그", "reel", []),
    ("mia.j", "주말 브런치 @demo 도 같이!", "post", ["demo"]),
    ("mia.j", "우리집 고양이 #cat #cute", "post", []),
    ("noah", "한강 러닝 완주 #running #healthy", "post", []),
    ("noah", "주말 등산", "post", []),
    ("olivia", "오늘의 저녁 메뉴 #cooking #dinner", "post", []),
    ("olivia", "우리 강아지 산책", "reel", []),
    ("jin", "출근길 스냅 #ootd", "post", []),
    ("liam", "합주 영상 #music #guitar", "post", []),
    ("test", "테스트 계정에서 작성한 첫 게시물입니다 #test @demo", "post", ["demo"]),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(m.User).count() > 0:
        print("이미 데이터가 있어 시드를 건너뜁니다 (instagram.db를 지우고 다시 실행하세요).")
        db.close()
        return

    users: dict[str, m.User] = {}
    for u in USERS:
        avatar_path = _write_seed_image("avatars", u["username"].replace(".", "-"), len(users), size=(150, 150))
        user = m.User(
            email=u["email"],
            username=u["username"],
            hashed_password=hash_password(u["password"]),
            full_name=u["full_name"],
            bio=u["bio"],
            website=u["website"],
            avatar_path=avatar_path,
            is_private=u["is_private"],
        )
        db.add(user)
        users[u["username"]] = user
    db.flush()

    for follower, followee in FOLLOWS:
        db.add(m.Follow(follower_id=users[follower].id, followee_id=users[followee].id))

    for requester, requestee in FOLLOW_REQUESTS:
        db.add(m.FollowRequest(requester_id=users[requester].id, requestee_id=users[requestee].id))
    db.flush()

    hashtags: dict[str, m.Hashtag] = {}
    posts: list[m.Post] = []
    for i, (author, caption, post_type, tagged) in enumerate(POSTS):
        post = m.Post(
            author_id=users[author].id,
            caption=caption,
            location="Seoul, Korea" if i % 3 == 0 else "",
            post_type=post_type,
            created_at=_now() - timedelta(hours=2 * (i + 1)),
        )
        db.add(post)
        db.flush()

        media_count = 2 if i in (2,) else 1
        for slot in range(media_count):
            relative_path = _write_seed_image("posts", f"{post.id}-{slot}", post.id + slot)
            db.add(
                m.PostMedia(
                    post_id=post.id,
                    file_path=relative_path,
                    media_type="video" if post_type == "reel" else "image",
                    sort_order=slot,
                )
            )

        for name in extract_hashtags(caption):
            tag = hashtags.get(name)
            if tag is None:
                tag = m.Hashtag(name=name)
                db.add(tag)
                db.flush()
                hashtags[name] = tag
            db.add(m.PostHashtag(post_id=post.id, hashtag_id=tag.id))

        for uname in extract_mentions(caption):
            if uname in users and uname != author:
                db.add(m.Notification(recipient_id=users[uname].id, actor_id=users[author].id, type="mention", post_id=post.id))

        for uname in tagged:
            if uname in users:
                db.add(m.PostUserTag(post_id=post.id, user_id=users[uname].id))
                db.add(m.Notification(recipient_id=users[uname].id, actor_id=users[author].id, type="tag", post_id=post.id))

        posts.append(post)
    db.flush()

    def post_of(author: str, nth: int = 0) -> m.Post:
        matches = [p for p in posts if p.author_id == users[author].id]
        return matches[nth]

    # 댓글 + 대댓글 1건
    c1 = m.Comment(post_id=post_of("demo", 0).id, author_id=users["alex"].id, text="완전 예쁘다")
    db.add(c1)
    db.flush()
    db.add(m.Comment(post_id=post_of("demo", 0).id, author_id=users["mia.j"].id, text="어디에요 저기?!"))
    db.add(m.Comment(post_id=post_of("demo", 0).id, author_id=users["demo"].id, parent_id=c1.id, text="한강이야!"))
    db.add(m.Comment(post_id=post_of("alex", 0).id, author_id=users["demo"].id, text="다음엔 같이 가자"))
    db.add(m.Notification(recipient_id=users["demo"].id, actor_id=users["alex"].id, type="comment", post_id=post_of("demo", 0).id, comment_id=c1.id))
    db.flush()
    db.add(m.CommentLike(comment_id=c1.id, user_id=users["demo"].id))

    # 좋아요 / 저장
    db.add(m.PostLike(post_id=post_of("demo", 0).id, user_id=users["alex"].id))
    db.add(m.PostLike(post_id=post_of("demo", 0).id, user_id=users["mia.j"].id))
    db.add(m.PostLike(post_id=post_of("alex", 0).id, user_id=users["demo"].id))
    db.add(m.Notification(recipient_id=users["demo"].id, actor_id=users["alex"].id, type="like", post_id=post_of("demo", 0).id))
    db.add(m.PostSave(post_id=post_of("alex", 0).id, user_id=users["demo"].id))

    # 스토리: alex 1건(유효), demo 1건(유효) — 조회 기록 하나
    story = m.Story(
        author_id=users["alex"].id,
        file_path=_write_seed_image("stories", "alex-1", 3, size=(720, 1280)),
        media_type="image",
        expires_at=_now() + timedelta(hours=21),
    )
    db.add(story)
    db.flush()
    db.add(m.StoryView(story_id=story.id, user_id=users["demo"].id))

    # 알림: follow, follow_request 도 명시적으로 추가해 6종을 전부 채운다.
    db.add(m.Notification(recipient_id=users["demo"].id, actor_id=users["mia.j"].id, type="follow"))
    db.add(m.Notification(recipient_id=users["sam"].id, actor_id=users["demo"].id, type="follow_request"))

    # 대화 + 메시지
    low, high = sorted((users["demo"].id, users["alex"].id))
    conv = m.Conversation(user_low_id=low, user_high_id=high)
    db.add(conv)
    db.flush()
    db.add(m.ConversationMember(conversation_id=conv.id, user_id=users["demo"].id))
    db.add(m.ConversationMember(conversation_id=conv.id, user_id=users["alex"].id))
    db.add(m.Message(conversation_id=conv.id, sender_id=users["alex"].id, kind="text", text="오늘 저녁에 시간 돼?"))
    db.add(m.Message(conversation_id=conv.id, sender_id=users["demo"].id, kind="text", text="응 좋아 몇 시에 볼까?"))
    db.flush()
    conv.updated_at = _now()

    db.commit()
    db.close()

    print(f"시드 완료: 사용자 {len(users)}명, 게시물 {len(posts)}개")
    print("데모 로그인: demo / demo1234")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    seed()
