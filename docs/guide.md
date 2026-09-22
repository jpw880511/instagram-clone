# 전체 프로젝트 가이드 — Instagram 클론

React(Vite) + FastAPI + SQLite로 **동작하는 Instagram 웹 클론**을 만든다.  
이 문서는 저장소 루트에서 개발·실행·검수할 때의 단일 진입점이다.

| 문서 | 역할 |
|------|------|
| [front.md](./front.md) | 화면, 라우트, 컴포넌트, 클라이언트 규칙 |
| [backend.md](./backend.md) | API, 인증, 비즈니스 로직, 테스트 |
| [db.md](./db.md) | 테이블, 제약, 쿼리 패턴 |
| 본 문서 | 아키텍처, 폴더, 환경, 구현 순서, 검수 |

세 명세가 충돌하면 **db.md(데이터) → backend.md(계약) → front.md(표현)** 순으로 맞춘 뒤 문서를 함께 고친다. 구현만 맞추고 문서를 내버려 두지 않는다.

---

## 1. 제품 범위

**포함**

- 계정: 가입/로그인/JWT, 프로필 수정, 비공개 계정
- 소셜: 팔로우, 팔로우 요청, 차단
- 콘텐츠: 다중 이미지 게시, 릴스(영상 또는 세로 미디어), 캡션, 해시태그, 멘션, 사람 태그
- 상호작용: 좋아요, 댓글/대댓글, 저장, 알림
- 스토리: 24시간, 트레이, 조회자, 스토리 답장(DM)
- 탐색/검색: 사용자, 해시태그, 탐색 그리드
- DM: 1:1 텍스트·이미지, 폴링
- 시드 계정으로 즉시 데모 가능
- 관리자 페이지: 회원 관리(가입일 확인·탈퇴), 게시물 관리(삭제), 통계 대시보드 — `/admin`, 일반 유저 인증과 분리된 고정 계정(`admin`/`asdf1234`). 자세한 계약은 [backend.md](./backend.md) §4.12, 라우팅은 [front.md](./front.md) §3 참고.

**제외 (명시)**

- Instagram 공식 API, 크롤링, 상표 에셋 무단 사용
- OAuth, 이메일 발송, 비밀번호 찾기
- 그룹 DM, 라이브, 쇼핑, 광고, 알고리즘 광고 랭킹
- WebSocket 실시간 (2차 후보)
- 네이티브 앱

> 초안에는 "관리자 CMS"도 제외 목록에 있었으나, 이후 요청으로 회원/게시물 관리 + 통계 대시보드 수준의 관리자 페이지를 추가했다. 일반 소셜 기능 대비 최소한의 범위(users 테이블에 없는 고정 자격증명, 별도 인증)로 한정한다.

UI는 Instagram **웹**의 구조를 참고하되, 로고·폰트·스프라이트 등 독점 에셋은 사용하지 않고 자체 SVG/텍스트 로고(`Gram` 등 가칭)를 쓴다.

---

## 2. 시스템 아키텍처

```
브라우저 (Vite :5173)
    │  JSON / multipart
    │  Authorization: Bearer
    ▼
FastAPI (:8000)
    ├─ /api/*     REST
    ├─ /uploads/* 정적 파일
    └─ /docs      OpenAPI
         │
         ├─ SQLAlchemy ── SQLite 파일 instagram.db
         └─ 디스크 uploads/
```

- 프론트는 세션 쿠키를 쓰지 않는다. JWT만.
- 새로고침 후에도 글·좋아요가 남으려면 반드시 SQLite에 커밋되어야 한다. 메모리 배열 저장 금지.
- 프로덕션 배포(Nginx, HTTPS)는 1차 범위 밖. 로컬 두 프로세스면 완료로 본다.

---

## 3. 저장소 레이아웃

```
13_my_instagram/
  front.md
  backend.md
  db.md
  guide.md
  frontend/                 # Vite React
  backend/                  # FastAPI
    app/
    uploads/
    seed_assets/
    tests/
    requirements.txt
    .env.example
  README.md                 # 실행 방법만 짧게 (구현 시 작성)
```

모노레포. 프론트·백 패키지 매니저를 섞지 않는다.

---

## 4. 로컬 실행

### 4.1 백엔드

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# SECRET_KEY 설정
uvicorn app.main:app --reload --port 8000
```

별도 시드:

```bash
python -m app.seed
```

### 4.2 프론트엔드

```bash
cd frontend
npm install
# .env : VITE_API_BASE=http://localhost:8000
npm run dev
```

브라우저: `http://localhost:5173`

데모 로그인: `demo` / `demo1234` ([backend.md](./backend.md) 시드)

### 4.3 권장 requirements.txt (구현 시 고정 버전 기입)

```
fastapi
uvicorn[standard]
sqlalchemy
pydantic-settings
python-jose[cryptography]
passlib[bcrypt]
python-multipart
httpx
pytest
```

프론트 `package.json` 의존성: `react`, `react-dom`, `react-router-dom`. UI 라이브러리(MUI 등)는 쓰지 않고 CSS Modules로 Instagram 웹에 가깝게 맞춘다.

