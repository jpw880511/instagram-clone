# 백엔드 개발 요청 명세서 (Instagram 클론)

- 스택: **Python 3.11+ / FastAPI / SQLAlchemy 2.x / Pydantic v2 / SQLite**
- DB: **SQLite 단일 파일**을 개발·프로덕션 환경 모두에서 사용한다. 별도 DBMS(Postgres 등)로의 전환은 계획하지 않는다. 배포도 `instagram.db` 파일 + 로컬 디스크 업로드만으로 완결한다 (외부 오브젝트 스토리지, 커넥션 풀 등 불필요).
- 인증: **JWT** (access 15분, refresh 14일)
- 비밀번호: **passlib[bcrypt]**
- 업로드: 로컬 디스크 `backend/uploads/` + `StaticFiles`
- 시간: UTC ISO-8601, DB는 timezone-aware `DateTime`

이 문서는 `frontend/src` 구현체(특히 `src/mocks/mockApi.js`, `src/mocks/seed.js`, 각 페이지/컴포넌트)를 실제 계약의 근거로 삼아 재작성되었다. **디자인(프론트엔드)에 실재하는 기능과 그 기능이 필요로 하는 데이터만** 구현 범위로 삼는다 — 프론트가 호출하지 않는 엔드포인트는 만들지 않는다.

프론트 계약은 [front.md](./front.md), 테이블은 [db.md](./db.md), 실행은 [guide.md](./guide.md).

---

## 1. 목표

Instagram 핵심 소셜 그래프·콘텐츠·알림·DM을 REST로 제공한다. WebSocket은 범위 밖(DM은 폴링).

앱 팩토리: `backend/app/main.py` 의 `create_app()`.

권장 패키지 구조:

```
backend/
  app/
    main.py
    config.py
    database.py
    init_db.py               # python -m app.init_db — create_all만 실행하는 마이그레이션 진입점
    deps.py                 # get_db, get_current_user, get_current_user_optional
    models/
      __init__.py           # 모든 모델 re-export
      user.py
      post.py
      social.py
      story.py
      message.py
      notification.py
    schemas/
      ...
    routers/
      auth.py
      users.py
      posts.py
      feed.py
      stories.py
      comments.py
      follows.py
      search.py
      notifications.py
      messages.py
    services/
      auth.py
      media.py
      caption.py            # hashtag/mention 파싱
      privacy.py            # can_view_user / can_view_post
      notify.py
    utils/
      security.py
      pagination.py
      filenames.py
  uploads/
    avatars/
    posts/
    stories/
    messages/
  tests/
  requirements.txt
  .env.example
```

라우터 prefix: `/api`. OpenAPI `/docs` 유지.

---

## 2. 설정 (`config.py`)

환경변수 (이미 `backend/app/config.py`에 정의됨):

| 키 | 기본 | 설명 |
|----|------|------|
| `DATABASE_URL` | `sqlite:///./instagram.db` | SQLAlchemy URL. 개발·프로덕션 동일 |
| `SECRET_KEY` | (필수, 개발용 더미 금지 권장) | JWT 서명 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `14` | |
| `UPLOAD_DIR` | `./uploads` | |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | 미디어 절대 URL 생성 |
| `CORS_ORIGINS` | `http://localhost:5173` | 콤마 구분 |
| `MAX_UPLOAD_MB` | `20` | 파일당 |
| `STORY_TTL_HOURS` | `24` | |
| `ADMIN_USERNAME` | `admin` | 관리자 페이지 로그인 (§4.12), `users` 테이블과 무관 |
| `ADMIN_PASSWORD` | `asdf1234` | |
| `ADMIN_TOKEN_EXPIRE_HOURS` | `12` | refresh 없음, 만료되면 재로그인 |

SQLite: `connect_args={"check_same_thread": False}`, 엔진에 `PRAGMA foreign_keys=ON`.

시작 시 `Base.metadata.create_all` (마이그레이션 도구 없이 완료). 스키마 변경이 필요하면 [db.md](./db.md)를 먼저 수정한다.

서버를 띄우지 않고 스키마만 적용/재확인하려면:

```bash
cd backend
python -m app.init_db
```

`create_all`은 멱등이라 여러 번 실행해도 안전하다(이미 있는 테이블은 건드리지 않고, 없는 테이블만 만든다). **컬럼 추가나 제약 변경처럼 기존 테이블 구조 자체를 바꿔야 한다면 `create_all`로는 반영되지 않는다** — [db.md](./db.md) §7에 따라 먼저 문서를 고치고, 개발 중인 `backend/instagram.db`를 지운 뒤 `python -m app.init_db`를 다시 실행해 새 스키마로 재생성한다.

---

## 2.1 데이터베이스 계층 — 구현·검토 완료

`backend/app/database.py`와 `backend/app/models/*.py`에 [db.md](./db.md) §3의 테이블 20개가 전부 SQLAlchemy 모델로 구현되어 있다(`python -m app.main` import 시 `instagram.db`에 20개 테이블이 생성되는 것을 확인함).

실제 SQLite 파일에 대해 재현·검증하며 아래 3가지 문제를 발견해 고쳤다. 셋 다 API 코드가 없는 지금 고치지 않으면 라우터를 짜기 시작한 뒤에야 (그것도 조용히) 드러나는 종류의 버그라서, DB 계층 단계에서 먼저 처리했다.

