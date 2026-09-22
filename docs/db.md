# 데이터베이스 설계 명세서 (Instagram 클론)

- DBMS: **SQLite 3**
- ORM: **SQLAlchemy 2.x** (`Mapped`, `mapped_column`)
- 문자셋: UTF-8
- PK: 정수 `INTEGER PRIMARY KEY` (AUTOINCREMENT 동작)
- 시각: 모든 `DateTime` 컬럼은 UTC, 애플리케이션에서 항상 timezone-aware(`tzinfo=timezone.utc`) 로 다룬다.
- FK: `PRAGMA foreign_keys = ON` 필수

애플리케이션 규칙은 [backend.md](./backend.md), 화면은 [front.md](./front.md).

**구현 시 주의: `sqlalchemy.DateTime(timezone=True)`를 SQLite(pysqlite)와 그대로 쓰면 안 된다.** 직접 확인된 문제로, 커밋 후 값을 다시 읽으면 `tzinfo`가 조용히 사라지고 naive datetime으로 돌아온다 — 이후 `datetime.now(timezone.utc)`와 비교하는 코드가 전부 `TypeError`로 깨진다. `backend/app/database.py`의 `UTCDateTime`(TypeDecorator)을 모든 모델에서 대신 사용한다: 저장 시 UTC로 변환 후 naive로 벗겨서 쓰고, 조회 시 `tzinfo=timezone.utc`를 다시 붙여 돌려준다. 이 문서의 각 테이블에 등장하는 "DATETIME" 컬럼은 전부 이 타입으로 구현되어 있다고 가정한다.

---

## 1. ER 개요

```mermaid
erDiagram
  users ||--o{ posts : writes
  users ||--o{ stories : writes
  users ||--o{ comments : writes
  users ||--o{ follows : follower
  users ||--o{ follows : followee
  users ||--o{ follow_requests : from
  users ||--o{ follow_requests : to
  users ||--o{ blocks : blocker
  users ||--o{ notifications : recipient
  posts ||--|{ post_media : has
  posts ||--o{ post_likes : liked
  posts ||--o{ post_saves : saved
  posts ||--o{ post_user_tags : tags
  posts ||--o{ comments : has
  posts ||--o{ post_hashtags : tagged
  hashtags ||--o{ post_hashtags : used
  comments ||--o{ comments : replies
  comments ||--o{ comment_likes : liked
  stories ||--o{ story_views : viewed
  conversations ||--|{ conversation_members : has
  conversations ||--o{ messages : contains
  users ||--o{ refresh_tokens : has
```

---

## 2. 명명 규칙

- 테이블: 복수형 snake_case
- 컬럼: snake_case
- 불리언: `is_*` / `has_*`
- 연결 테이블: `post_likes`, `post_hashtags` 형태
- 인덱스 이름: `ix_<table>_<columns>`

---

## 3. 테이블

### 3.1 `users`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | INTEGER | PK | |
| email | VARCHAR(255) | UNIQUE NOT NULL | 소문자 |
| username | VARCHAR(30) | UNIQUE NOT NULL | 소문자 |
| hashed_password | VARCHAR(255) | NOT NULL | |
| full_name | VARCHAR(100) | NOT NULL DEFAULT `''` | |
| bio | VARCHAR(150) | NOT NULL DEFAULT `''` | |
| website | VARCHAR(255) | NOT NULL DEFAULT `''` | |
| avatar_path | VARCHAR(500) | NULL | 디스크 상대경로 |
| is_private | BOOLEAN | NOT NULL DEFAULT 0 | |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

인덱스: UNIQUE email, UNIQUE username.

프로필 URL은 `avatar_path`를 애플리케이션에서 절대 URL로 변환. DB에 풀 URL을 넣지 않는다.

**SQLite는 `VARCHAR(n)`의 길이를 실제로 강제하지 않는다** — 타입에 길이를 적어도 그보다 긴 문자열을 조용히 저장해 버린다. 위 표의 길이가 실제로 지켜지도록 `email`/`username`/`full_name`/`bio`/`website`에 `CHECK(length(col) <= n)` 제약을 추가한다(`username`은 `BETWEEN 1 AND 30`). 서버 생성 값만 들어가는 `hashed_password`/`avatar_path`에는 넣지 않는다.

