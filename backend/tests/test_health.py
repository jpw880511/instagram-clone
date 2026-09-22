from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


# TODO: backend.md §6 의 필수 케이스(회원가입/로그인, 피드, 프라이버시, 좋아요,
# 스토리, 차단)를 각 Phase 구현 뒤 추가한다.
