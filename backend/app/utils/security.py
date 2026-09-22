import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _pwd_context.verify(password, hashed)


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return _encode(payload)


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at)."""
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4().hex
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": str(user_id), "typ": "refresh", "jti": jti, "iat": now, "exp": expires_at}
    return _encode(payload), jti, expires_at


def create_admin_token() -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "admin",
        "typ": "admin",
        "iat": now,
        "exp": now + timedelta(hours=settings.admin_token_expire_hours),
    }
    return _encode(payload)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def hash_token(token: str) -> str:
    """refresh_tokens.token_hash — 원문 저장 금지.

    JWT 자체가 이미 고엔트로피 랜덤값(jti 포함)이라 bcrypt 같은 느린 해시가 필요 없고,
    오히려 bcrypt는 입력을 72바이트로 자르기 때문에 JWT 문자열엔 안전하지 않다.
    빠른 SHA-256으로 충분하고, 비교는 타이밍 공격을 막기 위해 hmac.compare_digest를 쓴다.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_token_hash(token: str, token_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), token_hash)
