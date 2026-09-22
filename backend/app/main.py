import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app import models  # noqa: F401  (모델을 create_all 이 보도록 import)
from app.routers import (
    admin,
    auth,
    comments,
    feed,
    follows,
    messages,
    notifications,
    posts,
    search,
    stories,
    users,
)


def create_app() -> FastAPI:
    app = FastAPI(title="Instagram Clone API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    Base.metadata.create_all(bind=engine)

    for subdir in ("avatars", "posts", "stories", "messages"):
        os.makedirs(os.path.join(settings.upload_dir, subdir), exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

    for router in (
        auth.router,
        users.router,
        follows.router,
        posts.router,
        feed.router,
        comments.router,
        stories.router,
        search.router,
        notifications.router,
        messages.router,
        admin.router,
    ):
        app.include_router(router, prefix="/api")

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
