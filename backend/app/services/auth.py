from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import RefreshToken, User
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
    verify_token_hash,
)


def issue_tokens(db: Session, user: User) -> dict:
    access_token = create_access_token(user.id)
    refresh_token, jti, expires_at = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
    )
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


def _lookup_valid_refresh_row(db: Session, refresh_token: str) -> RefreshToken:
    payload = decode_token(refresh_token)
    if not payload or payload.get("typ") != "refresh" or not payload.get("jti"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="세션이 만료되었습니다.")

    row = db.query(RefreshToken).filter(RefreshToken.jti == payload["jti"]).first()
    if row is None or not verify_token_hash(refresh_token, row.token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="세션이 만료되었습니다.")
    if row.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="세션이 만료되었습니다.")
    if row.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="세션이 만료되었습니다.")
    return row


def rotate_refresh_token(db: Session, refresh_token: str) -> dict:
    row = _lookup_valid_refresh_row(db, refresh_token)
    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="세션이 만료되었습니다.")
    row.revoked_at = datetime.now(timezone.utc)
    return issue_tokens(db, user)


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    payload = decode_token(refresh_token)
    if not payload or not payload.get("jti"):
        return
    row = db.query(RefreshToken).filter(RefreshToken.jti == payload["jti"]).first()
    if row is not None and row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
