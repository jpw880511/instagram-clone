import io

from fastapi.testclient import TestClient


def _register(client: TestClient, username: str, password: str = "password123") -> dict:
    res = client.post(
        "/api/auth/register",
        json={
            "email": f"{username}@example.com",
            "username": username,
            "full_name": username.title(),
            "password": password,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _tiny_png() -> bytes:
    # 1x1 투명 PNG
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080600000"
        "01f15c4890000000a49444154789c6360000002000100ffff03000006"
        "0005570dbe0000000049454e44ae426082"
    )


def test_register_login_me(client: TestClient):
    data = _register(client, "alice")
    assert data["user"]["username"] == "alice"

    res = client.post("/api/auth/login", json={"identifier": "alice", "password": "password123"})
    assert res.status_code == 200
    token = res.json()["access_token"]

    res = client.get("/api/users/me", headers=_auth_headers(token))
    assert res.status_code == 200
    assert res.json()["username"] == "alice"


def test_refresh_and_logout(client: TestClient):
    data = _register(client, "bob")
    refresh_token = data["refresh_token"]

    res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert res.status_code == 200
    new_tokens = res.json()
    assert new_tokens["access_token"]

    # 로테이션: 이전 refresh_token은 재사용 불가
    res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert res.status_code == 401

    res = client.post("/api/auth/logout", json={"refresh_token": new_tokens["refresh_token"]})
    assert res.status_code == 200
    res = client.post("/api/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]})
    assert res.status_code == 401


def test_create_post_appears_in_own_feed(client: TestClient):
    me = _register(client, "carol")
    headers = _auth_headers(me["access_token"])

    res = client.post(
        "/api/posts",
        headers=headers,
        data={"caption": "hello #first @carol", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    assert res.status_code == 201, res.text
    post = res.json()
    assert post["caption"] == "hello #first @carol"
    assert post["media"][0]["url"].startswith("http")
    assert post["location"] == ""

    res = client.get("/api/feed", headers=headers)
    assert res.status_code == 200
    assert any(p["id"] == post["id"] for p in res.json()["items"])


def test_follow_then_feed_shows_followee_post(client: TestClient):
    dave = _register(client, "dave")
    erin = _register(client, "erin")
    dave_h = _auth_headers(dave["access_token"])
    erin_h = _auth_headers(erin["access_token"])

    res = client.post(
        "/api/posts",
        headers=erin_h,
        data={"caption": "erin post", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    post_id = res.json()["id"]

    # 팔로우 전: dave 피드에 안 보임
    res = client.get("/api/feed", headers=dave_h)
    assert all(p["id"] != post_id for p in res.json()["items"])

    res = client.post("/api/users/erin/follow", headers=dave_h)
    assert res.status_code == 200
    assert res.json()["follow_status"] == "following"

    res = client.get("/api/feed", headers=dave_h)
    assert any(p["id"] == post_id for p in res.json()["items"])


def test_private_account_requires_accept(client: TestClient):
    frank = _register(client, "frank")
    grace = _register(client, "grace")
    frank_h = _auth_headers(frank["access_token"])
    grace_h = _auth_headers(grace["access_token"])

    res = client.patch("/api/users/me", headers=grace_h, data={"is_private": "true"})
    assert res.status_code == 200
    assert res.json()["is_private"] is True

    res = client.post(
        "/api/posts",
        headers=grace_h,
        data={"caption": "secret", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    post_id = res.json()["id"]

    res = client.get(f"/api/posts/{post_id}", headers=frank_h)
    assert res.status_code == 403

    res = client.post("/api/users/grace/follow", headers=frank_h)
    assert res.json()["follow_status"] == "requested"

    res = client.get(f"/api/posts/{post_id}", headers=frank_h)
    assert res.status_code == 403

    res = client.get("/api/notifications", headers=grace_h)
    request_notif = next(n for n in res.json()["items"] if n["type"] == "follow_request")

    res = client.post(f"/api/follow-requests/{frank['user']['id']}/accept", headers=grace_h)
    assert res.status_code == 200

    res = client.get(f"/api/posts/{post_id}", headers=frank_h)
    assert res.status_code == 200


def test_like_idempotent(client: TestClient):
    me = _register(client, "henry")
    headers = _auth_headers(me["access_token"])
    res = client.post(
        "/api/posts",
        headers=headers,
        data={"caption": "x", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    post_id = res.json()["id"]

    for _ in range(2):
        res = client.post(f"/api/posts/{post_id}/like", headers=headers)
        assert res.status_code == 200
        assert res.json() == {"liked": True, "like_count": 1}


def test_comment_and_reply(client: TestClient):
    me = _register(client, "ivan")
    other = _register(client, "judy")
    headers = _auth_headers(me["access_token"])
    other_h = _auth_headers(other["access_token"])

    res = client.post(
        "/api/posts",
        headers=headers,
        data={"caption": "x", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    post_id = res.json()["id"]

    res = client.post(f"/api/posts/{post_id}/comments", headers=other_h, json={"text": "nice!"})
    assert res.status_code == 201
    comment_id = res.json()["id"]

    res = client.post(
        f"/api/posts/{post_id}/comments", headers=headers, json={"text": "thanks", "parent_id": comment_id}
    )
    assert res.status_code == 201

    res = client.get(f"/api/posts/{post_id}/comments", headers=headers)
    top = res.json()["items"]
    assert len(top) == 1
    assert top[0]["reply_count"] == 1

    res = client.get(f"/api/comments/{comment_id}/replies", headers=headers)
    assert len(res.json()) == 1


def test_story_tray_and_expiry(client: TestClient):
    me = _register(client, "kevin")
    headers = _auth_headers(me["access_token"])

    res = client.post(
        "/api/stories", headers=headers, files={"file": ("s.png", _tiny_png(), "image/png")}
    )
    assert res.status_code == 201
    story = res.json()
    assert story["expires_at"] > story["created_at"]

    res = client.get("/api/stories/tray", headers=headers)
    assert res.status_code == 200
    tray = res.json()
    assert tray[0]["user"]["username"] == "kevin"
    assert tray[0]["story_count"] == 1


def test_block_then_search_feed_dm_fail(client: TestClient):
    leo = _register(client, "leo")
    mia = _register(client, "mia")
    leo_h = _auth_headers(leo["access_token"])
    mia_h = _auth_headers(mia["access_token"])

    res = client.post(
        "/api/posts",
        headers=mia_h,
        data={"caption": "x", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    post_id = res.json()["id"]
    client.post("/api/users/mia/follow", headers=leo_h)

    conv = client.post("/api/conversations", headers=leo_h, json={"user_id": mia["user"]["id"]})
    conv_id = conv.json()["id"]

    res = client.post("/api/users/mia/block", headers=leo_h)
    assert res.status_code == 200

    res = client.get("/api/search", headers=leo_h, params={"q": "mia", "type": "user"})
    assert all(u["username"] != "mia" for u in res.json()["users"])

    res = client.get("/api/feed", headers=leo_h)
    assert all(p["id"] != post_id for p in res.json()["items"])

    res = client.post(f"/api/conversations/{conv_id}/messages", headers=leo_h, json={"text": "hi"})
    assert res.status_code == 403


def test_public_feed_excludes_private(client: TestClient):
    nora = _register(client, "nora")
    olive = _register(client, "olive")
    nora_h = _auth_headers(nora["access_token"])
    olive_h = _auth_headers(olive["access_token"])

    client.patch("/api/users/me", headers=olive_h, data={"is_private": "true"})

    res = client.post(
        "/api/posts",
        headers=nora_h,
        data={"caption": "public", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    nora_post_id = res.json()["id"]

    res = client.post(
        "/api/posts",
        headers=olive_h,
        data={"caption": "private", "post_type": "post"},
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    olive_post_id = res.json()["id"]

    res = client.get("/api/feed/public")
    assert res.status_code == 200
    ids = [p["id"] for p in res.json()["items"]]
    assert nora_post_id in ids
    assert olive_post_id not in ids


def test_tag_notification_on_post_create(client: TestClient):
    peter = _register(client, "peter")
    quinn = _register(client, "quinn")
    peter_h = _auth_headers(peter["access_token"])
    quinn_h = _auth_headers(quinn["access_token"])

    res = client.post(
        "/api/posts",
        headers=peter_h,
        data={
            "caption": "with quinn",
            "post_type": "post",
            "tagged_usernames": '["quinn"]',
        },
        files={"files": ("a.png", _tiny_png(), "image/png")},
    )
    assert res.status_code == 201
    assert res.json()["tagged_users"][0]["username"] == "quinn"

    res = client.get("/api/notifications", headers=quinn_h)
    assert any(n["type"] == "tag" for n in res.json()["items"])