1. **`sqlalchemy.DateTime(timezone=True)`가 SQLite에서 사실상 동작하지 않는다.** pysqlite 드라이버로 실제 확인한 현상: aware datetime을 저장하고 커밋 후 다시 읽으면 `tzinfo`가 조용히 사라져 naive datetime이 된다. 이 상태에서 `expires_at > datetime.now(timezone.utc)` 같은 비교(스토리 만료 체크, 토큰 만료 체크 등 거의 모든 시간 비교 로직)를 하면 `TypeError: can't compare offset-naive and offset-aware datetimes`로 즉시 죽는다. → `app/database.py`에 `UTCDateTime`(`TypeDecorator`)을 새로 만들어 모든 모델의 `DateTime(timezone=True)`를 이걸로 교체했다. 저장 시 UTC로 변환 후 naive로 벗기고, 조회 시 `tzinfo=timezone.utc`를 다시 붙인다. 앞으로 새 컬럼을 추가할 때도 `sqlalchemy.DateTime`을 직접 쓰지 말고 `from app.database import UTCDateTime, utcnow`를 사용한다.
2. **`conversations.user_low_id` / `user_high_id`에 `ON DELETE` 정책이 빠져 있었다.** `PRAGMA foreign_keys=ON` 상태에서 두 컬럼 다 기본 동작(`NO ACTION`)이라, 대화에 참여 중인 사용자를 삭제하려 하면 FK 위반으로 삭제 자체가 거부된다. `db.md`의 "사용자 소유 콘텐츠는 CASCADE" 원칙과도 어긋난다. → 두 FK 모두 `ondelete="CASCADE"`로 수정. 참여자가 삭제되면 그 대화와 하위 `messages`/`conversation_members`까지 함께 정리된다. (사용자 삭제 자체는 여전히 §5.2처럼 1차 범위 밖이지만, 스키마가 이걸 지원 못 하는 상태로 두지 않는다.)
3. **`VARCHAR(n)`로 선언한 길이 제한을 SQLite는 실제로 강제하지 않는다.** `VARCHAR(30)`이라고 적어도 SQLite는 31자든 300자든 그냥 저장한다(타입 친화성만 있고 길이 검사가 없음). API 레이어의 Pydantic 검증이 1차 방어선이 되겠지만, 그 레이어가 아직 없거나 버그가 있어도 DB가 스스로 지키도록 사용자 입력이 직접 들어가는 컬럼에 `CHECK(length(col) <= n)`을 추가했다: `users.email/username/full_name/bio/website`, `posts.caption`(2200, 댓글과 동일하게 통일)/`location`, `hashtags.name`, `comments.text`(1~2200, 빈 댓글도 DB에서 막음). 서버가 직접 생성하는 값만 들어가는 컬럼(`hashed_password`, `avatar_path`, `file_path`류, `refresh_tokens.jti/token_hash`)에는 넣지 않았다 — 사용자 입력이 아니라 애초에 넘칠 수 없다.

세 가지 모두 실제로 재현 후 수정을 검증했다: `foreign_keys` 프래그마 활성 확인, timezone round-trip 확인, 각 `CHECK` 위반 시 `IntegrityError` 확인, `conversations`→`users` 삭제 시 `messages`/`conversation_members`까지 cascade 확인.

---

## 2.2 API 계층 — 구현 완료

아래 §3·§4에 문서화된 계약대로 `backend/app/routers`·`schemas`·`services`를 전부 구현했다. `python -m app.seed`로 데모 데이터를 채운 뒤 실제 서버(`uvicorn app.main:app`)를 띄워 `curl`로 로그인 → 피드 → 팔로우 → 비공개 계정 → 팔로우 요청 수락 → 댓글 → 스토리 → DM → 검색 → 해시태그 흐름을 직접 호출해 응답을 확인했고, `backend/tests/test_flows.py`에 §6의 필수 케이스(9개)를 포함한 pytest 12개를 추가해 전부 통과함을 확인했다(`pytest tests/ -q`).

구현하면서 생긴, 명세에는 없던 디테일 3가지:

1. **`passlib==1.7.4`는 `bcrypt>=4.1`과 함께 쓰면 죽는다.** passlib이 백엔드를 초기화할 때 내부적으로 72바이트 넘는 문자열로 자체 점검을 하는데, `bcrypt>=4.1`부터는 그런 입력에 대해 조용히 자르는 대신 `ValueError`를 던지도록 바뀌어서 첫 해싱 시도에 죽는다. `requirements.txt`에 `bcrypt==4.0.1`을 명시적으로 고정했다(가상환경에 이미 `bcrypt==5.0.0`이 깔려 있어서 실제로 재현하고 고쳤다).
2. **refresh 토큰 해시는 bcrypt가 아니라 SHA-256을 쓴다.** `refresh_tokens.token_hash`에 "원문 저장 금지"라고만 되어 있어 처음엔 bcrypt를 그대로 썼는데, JWT 문자열 자체가 72바이트를 훌쩍 넘어서 위 버그와 같은 이유로 실패한다. 애초에 refresh 토큰은 이미 고엔트로피 랜덤값이라 bcrypt의 느린 해시(무차별 대입 방어용)가 필요 없는 대상이다 — 빠른 SHA-256 + `hmac.compare_digest` 비교로 바꿨다(`app/utils/security.py`).
3. **`POST /conversations/{id}/messages`는 JSON과 multipart를 모두 받는다는 게 문서 원문 그대로였다** — FastAPI는 한 경로에 두 바디 타입을 동시에 선언할 수 없어서, `Content-Type` 헤더를 보고 직접 분기하는 방식으로 구현했다(`request: Request`를 받아 `multipart/form-data`면 `await request.form()`, 아니면 `await request.json()`).

`/docs`에 §4의 엔드포인트가 정확히 등장하는 것, §4 검증 노트의 6개 엔드포인트가 존재하지 않는 것도 확인했다.

---

## 3. 공통 규칙

### 3.1 인증

