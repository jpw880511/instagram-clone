from collections.abc import Generator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User
from app.utils.security import decode_token


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _user_from_bearer(authorization: str | None, db: Session) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer ") :]
    payload = decode_token(token)
    if not payload or payload.get("typ") != "access":
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    return db.get(User, int(user_id))


def get_current_user(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> User:
    user = _user_from_bearer(authorization, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증이 필요합니다.")
    return user


def get_current_user_optional(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> User | None:
    return _user_from_bearer(authorization, db)


def get_current_admin(authorization: str | None = Header(default=None)) -> None:
    """관리자 전용 인증. users 테이블과 무관한 typ="admin" 토큰만 허용한다."""
    if authorization and authorization.startswith("Bearer "):
        payload = decode_token(authorization[len("Bearer ") :])
        if payload and payload.get("typ") == "admin":
            return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="관리자 인증이 필요합니다.")