---

## 5. 구현 순서 (필수)

한 사람이든 에이전트든 **이 순서를 건너뛰지 않는다.** 앞 단계가 API로 동작해야 다음 화면을 붙인다.

### Phase 0 — 골격

1. `backend` FastAPI hello, CORS, SQLite 연결, `users` 테이블
2. `frontend` Vite, 라우터, `tokens.css`, `AppShell` 빈 레이아웃
3. API client + 환경변수

### Phase 1 — 인증

1. register / login / refresh / logout / `users/me`
2. LoginPage, RegisterPage, AuthContext, ProtectedRoute
3. 새로고침 후 로그인 유지 확인

### Phase 2 — 프로필과 게시

1. [db.md](./db.md)의 posts, post_media
2. 게시 생성·조회·삭제, 정적 업로드
3. 프로필 페이지 + 그리드, CreatePostModal
4. 시드 이미지로 수동 확인

### Phase 3 — 피드와 상호작용

1. follows, likes, saves, comments
2. Home feed, 낙관적 좋아요
3. PostDetail, 대댓글

### Phase 4 — 그래프 프라이버시

1. follow_requests, blocks, is_private
2. 403 처리 UI
3. 팔로워/팔로잉 리스트, suggested

### Phase 5 — 스토리 · 탐색 · 해시태그

1. stories + tray + viewer
2. search, explore, hashtag page
3. caption 파서와 알림 mention

### Phase 6 — 알림 · DM · 릴스

1. notifications
2. conversations / messages + 폴링
3. ReelsPage

### Phase 7 — 다듬기

1. 시드 스크립트
2. 백엔드 최소 pytest
3. 모바일/데스크톱 레이아웃, 빈 상태, 에러 배너
4. [front.md](./front.md) §11 · [backend.md](./backend.md) §7 체크리스트

---

## 6. 협업 규칙 (프론트 ↔ 백)

- 필드 이름은 명세의 JSON과 **똑같이**. camelCase로 바꾸지 않는다 (`full_name`, `created_at`).
- 날짜는 ISO-8601 (`2026-09-16T02:18:00+00:00`). 프론트 `timeAgo`만 상대시간.
- 생성은 201, 삭제는 204 또는 `{ ok: true }` 중 **백엔드가 하나로 통일**하고 프론트가 따른다. 권장: 삭제 204, 좋아요 토글 POST/DELETE 200 + `{ liked, like_count }`.
- 페이지네이션 키는 항상 `items`, `next_cursor`.
- 파일 응답 URL은 백엔드가 절대 경로로 내려 주거나, 프론트가 `VITE_API_BASE`를 붙인다. **한 쪽으로 통일**: 백엔드 절대 URL (`PUBLIC_BASE_URL`).

---

## 7. 보안 최소선

- 비밀번호 해시 없이 저장 금지
- `SECRET_KEY`를 저장소에 커밋하지 않음 (`.env` gitignore)
- 업로드은 MIME + 확장자 화이트리스트, 경로 traversal 금지 (`uuid` 파일명)
- 모든 게시/스토리/댓글 읽기에 `can_view_*` 적용. IDOR로 비공개 글 조회가 되면 미완료
- SQL은 ORM 파라미터 바인딩. 문자열 포맷으로 쿼리 금지
- CORS는 개발 오리진만

이 저장소는 **학습용 클론**이다. 실서비스 비밀번호 재사용 금지.

---

## 8. 검수 시나리오 (수동)

두 브라우저(또는 시크릿)로 사용자 A=`demo`, B=`alex`, C=`sam`(비공개)을 쓴다.

1. A 가입/로그인, 아바타·bio 수정
2. A가 사진 2장 게시, 캡션에 `#sunset @alex`
3. B가 피드에서 보여야 함 (맞팔 시드) / 좋아요·댓글·저장
4. A가 C 팔로우 → requested, C 프로필 그리드 숨김
5. C 수락 후 A에게 C 게시 노출, 알림
6. A 스토리 업로드, B 트레이에 컬러 링, 열람 후 회색, A가 viewer 확인
7. B가 스토리 답장 → A DM
8. A가 B 차단 → 검색·피드·메시지 전송 실패
9. 릴스 탭 스크롤
10. 390px 너비에서 하단 탭·작성 모달

자동화 테스트가 없어도 위 10개가 통과해야 “완전한 기능”으로 본다.

---

## 9. 에이전트/개발자 작업 방식

- 새 기능은 **DB 컬럼 → 모델 → 엔드포인트 → 프론트 화면** 순
- 넓은 리팩터보다 페이즈 단위 커밋을 권장 (사용자가 커밋을 요청할 때)
- 라이브러리 추가가 명세에 없으면 먼저 문서에 이유를 적지 말고, 이 스택으로 해결
- 완성 전 README에 실행 명령, 시드 계정, 스크린샷(선택)만 추가

구현 시작 위치: **Phase 0** (`backend/app/main.py`, `frontend` Vite 스캐폴드).