- 로그인 성공: `{ access_token, refresh_token, token_type: "bearer", user }`
- access / refresh payload: `sub` = user id (str), `typ` = `access` | `refresh`, `jti` (refresh만)
- refresh 토큰은 `refresh_tokens` 테이블에 **해시 저장**. 로테이션: 사용 즉시 구 jti revoke + 신규 발급
- `POST /api/auth/logout`: 해당 refresh jti revoke (바디에 refresh_token). 응답 `{ "ok": true }`
- `get_current_user`: Bearer 필수. 만료/위조 → 401
- **예외적으로 인증이 선택인 엔드포인트가 하나 있다: `GET /api/feed/public`.** 홈(`/`)은 비로그인 방문자에게도 공개 계정 게시물 피드를 보여준다(`frontend/src/pages/HomePage.jsx`). `get_current_user_optional`을 만들어 Authorization 헤더가 있으면 검증하고 없으면 `None`으로 통과시킨다. 그 외 모든 엔드포인트는 로그인 필수이며 예외 없음.

### 3.2 에러

- 400 잘못된 요청 (자기 자신 팔로우 등)
- 401 미인증 / 토큰 불량
- 403 비공개·차단·권한 없음 (`detail` 한국어 가능: `"이 계정의 게시물을 볼 수 없습니다."`)
- 404 리소스 없음 (존재 여부 노출이 민감하면 비공개 유저도 404로 통일)
- 409 중복 username/email
- 422 Pydantic 검증
- 413 업로드 용량

차단 관계: A가 B를 차단하면 양방향 콘텐츠·DM·팔로우 불가. 검색에서 제외.

**삭제/토글류 응답 규약(고정):** 이 프로젝트는 삭제·차단·읽음처리 등 부수효과만 있는 액션에 대해 `204 No Content`를 쓰지 않는다. 항상 `200 OK` + `{ "ok": true }` 형태의 JSON 바디로 응답한다(프론트 `client.js`가 204 바디 없음도 처리하지만, 실제 구현은 mock과 동일하게 `{ ok: true }`로 통일한다). 좋아요/저장 토글처럼 상태를 함께 돌려줘야 하는 경우는 아래 각 절의 응답 예시를 따른다.

### 3.3 페이지네이션

커서: `created_at` + `id` 를 URL-safe 인코딩 (예: `{created_at.isoformat()}|{id}`). 커서는 클라이언트 입장에서 완전히 불투명한 문자열로 취급되므로, 모든 목록형 엔드포인트는 이 방식 하나로 통일한다.

페이지네이션 응답 공통:

```json
{ "items": [], "next_cursor": "..." | null }
```

쿼리 파라미터: `cursor`, `limit`. 엔드포인트별 기본 `limit`(프론트 무한 스크롤 호출 단위와 일치시킨다):

| 엔드포인트 | 기본 limit | 최대 |
|---|---|---|
| `GET /feed`, `GET /feed/public` | 10 | 50 |
| `GET /reels` | 5 | 50 |
| `GET /explore` | 12 | 50 |
| 그 외 목록(댓글, 알림, 해시태그 게시물, 사용자 그리드, 팔로워/팔로잉 등) | 20 | 50 |

**페이지네이션이 없는 목록 엔드포인트** (배열을 그대로 반환, `items`/`next_cursor` 래퍼 없음):

- `GET /users/suggested`
- `GET /posts/{post_id}/likers`
- `GET /comments/{comment_id}/replies`
- `GET /stories/tray`
- `GET /stories/user/{username}`
- `GET /stories/{story_id}/viewers`
- `GET /conversations`

이 목록들은 데이터 규모가 작다고 가정한다(팔로잉 스토리, 대화 목록 등). 1차 범위에서 페이지네이션을 추가하지 않는다.

### 3.4 미디어

허용 MIME:

- 이미지: `image/jpeg`, `image/png`, `image/webp`
- 영상: `video/mp4` (릴스, 메시지)

저장 파일명: `{uuid}{ext}`. 응답에 등장하는 모든 미디어 URL(게시물 `media[].url`, 스토리 `url`, 아바타 `avatar_url`, 메시지 `file_path`)은 **항상 절대 URL**(`{PUBLIC_BASE_URL}/uploads/{subdir}/{filename}`)로 내려준다. 프론트는 상대경로를 조립하지 않는다.

마운트: `app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")`.

`post_media.width` / `height` 컬럼은 [db.md](./db.md)에 존재하지만 현재 프론트 어떤 컴포넌트도 사용하지 않는다(`Carousel.jsx`는 `id`/`url`/`media_type`만 읽음). 응답 JSON에 넣어도 무방하지만 필수는 아니며, 값이 없으면 `null`로 둔다.

### 3.5 캡션 파싱 (`services/caption.py`)

프론트 `src/utils/parseCaption.js`의 정규식과 **정확히 동일한 규칙**을 서버에서 재구현한다:

```
([#@])([\p{L}\p{N}_.]{1,50})
```

- 해시태그: `#` + 위 패턴 (유니코드 문자/숫자/`_`/`.` 1~50자). 한글 포함.
- 멘션: `@` + 위 패턴. **`.`(마침표)를 포함한다** — username 규칙(`^[a-z0-9._]{1,30}$`)이 마침표를 허용하기 때문이다(예: `mia.j`). 대소문자 무시하고 소문자로 정규화해서 매칭한다.
- 게시 저장 후:
  - hashtag upsert, `post_hashtags` 연결 (해시태그 이름은 소문자로 저장)
  - 존재하는 사용자 멘션 → `notifications` type=`mention`
- 캡션은 생성 후 수정할 방법이 없다(§4.4 검증 노트 참고 — 수정 UI가 없어 `PATCH /posts/{id}`를 만들지 않았다). 따라서 해시태그 재동기화 로직도 필요 없다: 게시물 생성 시점에만 파싱하면 끝이다.
- 댓글 작성 시에도 동일한 멘션 파싱을 적용해 `mention` 알림을 만든다(해시태그는 댓글에서 추출하지 않는다).

### 3.6 프라이버시 (`services/privacy.py`)

`can_view_profile(viewer, owner)`:

- `viewer`가 `None`(비로그인, `GET /feed/public` 전용): `owner.is_private == false`일 때만 true. 차단 체크는 생략(비로그인은 차단 관계가 없음)
- 본인: true
- 차단 어느 쪽이든: false
- `is_private == false`: true
- private: `follows`에 관계가 있을 때만 true

