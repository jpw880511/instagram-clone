from datetime import datetime, timezone

from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator):
    """UTC 시각을 항상 timezone-aware(``tzinfo=timezone.utc``) 로 왕복시키는 DateTime.

    SQLite에는 진짜 timezone-aware 컬럼 타입이 없다 — ``sqlalchemy.DateTime(timezone=True)``를
    pysqlite 드라이버와 함께 쓰면 값을 저장/커밋 후 재조회할 때 조용히 tzinfo가 사라지고
    naive datetime으로 돌아온다(직접 확인됨). backend.md/db.md는 "DB는 timezone-aware
    DateTime 저장"을 명시하므로, 모든 모델은 ``sqlalchemy.DateTime`` 대신 이 타입을 쓴다.

    저장 시: aware datetime은 UTC로 변환 후 naive로 벗겨서 저장(naive 입력은 이미 UTC로 간주).
    조회 시: 저장된 naive datetime에 ``tzinfo=timezone.utc``를 다시 붙여서 돌려준다.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
