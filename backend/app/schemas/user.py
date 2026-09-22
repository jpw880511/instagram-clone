import re

from pydantic import BaseModel, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9._]{1,30}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class RegisterIn(BaseModel):
    email: str
    username: str
    full_name: str = ""
    password: str

    @field_validator("email")
    @classmethod
    def _email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("올바른 이메일 형식이 아닙니다.")
        return v

    @field_validator("username")
    @classmethod
    def _username_format(cls, v: str) -> str:
        v = v.lower()
        if not USERNAME_RE.match(v):
            raise ValueError("username은 소문자, 숫자, '.', '_'만 사용해 1-30자여야 합니다.")
        return v

    @field_validator("password")
    @classmethod
    def _password_len(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("비밀번호는 8자 이상이어야 합니다.")
        return v


class LoginIn(BaseModel):
    identifier: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutIn(BaseModel):
    refresh_token: str


class UserSummary(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None


class UserPublic(BaseModel):
    id: int
    username: str
    full_name: str
    bio: str
    website: str
    avatar_url: str | None = None
    is_private: bool
    post_count: int
    follower_count: int
    following_count: int
    is_following: bool
    is_followed_by: bool
    follow_status: str
    has_story: bool


class UserMe(UserPublic):
    email: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthOut(TokenPair):
    user: UserMe


class FollowStatusOut(BaseModel):
    follow_status: str
