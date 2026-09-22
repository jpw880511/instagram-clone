# 프론트엔드 명세서 (Instagram 클론)

- 스택: **React 18 + Vite + React Router v6 + CSS Modules**
- 상태: **Context API** (인증, 토스트) + 페이지 단위 `useState` / `useReducer`
- HTTP: **Fetch** 래퍼 (`src/api/client.js`)
- 미디어: 이미지 업로드는 `multipart/form-data`, 표시는 백엔드 정적 URL
- 대상: 데스크톱 웹 + 모바일 웹 (Instagram 웹과 유사한 레이아웃)

백엔드 계약은 [backend.md](./backend.md), 스키마는 [db.md](./db.md), 실행 순서는 [guide.md](./guide.md)를 따른다.

---

## 1. 목표 UX

완전한 Instagram 웹 클론. 아래 기능을 **로그인 후 실제로 동작**해야 한다.

| 영역 | 필수 기능 |
|------|-----------|
| 인증 | 회원가입, 로그인, 로그아웃, 토큰 갱신, 보호 라우트 |
| 피드 | 팔로우한 사용자의 게시물 무한 스크롤, 좋아요/댓글/저장 |
| 스토리 | 상단 스토리 바, 뷰어(좌우 이동, 진행 바), 본인 스토리 업로드 |
| 탐색 | 추천 그리드, 사용자/해시태그 검색 |
| 게시 | 다중 이미지 게시, 캡션, 위치, 해시태그/멘션 파싱 |
| 릴스 | `post_type=reel` 세로 영상 피드 (음소거 토글, 스크롤 전환) |
| 프로필 | 그리드/저장됨, 팔로워·팔로잉, 프로필 수정, 비공개 계정 |
| 관계 | 팔로우/언팔로우, 팔로우 요청 수락·거절, 차단 |
| 알림 | 좋아요, 댓글, 팔로우, 멘션, 팔로우 요청 |
| DM | 대화 목록, 1:1 메시지(텍스트/이미지), 읽음, 폴링 |
| 게시물 상세 | 캐러셀, 댓글 스레드(대댓글), 좋아요한 사람 |

**명시적으로 제외 (1차):** 실시간 라이브, 쇼핑, 노트(Notes), 위치 지도, 이메일 인증, OAuth, 푸시 알림.

---

## 2. 디렉터리 구조

```
frontend/
  index.html
  package.json
  vite.config.js
  src/
    main.jsx
    App.jsx
    styles/
      tokens.css          # 색, 간격, 타이포
      global.css
    api/
      client.js           # JWT 첨부, 401 시 refresh
      auth.js
      users.js
      posts.js
      stories.js
      comments.js
      follows.js
      search.js
      notifications.js
      messages.js
    context/
      AuthContext.jsx
      ToastContext.jsx
    hooks/
      useInfiniteScroll.js
      useDebounce.js
      useMediaPreview.js
    components/
      layout/Navbar.jsx
      layout/BottomNav.jsx
      layout/AuthLayout.jsx
      layout/AppShell.jsx
      feed/FeedPost.jsx
      feed/PostActions.jsx
      feed/Caption.jsx
      media/Carousel.jsx
      media/Avatar.jsx
      stories/StoryBar.jsx
      stories/StoryViewer.jsx
      comments/CommentList.jsx
      comments/CommentInput.jsx
      profile/ProfileHeader.jsx
      profile/PostGrid.jsx
      modal/Modal.jsx
      modal/CreatePostModal.jsx
      modal/LikesModal.jsx
      search/SearchPanel.jsx
      notifications/NotificationItem.jsx
      chat/ConversationList.jsx
      chat/ChatPane.jsx
      common/Spinner.jsx
      common/EmptyState.jsx
      common/ErrorBanner.jsx
    pages/
      LoginPage.jsx
      RegisterPage.jsx
      HomePage.jsx
      ExplorePage.jsx
      ReelsPage.jsx
      MessagesPage.jsx
      NotificationsPage.jsx
      ProfilePage.jsx
      EditProfilePage.jsx
      PostDetailPage.jsx
      HashtagPage.jsx
      FollowListPage.jsx
      NotFoundPage.jsx
    utils/
      timeAgo.js
      parseCaption.js     # #태그, @멘션 링크화
      validators.js
```

---

## 3. 라우팅

| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/login` | 로그인 | 게스트 전용 |
| `/register` | 회원가입 | 게스트 전용 |
| `/` | 홈 피드 | **선택** — 비로그인도 공개 계정 피드(`GET /feed/public`)를 본다(backend.md §4.5) |
| `/explore` | 탐색 | 필수 |
| `/reels` | 릴스 | 필수 |
| `/direct` | DM 목록 | 필수 |
| `/direct/:conversationId` | DM 스레드 | 필수 |
| `/notifications` | 알림 (모바일) | 필수 |
| `/p/:postId` | 게시물 상세 | 필수 |
| `/explore/tags/:name` | 해시태그 | 필수 |
| `/:username` | 프로필 | 필수 |
| `/:username/followers` | 팔로워 | 필수 |
| `/:username/following` | 팔로잉 | 필수 |
| `/accounts/edit` | 프로필 수정 | 필수 |
| `/admin`, `/admin/login`, `/admin/users`, `/admin/posts` | 관리자 페이지 | 관리자 전용, 일반 유저 인증과 별개 (backend.md §4.12) |

- 인증 필수 라우트는 `ProtectedRoute`로 감싼다. 미로그인 시 `/login?next=` 로 이동. `/`는 예외 — `ProtectedRoute` 밖에 있고 `HomePage`가 로그인 여부에 따라 `getFeed`/`getPublicFeed`를 골라 부른다.
- 로그인 사용자는 `/login`, `/register` 접근 시 `/` 로 리다이렉트.
- `/:username` 은 예약 경로(`explore`, `reels`, `direct`, `notifications`, `p`, `accounts`, `login`, `register`, `admin`)와 충돌하지 않게 라우터 순서를 고정한다. `/admin/*`는 `src/admin/`에 완전히 분리된 하위 트리(자체 `AdminAuthContext`, 자체 로그인/보호 라우트)로 구현되어 있고, 메인 앱의 `AppShell`/`AuthContext`와 공유하지 않는다.

---

## 4. 레이아웃 · 비주얼

### 4.1 디자인 토큰 (`tokens.css`)

Instagram 라이트 테마를 기본으로 한다.

- 배경: `#ffffff` / 보조 배경 `#fafafa`
- 텍스트: `#262626` / 보조 `#8e8e8e`
- 구분선: `#dbdbdb`
- 링크·강조: `#0095f6`
- 위험: `#ed4956`
- 좋아요 채워진 하트: `#ed4956`
- 스토리 링: `#f09433` → `#e6683c` → `#dc2743` → `#cc2366` → `#bc1888` 그라데이션
- 최대 콘텐츠 폭: 피드 630px, 우측 사이드 319px, 셸 전체 약 975px
- 폰트: system-ui, `-apple-system`, `Segoe UI`, sans-serif
- 아바타: 24 / 32 / 44 / 56 / 150px

다크 모드는 필수 아님. `prefers-color-scheme` 대응은 선택.

### 4.2 내비게이션

**데스크톱 (≥768px)**

- 좌측 고정 사이드바: 로고, Home, Search(패널 토글), Explore, Reels, Messages, Notifications, Create, Profile
- Search/Notifications는 사이드 패널(검색 결과 / 알림 리스트)을 연다.

**모바일 (<768px)**

- 하단 탭: Home, Explore, Create, Reels, Profile
- 상단: 로고, 알림 아이콘, DM 아이콘
- Create는 모달

아이콘은 SVG 인라인. 외부 아이콘 CDN 의존 금지.

---

## 5. 화면별 요구사항

### 5.1 로그인 / 회원가입

- 중앙 카드, 우측 또는 하단에 전환 링크
- 로그인: `identifier`(이메일 또는 username) + `password`
- 회원가입: `email`, `username`, `full_name`, `password`, `password_confirm`
- 검증: username 소문자·숫자·`.` `_` 1–30자, 비밀번호 8자 이상
- 서버 에러 메시지를 필드/배너에 표시
- 성공 시 `access_token`, `refresh_token`을 `localStorage`에 저장 후 `/` 이동
- 비밀번호 표시 토글

### 5.2 홈 피드

구성 (위에서 아래):

1. `StoryBar` — 본인 스토리 추가 버튼 + 팔로우 대상 스토리 그룹 (최신 미열람 우선)
2. `FeedPost` 리스트 — `GET /api/feed?cursor=` 무한 스크롤
3. 데스크톱 우측: 현재 사용자 미니 프로필 + `GET /api/users/suggested` 추천 팔로우

게시물 카드:

- 헤더: 아바타, username, 위치, 더보기(수정/삭제 — 본인만, 팔로우 취소/차단 — 타인)
- 미디어 캐러셀: 좌우 화살표, 점 인디케이터, 더블클릭 좋아요 + 하트 애니메이션
- 액션: 좋아요, 댓글(상세로 포커스), 공유(링크 복사 토스트), 저장
- 좋아요 수 클릭 → `LikesModal`
- 캡션: username + 본문, 3줄 초과 시 `더 보기`
- 댓글 미리보기 2개 + `댓글 n개 모두 보기`
- 상대 시간 (`timeAgo`)

빈 피드: “아직 게시물이 없습니다. 사람을 팔로우하세요.” + Explore 링크

### 5.3 스토리

- 링: 미열람 컬러 그라데이션, 열람 회색, 본인만 스토리 있으면 얇은 링
- 클릭 시 풀스크린 `StoryViewer`
  - 세그먼트당 5초 자동 진행 (이미지만 1차 필수, 영상은 길이만큼)
  - 좌/우 클릭 또는 키보드 화살표로 이전/다음 스토리·유저
  - 일시정지: 마우스 다운 / 스페이스
  - 본인 스토리: 조회수, 조회자 목록 모달
  - 타인: 하단 답장 입력 → `POST /api/messages` (해당 유저와의 대화 생성/재사용)
- 업로드: 이미지 선택 → 미리보기 → `POST /api/stories` (24시간 TTL은 서버)

### 5.4 게시 작성 (`CreatePostModal`)

단계:

1. 파일 선택 (이미지 1–10장, 또는 릴스면 영상 1개). `accept` 제한: `image/jpeg,image/png,image/webp,video/mp4`
2. 미리보기 캐러셀, 순서 변경(선택)
3. 캡션(2200자), 위치 문자열, 사람 태그(username 검색 후 추가)
4. 공유 → `POST /api/posts` multipart
   - `caption`, `location`, `post_type` (`post` | `reel`)
   - `files[]`
   - `tagged_usernames` JSON 문자열 배열

업로드 중 프로그레스 바. 실패 시 재시도.

### 5.5 게시물 상세 `/p/:postId`

- 데스크톱: 좌측 미디어, 우측 헤더+댓글+입력 (Instagram 모달형 레이아웃)
- 모바일: 세로 스택
- 댓글: 최상위 + 대댓글 접기/펼치기 (`parent_id`)
- 댓글 좋아요, 본인 댓글 삭제
- 비공개 계정 + 비팔로워면 403 안내 화면

### 5.6 탐색 / 검색

- 탐색 그리드: `GET /api/explore?cursor=` 정사각 썸네일, 호버 시 좋아요·댓글 수
- Search 패널: 디바운스 300ms, `GET /api/search?q=&type=user|hashtag`
  - 최근 검색 `localStorage` (`recent_searches`, 최대 20)
  - 사용자: 아바타, username, full_name
  - 해시태그: `#name`, 게시물 수

### 5.7 릴스 `/reels`

- 세로 풀하이트 카드, 스크롤 스냅
- `GET /api/reels?cursor=`
- 우측 액션 열: 좋아요, 댓글, 저장, 작성자
- 영상: `muted` 기본, 탭 시 음소거 해제, 뷰포트 벗어나면 pause
- 1차에서 영상이 없으면 세로 이미지도 허용 (같은 레이아웃)

### 5.8 프로필 `/:username`

- 아바타 150px, username, Edit profile / Follow / Requested / Following / Message
- 게시물 수, 팔로워 수, 팔로잉 수 (클릭 시 리스트)
- bio, website(`https`만 링크로)
- 탭: **게시물** 그리드, **저장됨**(본인만), **태그됨**
- 비공개 + 비팔로워: 자물쇠 안내, 그리드 숨김
- 본인: 설정 — 로그아웃, 계정 비공개 토글(수정 페이지)

팔로워/팔로잉 페이지: 검색 필터(클라이언트), 각 행 Follow 버튼, 무한 스크롤.

### 5.9 프로필 수정

- 아바타 변경 (즉시 업로드 `PATCH /api/users/me` multipart 또는 분리 엔드포인트)
- `full_name`, `username`, `bio`(150자), `website`, `is_private`
- 저장 후 프로필로 이동

### 5.10 알림

- `GET /api/notifications?cursor=`
- 타입별 카피:
  - `like`: `{user}님이 게시물을 좋아합니다`
  - `comment`: `{user}님: {preview}`
  - `follow`: `{user}님이 팔로우하기 시작했습니다`
  - `follow_request`: `{user}님이 팔로우를 요청했습니다` + 확인/삭제
  - `mention`: `{user}님이 회원님을 언급했습니다`
- 읽지 않음 점. 패널 오픈 시 `POST /api/notifications/read`
- 클릭 시 해당 게시물/프로필로 이동

### 5.11 Direct

- 좌: 대화 목록 (`GET /api/conversations`) — 상대 아바타, username, 마지막 메시지, 시간, 안읽음 뱃지
- 우: 메시지 버블, 본인 우측 정렬
- 입력: 텍스트 + 이미지 첨부
- 3초 폴링 (`GET /api/conversations/:id/messages?after_id=`)
- 새 대화: 사용자 검색 후 `POST /api/conversations` `{ user_id }`
- 차단된 상대: 입력 비활성 + 안내

---

## 6. API 클라이언트 규칙

`src/api/client.js`

- Base URL: `import.meta.env.VITE_API_BASE` (기본 `http://localhost:8000`)
- JSON 요청: `Content-Type: application/json`
- 모든 인증 요청: `Authorization: Bearer <access_token>`
- 401 한 번: `POST /api/auth/refresh` 후 원요청 재시도. refresh 실패 시 로그아웃 → `/login`
- 에러 바디: `{ "detail": string | [{loc, msg, type}] }` 를 사용자 메시지로 정규화
- 페이지네이션: 응답 `{ items, next_cursor }` . `next_cursor`가 `null`이면 종료
- 미디어 URL이 상대경로면 `VITE_API_BASE`를 prefix

모듈별 함수는 [backend.md](./backend.md) 엔드포인트와 1:1로 맞춘다.

---

## 7. 상태 · 인증

`AuthContext`

- `user`: `GET /api/users/me` 결과 또는 `null`
- `login`, `register`, `logout`, `refreshUser`
- 앱 부팅 시 access 있으면 `/me` 호출. 실패 시 refresh 후 재시도
- `logout`: `POST /api/auth/logout` + 로컬 토큰 삭제

전역으로 두지 말 것: 피드 목록, 댓글, DM 메시지(페이지/컴포넌트 로컬).

좋아요/저장/팔로우는 **낙관적 업데이트** 후 실패 시 롤백.

---

## 8. 컴포넌트 계약 (핵심)

### `FeedPost`

```ts
props: { post: Post; onChanged?: (post: Post) => void }
```

`Post` 필드는 백엔드 `PostOut`과 동일해야 한다 (`id`, `author`, `media[]`, `caption`, `like_count`, `comment_count`, `liked`, `saved`, `location`, `created_at`, `post_type`, …).

### `Carousel`

```ts
props: { media: { id, url, media_type, width?, height? }[] }
```

이미지는 `object-fit: cover` (피드), 상세는 `contain`.

### `CommentInput`

Enter로 전송, Shift+Enter 줄바꿈. 빈 문자열 전송 금지. `@` 입력 시 팔로잉 사용자 간단 자동완성(선택, 없으면 생략 가능).

---

## 9. 접근성 · 품질

- 아이콘 버튼에 `aria-label`
- 모달: Escape 닫기, 포커스 트랩
- 이미지 `alt`: 캡션 앞 100자 또는 `사진`
- 로딩: 스켈레톤 또는 Spinner. 에러: 재시도 버튼
- 라우트 전환 시 스크롤 상단

---

## 10. 환경 변수

```
VITE_API_BASE=http://localhost:8000
```

CORS는 백엔드가 `http://localhost:5173` 허용.

---

## 11. 완료 기준 (프론트)

1. 게스트는 로그인/회원가입만 가능
2. 가입 → 프로필 사진 없이 피드 진입
3. 게시 작성 → 홈/프로필/상세에 즉시 반영
4. 좋아요·댓글·저장·팔로우가 새로고침 후에도 유지
5. 비공개 계정 그리드가 비팔로워에게 숨겨짐
6. 스토리 24시간 정책은 서버 응답 기준으로 바가 갱신됨
7. DM 폴링으로 두 브라우저 간 메시지 확인 가능
8. 모바일 폭 390px, 데스크톱 1280px에서 레이아웃 붕괴 없음

구현 시 백엔드 미완성 엔드포인트는 목업하지 말고, [backend.md](./backend.md) 순서에 맞춰 연동한다.
