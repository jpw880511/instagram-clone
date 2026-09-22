from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./instagram.db"
    # 기본값을 두지 않는다 — .env 없이 뜨면 누구나 아는 값으로 토큰을 위조할 수 있으므로
    # 반드시 .env(gitignore 대상)에서 각자 값을 채워야 서버가 기동된다.
    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14
    upload_dir: str = "./uploads"
    public_base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173"
    max_upload_mb: int = 20
    story_ttl_hours: int = 24

    # 관리자 페이지: users 테이블에 별도 row를 두지 않는 고정 자격증명 + 전용 JWT(typ="admin").
    # 일반 유저 인증 경로와 완전히 분리되어 있어 소셜 그래프(검색/피드/추천 등)에 노출되지 않는다.
    admin_username: str = "admin"
    admin_password: str  # 기본값 없음 — 반드시 .env에서 지정
    admin_token_expire_hours: int = 12

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
