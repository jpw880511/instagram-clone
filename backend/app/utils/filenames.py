import uuid

from app.config import settings

IMAGE_MIME_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
VIDEO_MIME_EXT = {
    "video/mp4": ".mp4",
}
ALL_MIME_EXT = {**IMAGE_MIME_EXT, **VIDEO_MIME_EXT}


def media_type_for(content_type: str) -> str:
    if content_type in IMAGE_MIME_EXT:
        return "image"
    if content_type in VIDEO_MIME_EXT:
        return "video"
    raise ValueError(f"unsupported content-type: {content_type}")


def new_filename(content_type: str) -> str:
    ext = ALL_MIME_EXT.get(content_type)
    if ext is None:
        raise ValueError(f"unsupported content-type: {content_type}")
    return f"{uuid.uuid4().hex}{ext}"


def to_public_url(relative_path: str) -> str:
    """relative_path 예: 'avatars/xxx.jpg' -> 절대 URL."""
    return f"{settings.public_base_url}/uploads/{relative_path}"


def avatar_url(avatar_path: str | None) -> str | None:
    return to_public_url(avatar_path) if avatar_path else None
