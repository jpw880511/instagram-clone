# Gram (Instagram 클론)

React(Vite) + FastAPI + SQLite 기반 Instagram 웹 클론. 상세 명세는 [docs/guide.md](./docs/guide.md) 참고.

이번 단계는 **프론트엔드 중심 구현**이다. 백엔드는 FastAPI + SQLAlchemy + SQLite 기본 골격만
갖췄고([docs/backend.md](./docs/backend.md) Phase 0), 프론트엔드는 `src/mocks/` 의 인메모리
가짜 API로 동작하여 백엔드 없이도 전체 UI를 바로 확인할 수 있다. 이후 Phase 1부터
[docs/guide.md](./docs/guide.md) 순서대로 백엔드를 구현하면서 `src/api/*.js` 내부를
실제 fetch 호출로 교체하면 된다.

## 실행 방법 (원클릭)

저장소 루트에서 다음 중 하나만 실행하면 된다.

```bash
npm run dev
```

또는 Windows 탐색기에서 **`run.bat`** 더블클릭.

이 한 번의 실행으로 자동으로:

1. `backend/.venv` 가 없으면 생성하고 `pip install -r requirements.txt`
2. `backend/.env` 가 없으면 `.env.example` 로부터 생성
3. `frontend/node_modules` 가 없으면 `npm install`
4. `frontend/.env` 가 없으면 `.env.example` 로부터 생성
5. 백엔드(`uvicorn`, :8000)와 프론트엔드(`vite`, :5173)를 동시에 실행
6. 프론트가 응답하면 기본 브라우저로 자동 접속

종료하려면 실행 중인 터미널에서 `Ctrl+C` (또는 `run.bat` 창을 닫기).

Python 이 설치되어 있지 않으면 백엔드 실행은 건너뛰고 프론트엔드만 실행된다 (프론트는
`src/mocks/`의 목업 데이터로 동작하므로 백엔드 없이도 전체 UI 확인 가능).

데모 로그인 계정: `demo` / `demo1234` (그 외 `alex`/`alex1234`, `sam`/`sam1234` 등 `frontend/src/mocks/seed.js` 참고)

`http://localhost:8000/docs` 에서 백엔드 헬스체크 엔드포인트 확인 가능. 아직 인증/피드 등
실제 엔드포인트는 구현되어 있지 않다 ([docs/backend.md](./docs/backend.md) 참고).

### 수동 실행 (참고용)

```bash
# 백엔드
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000

# 프론트엔드 (새 터미널)
cd frontend
npm install
npm run dev
```

## 스크린샷

`npm run dev` 후 로그인하면 스토리 바, 피드, 탐색, 릴스, 프로필, DM, 알림까지 모두
동작하는 상태로 확인할 수 있다 (데이터는 `localStorage` 에 저장되는 목업 데이터).
# instagram-clone