게시물/스토리/릴스는 프로필 열람 가능 여부와 동일. 저장됨 탭은 본인만.

---

## 4. 엔드포인트

모든 경로 앞에 `/api`가 붙는다. 별도 표기하지 않은 메서드는 **로그인 필수**.

> **검증 노트:** `frontend/src/api/*.js`가 내보내는 엔드포인트 호출 함수를 `pages/`·`components/`·`context/`·`hooks/`에서 실제로 호출하는지 하나씩 대조했다(`grep`으로 각 함수명의 실제 호출부 개수를 셈). 아래 5개는 export만 되어 있고 실제로 호출하는 화면이 하나도 없어서(죽은 엔드포인트) 이번에 명세에서 뺐다 — 이 문서 서두에 이미 적혀 있는 원칙("프론트가 호출하지 않는 엔드포인트는 만들지 않는다")을 그대로 적용한 결과다. 반대 방향(프론트는 필요한데 명세에 없는 엔드포인트)은 없었다 — 실제로 호출되는 나머지는 전부 아래에 문서화되어 있다.
>
> | 제거한 엔드포인트 | 이유 |
> |---|---|
> | `PATCH /posts/{post_id}` | `postsApi.updatePost`를 호출하는 화면이 없다. `FeedPost.jsx`의 "수정" 메뉴는 `/p/:postId`로 이동만 하고, 캡션/위치를 고치는 입력 폼 자체가 어디에도 없다. |
> | `DELETE /stories/{story_id}` | `storiesApi.deleteStory`를 호출하는 곳이 없다. `StoryViewer.jsx`에는 본인 스토리라도 삭제 버튼이 없고("조회자 보기"만 있음), 24시간 TTL로 자연 만료되는 것에 의존한다. |
> | `GET /follow-requests` | `followsApi.listFollowRequests`를 호출하는 화면이 없다. 팔로우 요청은 별도 목록 화면 없이 `type=follow_request` 알림에 확인/삭제 버튼이 인라인으로 붙어서(`NotificationItem.jsx`) 처리된다 — `POST /follow-requests/{user_id}/accept`/`reject`는 그 알림의 `actor.id`를 그대로 써서 호출되므로 목록 조회가 애초에 필요 없다. |
> | `DELETE /users/{username}/block` | `followsApi.unblock`을 호출하는 곳이 없다. |
> | `GET /blocks` | `followsApi.listBlocks`를 호출하는 곳이 없다. |
>
> 뒤의 두 개(차단 해제/차단 목록)를 빼면 **현재 프론트엔드에는 한번 차단한 계정을 다시 볼 방법이 없다** — 이건 백엔드 범위의 문제가 아니라 프론트에 "차단한 계정 관리" 화면 자체가 없어서다. 나중에 그 화면이 생기면 이 두 엔드포인트를 그대로 되살리면 된다(라우터/서비스 로직은 간단하고, `blocks` 테이블은 이미 존재하므로 DB 변경은 필요 없다).

### 4.1 Auth `routers/auth.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/login` | 로그인 |
| POST | `/auth/refresh` | 토큰 갱신 (인증 헤더 없이 body) |
| POST | `/auth/logout` | refresh revoke |

**POST `/auth/register`**

```json
{
  "email": "a@b.com",
  "username": "user_name",
  "full_name": "홍길동",
  "password": "secret123"
}
```

- email 소문자 정규화, unique
- username 소문자 정규화, `^[a-z0-9._]{1,30}$`, unique
- password min 8
- 201 + 로그인과 동일한 토큰 페이로드

**POST `/auth/login`**

```json
{ "identifier": "a@b.com 또는 username", "password": "..." }
```

실패 401 `"이메일/아이디 또는 비밀번호가 올바르지 않습니다."` (존재 여부 미노출)

**POST `/auth/refresh`**

```json
{ "refresh_token": "..." }
```

**UserPublic / UserMe**

```json
{
  "id": 1,
  "username": "jane",
  "full_name": "Jane",
  "bio": "",
  "website": "",
  "avatar_url": null,
  "is_private": false,
  "post_count": 0,
  "follower_count": 0,
  "following_count": 0,
  "is_following": false,
  "is_followed_by": false,
  "follow_status": "none",
  "has_story": false
}
```

`follow_status`: `none` | `following` | `requested` | `self`
`UserMe`는 위 + `email`

`UserSummary`(다른 리소스에 내장되는 축약형): `{ id, username, avatar_url }`.

---

### 4.2 Users `routers/users.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/users/me` | 내 정보 |
| PATCH | `/users/me` | 프로필 수정 (`multipart/form-data`) |
| GET | `/users/suggested` | 추천 (아직 안 팔로우, 최대 5, 배열) |
| GET | `/users/{username}` | 공개 프로필 |
| GET | `/users/{username}/posts` | 그리드용 게시물 (릴스 제외) |
| GET | `/users/{username}/tagged` | 태그된 게시물 |
| GET | `/users/me/saved` | 저장한 게시물 |
| GET | `/users/{username}/followers` | |
| GET | `/users/{username}/following` | |

**PATCH `/users/me`** (`multipart/form-data`)

필드 optional: `full_name`, `username`, `bio` (max 150), `website` (`https://`만 허용, front 검증과 동일), `is_private` (`"true"`/`"false"`), 파일 `avatar`, 불리언 `remove_avatar`.

- `avatar` 파일이 오면 새로 저장하고 기존 파일은 삭제 후 교체.
- `avatar`가 없고 `remove_avatar=true`면 `avatar_path`를 `NULL`로 만들고 기존 파일 삭제. (`frontend/src/pages/EditProfilePage.jsx`의 "사진 삭제" 버튼이 이 경로를 사용한다.)
- 둘 다 오면 새 파일 업로드가 우선한다.
- username 중복 시 409.
- 비공개로 전환: 기존 팔로워는 유지. 공개로 전환: pending `follow_requests` 를 자동 수락하고 `follows` 생성 + 알림 `follow`.

