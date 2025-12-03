import pytest
from fastapi.testclient import TestClient

from api import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert data.get("status") == "ok"


def test_datasets_endpoint(client):
    resp = client.get("/v1/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert "library" in data
    assert "available" in data
    assert isinstance(data["available"], dict)