---

### 3.2 `refresh_tokens`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| user_id | INTEGER | FK users.id ON DELETE CASCADE NOT NULL |
| jti | VARCHAR(64) | UNIQUE NOT NULL |
| token_hash | VARCHAR(255) | NOT NULL |
| expires_at | DATETIME | NOT NULL |
| revoked_at | DATETIME | NULL |
| created_at | DATETIME | NOT NULL |

인덱스: `ix_refresh_tokens_user_id`, `ix_refresh_tokens_expires_at`

만료·revoked 행은 로그인 시 또는 주기적으로 삭제 가능 (필수 아님).

---

### 3.3 `follows`

수락된 팔로우만 저장한다.

| 컬럼 | 타입 | 제약 |
|------|------|------|
| follower_id | INTEGER | PK, FK users.id CASCADE |
| followee_id | INTEGER | PK, FK users.id CASCADE |
| created_at | DATETIME | NOT NULL |

CHECK: `follower_id != followee_id`  
인덱스: `ix_follows_followee_id` (팔로워 목록)

---

### 3.4 `follow_requests`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| requester_id | INTEGER | PK, FK CASCADE |
| requestee_id | INTEGER | PK, FK CASCADE |
| created_at | DATETIME | NOT NULL |

CHECK: `requester_id != requestee_id`

수락 시 이 행 삭제 후 `follows` insert.

---

### 3.5 `blocks`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| blocker_id | INTEGER | PK, FK CASCADE |
| blocked_id | INTEGER | PK, FK CASCADE |
| created_at | DATETIME | NOT NULL |

CHECK: `blocker_id != blocked_id`

---

### 3.6 `posts`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| author_id | INTEGER | FK users.id CASCADE NOT NULL |
| caption | TEXT | NOT NULL DEFAULT `''` |
| location | VARCHAR(100) | NOT NULL DEFAULT `''` |
| post_type | VARCHAR(10) | NOT NULL DEFAULT `'post'` |
| created_at | DATETIME | NOT NULL |
| updated_at | DATETIME | NOT NULL |

CHECK: `post_type IN ('post', 'reel')`  
CHECK: `length(caption) <= 2200` (프론트 `CreatePostModal`의 `maxLength={2200}`과 동일 — 댓글 글자수 제한과도 일치시킨다)  
CHECK: `length(location) <= 100`  
인덱스: `ix_posts_author_id_created_at` (author_id, created_at DESC)  
인덱스: `ix_posts_created_at` (피드/탐색)

---

### 3.7 `post_media`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| post_id | INTEGER | FK posts.id CASCADE NOT NULL |
| file_path | VARCHAR(500) | NOT NULL |
| media_type | VARCHAR(10) | NOT NULL |
| sort_order | INTEGER | NOT NULL DEFAULT 0 |
| width | INTEGER | NULL |
| height | INTEGER | NULL |

CHECK: `media_type IN ('image', 'video')`  
UNIQUE: `(post_id, sort_order)`

릴스: 해당 post에 media 1행, `media_type='video'` 권장. 개발 편의를 위해 image 1장도 허용.

---

### 3.8 `post_likes`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| user_id | INTEGER | PK, FK users CASCADE |
| post_id | INTEGER | PK, FK posts CASCADE |
| created_at | DATETIME | NOT NULL |

인덱스: `ix_post_likes_post_id`

---

### 3.9 `post_saves`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| user_id | INTEGER | PK, FK users CASCADE |
| post_id | INTEGER | PK, FK posts CASCADE |
| created_at | DATETIME | NOT NULL |

인덱스: `ix_post_saves_user_id_created_at`

---

### 3.10 `post_user_tags`

게시물 위 사람 태그.

| 컬럼 | 타입 | 제약 |
|------|------|------|
| post_id | INTEGER | PK, FK posts CASCADE |
| user_id | INTEGER | PK, FK users CASCADE |
| created_at | DATETIME | NOT NULL |

---

### 3.11 `hashtags`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| name | VARCHAR(50) | UNIQUE NOT NULL | 소문자, `#` 제외 |
| created_at | DATETIME | NOT NULL |

CHECK: `length(name) BETWEEN 1 AND 50`

---