**GET `/users/suggested`**

배열(`UserPublic[]`, 페이지네이션 없음, 최대 5). 간단한 휴리스틱: 내가 팔로우하는 사람이 팔로우하는 사용자, 없으면 최근 가입. 본인·이미 팔로우·차단 제외.

그리드 아이템 `PostGridItem`: `{ id, thumbnail_url, like_count, comment_count, media_count, post_type }`

비공개 미허용 시 posts/tagged/followers/following 은 403.

---

### 4.3 Follows / Blocks `routers/follows.py`

| 메서드 | 경로 | 설명 | 응답 |
|--------|------|------|------|
| POST | `/users/{username}/follow` | 팔로우 또는 요청 | `{ "follow_status": "following" \| "requested" }` |
| DELETE | `/users/{username}/follow` | 언팔 / 요청 취소 | `{ "follow_status": "none" }` |
| POST | `/follow-requests/{user_id}/accept` | 수락 (내가 수신자, `user_id`는 알림의 `actor.id`) | `{ "ok": true }` |
| POST | `/follow-requests/{user_id}/reject` | 거절 | `{ "ok": true }` |
| POST | `/users/{username}/block` | 차단 | `{ "ok": true }` |

`GET /follow-requests`(요청 목록), `DELETE /users/{username}/block`(차단 해제), `GET /blocks`(차단 목록)는 만들지 않는다 — §4 검증 노트 참고.

**팔로우 로직**

1. 자기 자신 금지 → 400
2. 차단이면 403
3. 이미 following → **멱등 200**, `{ "follow_status": "following" }` 그대로 반환 (409 아님)
4. 대상 `is_private=false`: `follows` insert, 알림 `follow`, `{ "follow_status": "following" }`
5. private: `follow_requests` insert (이미 있으면 멱등), 알림 `follow_request`, `{ "follow_status": "requested" }`

언팔: follows 또는 request 삭제. 상대 피드에서만 사라지고 알림은 삭제하지 않아도 됨.

수락: request 삭제 + follows insert + 알림 `follow`.

차단: 양방향 follows/requests 삭제, 해당 1:1 conversation은 메시지 전송만 막기(`is_blocked` 플래그로 계산, §4.11).

---

### 4.4 Posts `routers/posts.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/posts` | 생성 multipart |
| GET | `/posts/{post_id}` | 상세 |
| DELETE | `/posts/{post_id}` | 본인 삭제 (미디어 파일 삭제) |
| POST | `/posts/{post_id}/like` | 멱등 |
| DELETE | `/posts/{post_id}/like` | |
| POST | `/posts/{post_id}/save` | |
| DELETE | `/posts/{post_id}/save` | |
| GET | `/posts/{post_id}/likers` | 좋아요한 사용자 (`UserPublic[]`, 배열) |

> `PATCH /posts/{post_id}`(캡션/위치 수정)와 `POST /posts/{post_id}/tags`(생성 후 사람 태그 추가)는 만들지 않는다. 실제 프론트(`CreatePostModal.jsx`)는 게시물 **생성 시점**에만 캡션·위치·`tagged_usernames`를 받고, 생성 후 이를 고치거나 추가하는 UI가 어디에도 없다 — §4 검증 노트 참고. 게시물은 생성 후 삭제만 가능하고 내용은 불변이다.

**POST `/posts`** (`multipart/form-data`)

- `files`: 1–10. 릴스(`post_type=reel`)는 파일 1개
- `caption` optional (최대 2200자)
- `location` optional max 100
- `post_type`: `post` | `reel` (default `post`). 프론트는 게시물 작성 모달에서 동영상 파일을 선택하면 `post_type`을 자동으로 `reel`로 바꿔 보낸다 — 서버는 이 값을 그대로 신뢰한다(별도 재판별 로직 불필요).
- `tagged_usernames`: JSON 배열 문자열 optional. 프론트는 각 username을 `GET /users/{username}`으로 먼저 검증한 뒤 추가하므로, 서버는 존재하지 않는 username이 와도 조용히 무시한다(에러 아님).

트랜잭션: post → media rows → hashtags → tags → mention/tag 알림.

**PostOut**

```json
{
  "id": 1,
  "author": { "id": 1, "username": "jane", "avatar_url": null },
  "caption": "...",
  "location": "",
  "post_type": "post",
  "created_at": "...",
  "media": [
    { "id": 1, "url": "...", "media_type": "image", "sort_order": 0 }
  ],
  "like_count": 0,
  "comment_count": 0,
  "liked": false,
  "saved": false,
  "tagged_users": [{ "id": 2, "username": "alex", "avatar_url": null }]
}
```

`author`, `tagged_users[]`는 `UserSummary` (전체 `UserPublic`이 아님 — 그리드/피드 카드에는 팔로우 상태 등이 불필요).

`caption`/`location`은 DB가 `NOT NULL DEFAULT ''`이므로 응답에서도 **항상 문자열**이다(`null` 아님, 비어 있으면 `""`) — 이전 초안의 `"location": null` 예시는 스키마와 안 맞아 고쳤다. `updated_at` 컬럼은 DB에는 있지만 응답에 넣지 않는다: 캡션/위치를 고치는 엔드포인트가 없으니 생성 이후로 값이 바뀔 일이 없다.

삭제 시 좋아요/댓글/저장/해시태그/미디어 CASCADE ([db.md](./db.md)). 응답 `{ "ok": true }`.

**좋아요/저장 응답**

- `POST /posts/{id}/like`, `DELETE /posts/{id}/like` → `{ "liked": true|false, "like_count": <int> }`
- `POST /posts/{id}/save`, `DELETE /posts/{id}/save` → `{ "saved": true|false }`

