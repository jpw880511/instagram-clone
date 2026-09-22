from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class OkResponse(BaseModel):
    ok: bool = True


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
