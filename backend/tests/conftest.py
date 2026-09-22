import os

_HERE = os.path.dirname(__file__)
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_HERE, 'test_instagram.db')}"
os.environ["UPLOAD_DIR"] = os.path.join(_HERE, "test_uploads")
os.environ["SECRET_KEY"] = "test-secret-key"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_db():
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield


@pytest.fixture
def client():
    return TestClient(app)