### 3.12 `post_hashtags`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| post_id | INTEGER | PK, FK posts CASCADE |
| hashtag_id | INTEGER | PK, FK hashtags CASCADE |

인덱스: `ix_post_hashtags_hashtag_id`

해시태그 게시물 수는 `COUNT(*)` 로 계산.

---

### 3.13 `comments`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| post_id | INTEGER | FK posts CASCADE NOT NULL |
| author_id | INTEGER | FK users CASCADE NOT NULL |
| parent_id | INTEGER | FK comments.id CASCADE NULL |
| text | VARCHAR(2200) | NOT NULL |
| created_at | DATETIME | NOT NULL |

CHECK: `length(text) BETWEEN 1 AND 2200` (빈 댓글 저장 금지를 DB 레벨에서도 보장)  
인덱스: `ix_comments_post_id_parent_id_created` (post_id, parent_id, created_at)  
대댓글만 `parent_id` NOT NULL. 부모의 `parent_id`는 NULL이어야 함 (앱에서 강제).

---

### 3.14 `comment_likes`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| user_id | INTEGER | PK, FK users CASCADE |
| comment_id | INTEGER | PK, FK comments CASCADE |
| created_at | DATETIME | NOT NULL |

---

### 3.15 `stories`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| author_id | INTEGER | FK users CASCADE NOT NULL |
| file_path | VARCHAR(500) | NOT NULL |
| media_type | VARCHAR(10) | NOT NULL |
| created_at | DATETIME | NOT NULL |
| expires_at | DATETIME | NOT NULL |

CHECK: `media_type IN ('image', 'video')`  
인덱스: `ix_stories_author_expires` (author_id, expires_at)  
인덱스: `ix_stories_expires_at` (만료 조회)

만료 행은 GET 시 필터. 물리 삭제는 선택 배치.

---

### 3.16 `story_views`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| story_id | INTEGER | PK, FK stories CASCADE |
| user_id | INTEGER | PK, FK users CASCADE |
| viewed_at | DATETIME | NOT NULL |

---

### 3.17 `conversations`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| user_low_id | INTEGER | FK users.id **CASCADE** NOT NULL |
| user_high_id | INTEGER | FK users.id **CASCADE** NOT NULL |
| created_at | DATETIME | NOT NULL |
| updated_at | DATETIME | NOT NULL |

UNIQUE: `(user_low_id, user_high_id)`  
CHECK: `user_low_id < user_high_id`

1:1 전용. 그룹챗 없음.

두 FK 모두 `ON DELETE CASCADE`가 **필수**다(원래 초안엔 빠져 있었음). 지정하지 않으면 `PRAGMA foreign_keys=ON` 상태에서 대화에 참여한 사용자를 삭제하려 할 때 FK 위반으로 삭제 자체가 막힌다. CASCADE로 걸어 두면 참여자 중 한 명이 삭제될 때 해당 대화와 하위 `messages`/`conversation_members`까지 함께 정리된다.

---

### 3.18 `conversation_members`

멤버별 읽음 커서. (user_low/high와 중복이지만 확장·unread 계산용)

| 컬럼 | 타입 | 제약 |
|------|------|------|
| conversation_id | INTEGER | PK, FK conversations CASCADE |
| user_id | INTEGER | PK, FK users CASCADE |
| last_read_message_id | INTEGER | FK messages.id SET NULL NULL |
| joined_at | DATETIME | NOT NULL |

`last_read_message_id` 는 순환 FK이므로: 애플리케이션에서만 갱신, SQLite에서 FK를 빼도 된다. **권장: FK 없이 INTEGER NULL** 로 순환을 피한다.

최종:

| last_read_message_id | INTEGER | NULL, FK 없음 |

unread = 상대가 보낸 `messages.id > last_read_message_id` 개수.

---

### 3.19 `messages`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| conversation_id | INTEGER | FK conversations CASCADE NOT NULL |
| sender_id | INTEGER | FK users CASCADE NOT NULL |
| kind | VARCHAR(20) | NOT NULL DEFAULT `'text'` |
| text | TEXT | NOT NULL DEFAULT `''` |
| file_path | VARCHAR(500) | NULL |
| story_id | INTEGER | FK stories.id SET NULL NULL |
| created_at | DATETIME | NOT NULL |

