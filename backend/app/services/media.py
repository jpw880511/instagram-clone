import os

from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.utils.filenames import media_type_for, new_filename


async def save_upload_file(file: UploadFile, subdir: str) -> tuple[str, str]:
    """업로드 파일을 저장하고 (relative_path, media_type)을 반환한다.

    relative_path 예: 'posts/xxxxx.jpg' — UPLOAD_DIR 기준 상대경로.
    """
    content_type = file.content_type or ""
    try:
        media_type = media_type_for(content_type)
        filename = new_filename(content_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"지원하지 않는 파일 형식입니다: {content_type}",
        )

    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"파일은 {settings.max_upload_mb}MB를 넘을 수 없습니다.",
        )

    dest_dir = os.path.join(settings.upload_dir, subdir)
    os.makedirs(dest_dir, exist_ok=True)
    relative_path = f"{subdir}/{filename}"
    with open(os.path.join(settings.upload_dir, subdir, filename), "wb") as f:
        f.write(data)

    return relative_path, media_type


def delete_upload_file(relative_path: str | None) -> None:
    if not relative_path:
        return
    path = os.path.join(settings.upload_dir, relative_path)
    try:
        os.remove(path)
    except OSError:
        pass