---

### 4.5 Feed · Explore · Reels

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/feed` | 필수 | 팔로잉 + 본인 게시물, 최신순 (릴스 제외) |
| GET | `/feed/public` | 선택 | 비로그인 홈 피드 |
| GET | `/explore` | 필수 | 공개 계정 인기/최신 혼합 |
| GET | `/reels` | 필수 | `post_type=reel` 중 열람 가능 |

**`GET /feed/public`** — `frontend/src/pages/HomePage.jsx`는 로그인 사용자는 `/feed`, 비로그인 방문자는 이 엔드포인트를 호출한다. `Authorization` 헤더는 선택이다.

- 비로그인: `is_private=false`인 작성자의 게시물만, 릴스 제외, 최신순.
- 로그인 상태로 호출된 경우(선택 인증이므로 이론상 가능): `can_view_profile(viewer, author)` 기준으로 필터링하고 차단 목록도 제외한다.

피드(`/feed`): `follows` 관계만 있으면 됨(테이블에는 accepted만 저장되므로 상태 체크 불필요). 차단 제외.

탐색(`/explore`): `is_private=false`인 작성자, **본인 게시물 제외**, `like_count DESC, created_at DESC` 정렬(SQLite 단순화). 그리드 아이템은 `PostGridItem`.

릴스(`/reels`): `can_view_profile` 통과하는 작성자의 `post_type='reel'` 게시물, `PostOut` 배열로 반환(그리드가 아니라 풀 카드 — 좋아요/댓글/저장 액션이 바로 붙는다).

빈 피드는 `items: []`.

---

### 4.6 Comments `routers/comments.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/posts/{post_id}/comments` | 최상위 댓글 커서. 각 아이템에 `reply_count` |
| GET | `/comments/{comment_id}/replies` | 대댓글 (배열, 페이지네이션 없음, 오래된순) |
| POST | `/posts/{post_id}/comments` | `{ "text", "parent_id"? }` |
| DELETE | `/comments/{comment_id}` | 작성자 또는 게시물 주인. 응답 `{ "ok": true }` |
| POST | `/comments/{comment_id}/like` | 응답 `{ "liked": true }` |
| DELETE | `/comments/{comment_id}/like` | 응답 `{ "liked": false }` |

**CommentOut**

```json
{
  "id": 1,
  "post_id": 1,
  "author": { "id": 2, "username": "alex", "avatar_url": null },
  "parent_id": null,
  "text": "완전 예쁘다",
  "created_at": "...",
  "like_count": 0,
  "liked": false,
  "reply_count": 0
}
```

- text 1–2200자, 공백만 있는 문자열은 422 `"댓글 내용을 입력하세요."`
- `parent_id`가 있으면 같은 post의 최상위 댓글만 허용 (3단 금지)
- 생성 시 게시 작성자에게 `comment` 알림 (본인 제외). 텍스트 내 멘션도 처리 (§3.5)
- 삭제 시 해당 댓글이 최상위면 대댓글도 함께 삭제 (CASCADE)
- `comment_count`는 대댓글 포함

---

### 4.7 Stories `routers/stories.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/stories/tray` | 피드 상단용 그룹 (배열, 페이지네이션 없음) |
| GET | `/stories/user/{username}` | 해당 유저의 유효 스토리 (배열) |
| POST | `/stories` | multipart `file` |
| POST | `/stories/{story_id}/view` | 조회 기록 (본인 제외). 응답 `{ "ok": true }` |
| GET | `/stories/{story_id}/viewers` | 본인만 (배열) |

`DELETE /stories/{story_id}`(본인 스토리 수동 삭제)는 만들지 않는다 — §4 검증 노트 참고. `StoryViewer.jsx`에 삭제 버튼이 없고, 24시간 TTL 만료에만 의존한다.

유효: `expires_at > now`. 생성 시 `expires_at = now + STORY_TTL_HOURS`.

`POST /stories`는 현재 프론트에서 이미지만 보낸다(`StoryBar.jsx` 업로드 `input accept="image/jpeg,image/png,image/webp"` — 동영상 선택 불가). `stories.media_type`은 DB에 `'video'`도 CHECK로 허용해 두지만(db.md §3.15), 실제로 이 값이 들어올 UI 경로는 현재 없다.

**Tray 아이템** (`StoryTrayItem`)

```json
{
  "user": { "id": 2, "username": "alex", "avatar_url": null },
  "has_unseen": true,
  "latest_at": "...",
  "story_count": 2
}
```

`story_count`는 프론트 `StoryBar.jsx`가 링(그라데이션 테두리) 표시 여부를 결정하는 데 쓴다(스토리가 0개인 본인 슬롯은 "+" 버튼만 표시). 정렬: 본인 슬롯 고정 첫 칸(스토리 유무와 관계없이 업로드 버튼) → `has_unseen` desc → `latest_at` desc. 포함 대상: 본인 + 팔로잉 중 유효 스토리가 있는 사용자.

**`GET /stories/user/{username}` 응답 아이템** (`StoryOut`)

```json
{
  "id": 10,
  "author": { "id": 2, "username": "alex", "avatar_url": null },
  "url": "https://.../uploads/stories/xxx.jpg",
  "media_type": "image",
  "created_at": "...",
  "expires_at": "...",
  "viewed": false
}
```

`viewed`는 요청자 기준 조회 여부.

**`GET /stories/{story_id}/viewers` 응답 아이템**: `{ id, username, avatar_url, viewed_at }`.

조회: `story_views` unique (story_id, user_id). 본인 스토리를 조회해도 기록하지 않는다.

---

### 4.8 Search `routers/search.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/search` | `q`, `type=user\|hashtag\|all`(기본 `all`) |

응답은 페이지네이션 없이 한 번에 반환한다:

```json
{
  "users": [{ "...": "UserPublic" }],
  "hashtags": [{ "name": "sunset", "post_count": 12 }]
}
```

- `q`가 빈 문자열/공백이면 422를 던지지 않고 `{ "users": [], "hashtags": [] }`를 그대로 반환한다(프론트가 300ms 디바운스 후에도 빈 입력으로 호출할 수 있음).
- `type=user`일 때 `hashtags`는 빈 배열, `type=hashtag`일 때 `users`는 빈 배열.
- 사용자: `username` / `full_name` LIKE, 본인·차단 제외, 최대 20.
- 해시태그: `name` LIKE, `post_count` 포함, 최대 20.

---

### 4.9 Hashtags

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/hashtags/{name}` | 메타 + 게시물 커서 |

