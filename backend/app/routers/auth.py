from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import User
from app.schemas.common import OkResponse
from app.schemas.user import AuthOut, LoginIn, LogoutIn, RefreshIn, RegisterIn, TokenPair
from app.services.auth import issue_tokens, revoke_refresh_token, rotate_refresh_token
from app.services.privacy import to_user_me
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 이메일입니다.")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 아이디입니다.")

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()

    tokens = issue_tokens(db, user)
    db.commit()
    db.refresh(user)
    return {**tokens, "user": to_user_me(db, user)}


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    identifier = payload.identifier.strip().lower()
    user = (
        db.query(User)
        .filter((User.email == identifier) | (User.username == identifier))
        .first()
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일/아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    tokens = issue_tokens(db, user)
    db.commit()
    return {**tokens, "user": to_user_me(db, user)}


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)):
    tokens = rotate_refresh_token(db, payload.refresh_token)
    db.commit()
    return tokens


@router.post("/logout", response_model=OkResponse)
def logout(payload: LogoutIn, db: Session = Depends(get_db)):
    revoke_refresh_token(db, payload.refresh_token)
    db.commit()
    return {"ok": True}