CHECK: `kind IN ('text', 'image', 'story_reply')`  
인덱스: `ix_messages_conversation_id_id` (conversation_id, id)

메시지 삽입 시 `conversations.updated_at` 갱신.

---

### 3.20 `notifications`

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK |
| recipient_id | INTEGER | FK users CASCADE NOT NULL |
| actor_id | INTEGER | FK users CASCADE NOT NULL |
| type | VARCHAR(30) | NOT NULL |
| post_id | INTEGER | FK posts SET NULL NULL |
| comment_id | INTEGER | FK comments SET NULL NULL |
| is_read | BOOLEAN | NOT NULL DEFAULT 0 |
| created_at | DATETIME | NOT NULL |

CHECK: `type IN ('like','comment','follow','follow_request','mention','tag')`  
인덱스: `ix_notifications_recipient_created` (recipient_id, created_at DESC)

좋아요 알림 중복 완화: UNIQUE INDEX는 post_id NULL 때문에 SQLite에서 까다롭다. **앱 레벨 조회 후 update** 로 처리.

---

## 4. 관계 요약 (ON DELETE)

| 자식 | 부모 | 정책 |
|------|------|------|
| 사용자 소유 콘텐츠 | users | CASCADE |
| conversations (user_low_id, user_high_id) | users | CASCADE |
| post_media, likes, saves, tags, comments, hashtag 연결 | posts | CASCADE |
| 대댓글, comment_likes | comments | CASCADE |
| story_views | stories | CASCADE |
| messages, members | conversations | CASCADE |
| notifications.post_id | posts | SET NULL (알림 문구는 썸네일 없이 유지 가능) |
| messages.story_id | stories | SET NULL |

---

## 5. 무결성 · 시나리오

### 5.1 팔로우

- 공개: `follows` 만
- 비공개: `follow_requests` 만 (수락 전)
- 두 테이블에 같은 쌍이 동시에 있으면 안 됨 (앱에서 수락 시 트랜잭션)

### 5.2 차단

차단 insert 시 같은 트랜잭션에서:

- `follows` 양방향 삭제
- `follow_requests` 양방향 삭제
- 대화는 유지하되 API가 전송을 거부

### 5.3 피드 쿼리 (참고)

```sql
SELECT p.*
FROM posts p
WHERE p.author_id = :me
   OR p.author_id IN (
        SELECT followee_id FROM follows WHERE follower_id = :me
      )
ORDER BY p.created_at DESC, p.id DESC
LIMIT :limit;
```

차단 제외:

```sql
AND p.author_id NOT IN (
  SELECT blocked_id FROM blocks WHERE blocker_id = :me
  UNION
  SELECT blocker_id FROM blocks WHERE blocked_id = :me
)
```

커서: `(created_at < :c_at) OR (created_at = :c_at AND id < :c_id)`

### 5.4 스토리 트레이

유효 스토리가 있는 `author_id IN (me UNION followees)` 를 사용자 단위로 그룹.  
`has_unseen`: 해당 사용자의 유효 스토리 중 `story_views` 에 없는 것이 있으면 1.

---

## 6. 시드 데이터 가이드

최소 행:

| 테이블 | 내용 |
|--------|------|
| users | demo, alex, sam (비밀번호 해시) |
| follows | demo↔alex 맞팔, demo→sam (sam은 private면 request) |
| posts | 사용자당 2, 일부 캐러셀 2장, reel 1 |
| post_media | posts와 대응, `uploads/` 샘플 파일 복사 |
| stories | alex 1건, expires 미래 |
| conversations | demo-alex |
| messages | 텍스트 2~3 |

시드 이미지는 `backend/seed_assets/` 에 두고 업로드 디렉터리로 복사한다.

---

## 7. 변경 관리

1차: `create_all` 만 사용. 컬럼 추가 시:

1. 이 문서 테이블 정의 수정
2. 로컬 `instagram.db` 삭제 또는 수동 `ALTER TABLE` (SQLite는 DROP COLUMN/제약이 제한적)
3. [backend.md](./backend.md) 모델·스키마 동기화

개발 중 DB를 자주 지워도 되도록 시드 스크립트를 유지한다.