```json
{
  "name": "sunset",
  "post_count": 12,
  "items": [{ "...": "PostGridItem" }],
  "next_cursor": null
}
```

없는 태그는 `post_count: 0`, `items: []` (404 아님). `can_view_profile` 통과하는 작성자의 게시물만 집계·노출한다.

---

### 4.10 Notifications `routers/notifications.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/notifications` | 최신순 |
| POST | `/notifications/read` | 전체 읽음 또는 `{ "ids": [] }`. 응답 `{ "ok": true }` |
| GET | `/notifications/unread-count` | 뱃지용. `{ "count": <int> }`. 프론트는 15초 간격으로 폴링한다 |

**NotificationOut**

```json
{
  "id": 1,
  "type": "like",
  "actor": { "id": 2, "username": "alex", "avatar_url": null },
  "post": { "id": 1, "thumbnail_url": "..." } | null,
  "comment_preview": null,
  "is_read": false,
  "created_at": "..."
}
```

`type` enum: `like`, `comment`, `follow`, `follow_request`, `mention`, **`tag`**

`comment_preview`는 `type=comment`일 때만 채워지며 **댓글 텍스트의 앞 60자**로 자른다(그 외 타입은 `null`). `NotificationItem.jsx`가 `"{user}님: {comment_preview}"` 형태로 그대로 출력하므로 서버가 미리 잘라서 내려준다 — 프론트에서 추가로 자르지 않는다.

> `tag`는 게시물 생성 시 사람 태그를 받은 사용자에게 보내는 알림이다(`{user}님이 회원님을 사진에 태그했습니다.`, `NotificationItem.jsx` 참고). 기존 초안에 빠져 있었으므로 [db.md](./db.md) §3.20 `notifications.type` CHECK 제약에도 `'tag'`를 추가해야 한다(이미 반영됨).

중복 방지 (권장): 같은 (recipient, actor, type, post_id) like 알림은 갱신(`created_at` bump) 또는 24시간 내 재사용.

본인 액션은 알림 생성 금지.

---

### 4.11 Messages `routers/messages.py`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/conversations` | 내 대화, 마지막 메시지 기준 (배열, 페이지네이션 없음) |
| POST | `/conversations` | `{ "user_id" }` 1:1 get-or-create |
| GET | `/conversations/{id}/messages` | `after_id` 있으면 그 이후만, 없으면 전체(오래된순) |
| POST | `/conversations/{id}/messages` | JSON text 또는 multipart image |
| POST | `/conversations/{id}/read` | 내 last_read_message_id 갱신. 응답 `{ "ok": true }` |

1:1만. 멤버 2명 unique (작은 id, 큰 id 정렬 키 `user_low`, `user_high`).

**ConversationOut**

```json
{
  "id": 1,
  "other_user": { "id": 2, "username": "alex", "avatar_url": null },
  "last_message": { "id": 5, "text": "...", "kind": "text", "sender_id": 2, "created_at": "..." } | null,
  "unread_count": 2,
  "updated_at": "...",
  "is_blocked": false
}
```

`is_blocked`은 나와 상대 사이에 어느 방향이든 차단이 있으면 true — `ChatPane.jsx`가 이 값으로 입력창을 비활성화하고 안내 문구를 보여준다.

**`GET /conversations/{id}/messages`**

```json
{ "items": [{ "...": "Message" }] }
```

이 엔드포인트는 `next_cursor`를 쓰지 않는다(프론트는 최초 진입 시 전체 이력을, 이후 3초마다 `after_id`로 증분만 가져온다 — 과거 방향 페이지네이션 UI가 없음).

**Message**

```json
{
  "id": 5,
  "conversation_id": 1,
  "sender_id": 2,
  "kind": "text",
  "text": "7시에 성수에서 보자!",
  "file_path": null,
  "story_id": null,
  "created_at": "..."
}
```

`kind` = `text` | `image` | `story_reply`. `image`일 때 `file_path`는 (컬럼명과 달리) **절대 URL**이다 — `ChatPane.jsx`가 `<img src={m.file_path}>`로 그대로 렌더링한다. `story_reply`는 `text` + `story_id` optional.

**POST `/conversations/{id}/messages`**

- JSON: `{ "text": "...", "kind": "text" | "story_reply", "story_id"?: number }`
- multipart: `kind=image`, 파일 필드 `file`

응답은 생성된 `Message` 객체 그대로(래핑 없음).

차단 시 POST 403. 메시지 삽입 시 `conversations.updated_at` 갱신.

---

### 4.12 Admin `routers/admin.py`

