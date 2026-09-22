"""데이터베이스 스키마 적용 스크립트.

이 프로젝트는 Alembic 같은 마이그레이션 도구를 쓰지 않는다(guide.md §5, backend.md §2).
db.md에 정의된 테이블은 SQLAlchemy 모델의 ``Base.metadata.create_all()`` 로 생성/동기화한다.
서버를 띄우면(``app.main``) 어차피 자동으로 실행되지만, 서버를 켜지 않고 스키마만
적용하거나 재확인하고 싶을 때 이 스크립트를 직접 쓴다.

    cd backend
    python -m app.init_db

``create_all``은 이미 존재하는 테이블은 건드리지 않고, 없는 테이블만 만든다(멱등).
컬럼 추가/제약 변경처럼 기존 테이블 구조를 바꿔야 하면 db.md를 먼저 수정한 뒤
개발 중인 ``instagram.db``를 지우고 다시 이 스크립트를 실행한다(db.md §7).
"""

import sys

from app import models  # noqa: F401  (create_all 이 모든 테이블을 보도록 import)
from app.config import settings
from app.database import Base, engine


def main() -> None:
    # Windows 콘솔의 기본 코드페이지(cp949 등)에서 한글 출력이 깨지는 것을 방지한다.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        tables = conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).scalars().all()
    print(f"DATABASE_URL = {settings.database_url}")
    print(f"{len(tables)}개 테이블 적용 완료:")
    for name in tables:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