일반 유저 인증(§3.1)과 완전히 분리된 별도 시스템이다. `users` 테이블에 관리자 row를 두지 않는다 — 검색·피드·추천 등 소셜 기능에 노출되면 안 되기 때문이다. 대신 `.env`의 고정 자격증명(`ADMIN_USERNAME`/`ADMIN_PASSWORD`, 기본값 `admin`/`asdf1234`)과 전용 JWT(`typ: "admin"`, refresh 없음, 기본 12시간 만료)로 인증한다. `/admin/login`을 제외한 모든 경로는 이 관리자 토큰을 요구하며, 일반 유저의 access token으로는 접근할 수 없다(반대도 마찬가지).

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/admin/login` | `{ "username", "password" }` → `{ "access_token", "token_type" }` |
| GET | `/admin/stats` | 통계 대시보드 |
| GET | `/admin/users` | 회원 목록 (`q`, `limit`, `offset`) |
| DELETE | `/admin/users/{user_id}` | 회원 탈퇴 — CASCADE로 게시물/댓글/좋아요/팔로우/알림/대화 등 전부 삭제, 업로드 파일도 정리 |
| GET | `/admin/posts` | 게시물 목록 (`limit`, `offset`) |
| DELETE | `/admin/posts/{post_id}` | 게시물 삭제(본인 확인 없이, 관리자는 누구 게시물이든 삭제 가능) |

회원/게시물 목록은 프론트의 무한 스크롤용 커서(§3.3)가 아니라 `{ items, total, limit, offset }` 형태의 단순 오프셋 페이지네이션을 쓴다 — 관리자 화면은 "페이지 1/5" 같은 표를 기대하지 회원 SNS 피드가 아니기 때문이다.

**AdminUserOut**: `{ id, username, email, full_name, is_private, created_at, post_count, follower_count }` — `created_at`(가입일)과 `email`은 일반 `UserPublic`엔 없지만 관리자에겐 필요해서 별도 스키마로 뺐다.

**AdminPostOut**: `{ id, author_id, author_username, caption, post_type, created_at, like_count, comment_count, thumbnail_url }`

**AdminStatsOut**: `total_users`, `total_posts`, `total_reels`, `total_comments`, `total_likes`, `total_follows`, `active_stories`, `total_conversations`, `total_messages`, `signups_last_7_days`/`posts_last_7_days`(`[{ date, count }]` 7개 고정, 오늘 포함).

회원 탈퇴(`delete_user_cascade`, `services/admin.py`)는 DB 정리를 SQLite의 `ON DELETE CASCADE`에 맡기고([db.md](./db.md) §4), 커밋 전에 그 사용자의 아바타·게시물 미디어·스토리·메시지 첨부 파일만 먼저 디스크에서 지운다.

---

## 5. 서비스 상세

### 5.1 카운트

`post_count`, `follower_count`, `like_count` 등은 **쿼리 집계**로 계산해도 된다. 성능 이슈 생기면 비정규 카운터 컬럼을 추가하되, [db.md](./db.md)를 갱신한다.

### 5.2 삭제 정책

- 사용자 삭제: 본인 탈퇴 UI는 없다(§4.2에 그런 엔드포인트 없음). 관리자 페이지(§4.12 `DELETE /admin/users/{id}`)에서만 가능 — DB CASCADE + 아바타/게시물/스토리/메시지 첨부 파일 unlink.
- 게시물 삭제: DB CASCADE + `uploads/posts` 파일 unlink (없는 파일 무시). 본인(`DELETE /posts/{id}`) 또는 관리자(`DELETE /admin/posts/{id}`) 둘 다 같은 내부 함수(`delete_post_with_files`)를 쓴다.
- 아바타 교체/삭제(`remove_avatar`): 이전 파일이 있으면 unlink 후 교체/NULL 처리.

### 5.3 동시성

좋아요/저장/댓글좋아요/스토리조회는 UNIQUE 제약으로 경쟁 상태를 흡수. IntegrityError → 멱등 성공.

---

## 6. 테스트 (최소)

`pytest` + `httpx.AsyncClient` 또는 `TestClient`, 파일 DB `sqlite:///:memory:` 또는 tmp 파일.

필수 케이스:

1. 회원가입·로그인·me
2. 게시 생성 후 피드에 본인 글 등장
3. 팔로우 후 상대 글이 피드에 등장
4. private 계정 글 403 → 요청 수락 후 200
5. 좋아요 두 번 호출해도 like_count 1
6. 스토리 생성 후 tray, 만료 시각 설정 확인 (테스트에서 TTL을 짧게 패치 가능하면 패치)
7. 차단 후 검색/피드/DM 실패
8. 비로그인으로 `GET /feed/public` 호출 시 공개 계정 게시물만 노출, 비공개 계정 게시물은 제외
9. 게시물 생성 시 `tagged_usernames`에 포함된 사용자에게 `tag` 타입 알림 생성

---

## 7. 완료 기준 (백엔드)

- `/docs` 에 위 엔드포인트가 모두 등장하고, §4 검증 노트의 6개(`PATCH /posts/{id}`, `POST /posts/{id}/tags`, `DELETE /stories/{id}`, `GET /follow-requests`, `DELETE /users/{username}/block`, `GET /blocks`)는 존재하지 않아야 한다
- CORS로 Vite 개발 서버 연동
- SQLite 파일 한 개로 재시작 후에도 데이터 유지
- [front.md](./front.md) 완료 기준을 목업 없이 통과할 수 있는 계약 준수
- 시드 스크립트 `python -m app.seed`: **`frontend/src/mocks/seed.js`와 동일한 데이터셋을 포팅**한다. 프론트가 mock에서 실제 API로 전환되어도 데모 화면이 그대로 보이도록 사용자 9명, 팔로우/팔로우요청, 게시물(캐러셀·릴스 포함), 댓글/대댓글, 좋아요, 저장, 사람 태그, 스토리, 알림(6종 전부), 대화 2건 + 메시지를 동일한 관계로 채운다.

시드 계정 (아이디 / 비밀번호):

| username | password | 비고 |
|---|---|---|
| `demo` | `demo1234` | 기본 데모 로그인 |
| `alex` | `alex1234` | demo와 맞팔 |
| `sam` | `sam1234` | 비공개 계정 |
| `mia.j` | `mia12345` | username에 마침표 포함 (파서 회귀 테스트용) |
| `noah` | `noah1234` | |
| `olivia` | `olivia123` | |
| `jin` | `jin12345` | |
| `liam` | `liam1234` | |
| `test` | `12345` | QA용 |
