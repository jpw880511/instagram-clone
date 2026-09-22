from fastapi.testclient import TestClient

from tests.test_flows import _auth_headers, _register, _tiny_png


def _tiny_mp4() -> bytes:
    # 최소 유효 MP4 컨테이너 헤더(ftyp box) — content-type만 검사하므로 실제 재생 불가해도 무방.
    return bytes.fromhex("00000018667479706d703432000000006d70343269736f6d")


# ---------- Auth 엣지 케이스 ----------


def test_register_duplicate_email_and_username(client: TestClient):
    _register(client, "dup1")
    res = client.post(
        "/api/auth/register",
        json={"email": "dup1@example.com", "username": "dup2", "full_name": "x", "password": "password123"},
    )
    assert res.status_code == 409

    res = client.post(
        "/api/auth/register",
        json={"email": "dup3@example.com", "username": "dup1", "full_name": "x", "password": "password123"},
    )
    assert res.status_code == 409


def test_register_invalid_username_and_short_password(client: TestClient):
    res = client.post(
        "/api/auth/register",
        json={"email": "a@a.com", "username": "Bad Name!", "full_name": "x", "password": "password123"},
    )
    assert res.status_code == 422

    res = client.post(
        "/api/auth/register",
        json={"email": "b@b.com", "username": "shortpw", "full_name": "x", "password": "short"},
    )
    assert res.status_code == 422


def test_login_wrong_password(client: TestClient):
    _register(client, "loginfail")
    res = client.post("/api/auth/login", json={"identifier": "loginfail", "password": "wrongpass"})
    assert res.status_code == 401


def test_unauthenticated_request_rejected(client: TestClient):
    res = client.get("/api/users/me")
    assert res.status_code == 401
    res = client.get("/api/users/me", headers={"Authorization": "Bearer garbage"})
    assert res.status_code == 401


# ---------- Posts ----------


def _create_post(client: TestClient, headers: dict, caption: str = "x", post_type: str = "post", ext="png"):
    files = (
        {"files": ("a.png", _tiny_png(), "image/png")}
        if ext == "png"
        else {"files": ("a.mp4", _tiny_mp4(), "video/mp4")}
    )
    res = client.post(
        "/api/posts", headers=headers, data={"caption": caption, "post_type": post_type}, files=files
    )
    return res


def test_get_post_not_found(client: TestClient):
    me = _register(client, "getpost404")
    headers = _auth_headers(me["access_token"])
    res = client.get("/api/posts/999999", headers=headers)
    assert res.status_code == 404


def test_delete_post_removes_it_and_forbids_others(client: TestClient):
    owner = _register(client, "delowner")
    other = _register(client, "delother")
    owner_h = _auth_headers(owner["access_token"])
    other_h = _auth_headers(other["access_token"])

    post_id = _create_post(client, owner_h).json()["id"]

    res = client.delete(f"/api/posts/{post_id}", headers=other_h)
    assert res.status_code == 403

    res = client.delete(f"/api/posts/{post_id}", headers=owner_h)
    assert res.status_code == 200
    assert res.json() == {"ok": True}

    res = client.get(f"/api/posts/{post_id}", headers=owner_h)
    assert res.status_code == 404


def test_save_and_unsave_post(client: TestClient):
    me = _register(client, "saver")
    headers = _auth_headers(me["access_token"])
    post_id = _create_post(client, headers).json()["id"]

    res = client.post(f"/api/posts/{post_id}/save", headers=headers)
    assert res.status_code == 200 and res.json() == {"saved": True}

    res = client.get("/api/users/me/saved", headers=headers)
    assert any(p["id"] == post_id for p in res.json()["items"])

    res = client.delete(f"/api/posts/{post_id}/save", headers=headers)
    assert res.status_code == 200 and res.json() == {"saved": False}

    res = client.get("/api/users/me/saved", headers=headers)
    assert all(p["id"] != post_id for p in res.json()["items"])


def test_likers_list(client: TestClient):
    owner = _register(client, "likerowner")
    liker = _register(client, "likerperson")
    owner_h = _auth_headers(owner["access_token"])
    liker_h = _auth_headers(liker["access_token"])
    post_id = _create_post(client, owner_h).json()["id"]

    client.post(f"/api/posts/{post_id}/like", headers=liker_h)
    res = client.get(f"/api/posts/{post_id}/likers", headers=owner_h)
    assert res.status_code == 200
    assert any(u["username"] == "likerperson" for u in res.json())


def test_reel_creation_requires_single_file(client: TestClient):
    me = _register(client, "reeler")
    headers = _auth_headers(me["access_token"])
    res = _create_post(client, headers, post_type="reel", ext="mp4")
    assert res.status_code == 201, res.text
    assert res.json()["media"][0]["media_type"] == "video"

    res = client.post(
        "/api/posts",
        headers=headers,
        data={"caption": "x", "post_type": "reel"},
        files=[("files", ("a.mp4", _tiny_mp4(), "video/mp4")), ("files", ("b.mp4", _tiny_mp4(), "video/mp4"))],
    )
    assert res.status_code == 422


def test_reels_endpoint_returns_created_reel(client: TestClient):
    me = _register(client, "reelviewer")
    headers = _auth_headers(me["access_token"])
    res = _create_post(client, headers, post_type="reel", ext="mp4")
    reel_id = res.json()["id"]

    res = client.get("/api/reels", headers=headers)
    assert res.status_code == 200
    assert any(p["id"] == reel_id for p in res.json()["items"])


# ---------- Comments ----------


def test_comment_like_unlike_and_delete(client: TestClient):
    owner = _register(client, "commowner")
    other = _register(client, "commother")
    owner_h = _auth_headers(owner["access_token"])
    other_h = _auth_headers(other["access_token"])
    post_id = _create_post(client, owner_h).json()["id"]

    comment_id = client.post(
        f"/api/posts/{post_id}/comments", headers=other_h, json={"text": "hi"}
    ).json()["id"]

    res = client.post(f"/api/comments/{comment_id}/like", headers=owner_h)
    assert res.status_code == 200 and res.json() == {"liked": True}
    res = client.delete(f"/api/comments/{comment_id}/like", headers=owner_h)
    assert res.status_code == 200 and res.json() == {"liked": False}

    # 게시물 주인은 남의 댓글도 삭제 가능
    res = client.delete(f"/api/comments/{comment_id}", headers=owner_h)
    assert res.status_code == 200


def test_comment_empty_text_rejected(client: TestClient):
    me = _register(client, "emptycomment")
    headers = _auth_headers(me["access_token"])
    post_id = _create_post(client, headers).json()["id"]
    res = client.post(f"/api/posts/{post_id}/comments", headers=headers, json={"text": "   "})
    assert res.status_code == 422


def test_reply_to_reply_rejected(client: TestClient):
    me = _register(client, "nestedreply")
    headers = _auth_headers(me["access_token"])
    post_id = _create_post(client, headers).json()["id"]
    top = client.post(f"/api/posts/{post_id}/comments", headers=headers, json={"text": "top"}).json()
    reply = client.post(
        f"/api/posts/{post_id}/comments", headers=headers, json={"text": "reply", "parent_id": top["id"]}
    ).json()
    res = client.post(
        f"/api/posts/{post_id}/comments", headers=headers, json={"text": "reply2", "parent_id": reply["id"]}
    )
    assert res.status_code == 422


# ---------- Follows / Users ----------


def test_unfollow_and_reject_request(client: TestClient):
    a = _register(client, "followera")
    b = _register(client, "followerb")
    a_h = _auth_headers(a["access_token"])
    b_h = _auth_headers(b["access_token"])

    client.post("/api/users/followerb/follow", headers=a_h)
    res = client.delete("/api/users/followerb/follow", headers=a_h)
    assert res.status_code == 200 and res.json()["follow_status"] == "none"

    client.patch("/api/users/me", headers=b_h, data={"is_private": "true"})
    client.post("/api/users/followerb/follow", headers=a_h)
    res = client.post(f"/api/follow-requests/{a['user']['id']}/reject", headers=b_h)
    assert res.status_code == 200

    res = client.get("/api/users/followerb", headers=a_h)
    assert res.json()["follow_status"] == "none"


def test_followers_following_and_suggested_lists(client: TestClient):
    a = _register(client, "listera")
    b = _register(client, "listerb")
    a_h = _auth_headers(a["access_token"])
    b_h = _auth_headers(b["access_token"])
    client.post("/api/users/listerb/follow", headers=a_h)

    res = client.get("/api/users/listerb/followers", headers=b_h)
    assert any(u["username"] == "listera" for u in res.json()["items"])

    res = client.get("/api/users/listera/following", headers=a_h)
    assert any(u["username"] == "listerb" for u in res.json()["items"])

    res = client.get("/api/users/suggested", headers=a_h)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_avatar_upload_and_removal(client: TestClient):
    me = _register(client, "avataruser")
    headers = _auth_headers(me["access_token"])

    res = client.patch(
        "/api/users/me", headers=headers, files={"avatar": ("me.png", _tiny_png(), "image/png")}
    )
    assert res.status_code == 200, res.text
    assert res.json()["avatar_url"] is not None

    res = client.patch("/api/users/me", headers=headers, data={"remove_avatar": "true"})
    assert res.status_code == 200
    assert res.json()["avatar_url"] is None


# ---------- Stories ----------


def test_story_view_and_viewers(client: TestClient):
    owner = _register(client, "storyowner")
    viewer = _register(client, "storyviewer")
    owner_h = _auth_headers(owner["access_token"])
    viewer_h = _auth_headers(viewer["access_token"])

    story_id = client.post(
        "/api/stories", headers=owner_h, files={"file": ("s.png", _tiny_png(), "image/png")}
    ).json()["id"]

    res = client.post(f"/api/stories/{story_id}/view", headers=viewer_h)
    assert res.status_code == 200

    res = client.get(f"/api/stories/{story_id}/viewers", headers=owner_h)
    assert any(v["username"] == "storyviewer" for v in res.json())

    # 본인이 아니면 조회자 목록을 볼 수 없다
    res = client.get(f"/api/stories/{story_id}/viewers", headers=viewer_h)
    assert res.status_code == 403


# ---------- Notifications ----------


def test_mark_notifications_read(client: TestClient):
    owner = _register(client, "notifowner")
    other = _register(client, "notifother")
    owner_h = _auth_headers(owner["access_token"])
    other_h = _auth_headers(other["access_token"])
    post_id = _create_post(client, owner_h).json()["id"]
    client.post(f"/api/posts/{post_id}/like", headers=other_h)

    res = client.get("/api/notifications/unread-count", headers=owner_h)
    assert res.json()["count"] >= 1

    res = client.post("/api/notifications/read", headers=owner_h, json={})
    assert res.status_code == 200

    res = client.get("/api/notifications/unread-count", headers=owner_h)
    assert res.json()["count"] == 0


# ---------- Messages ----------


def test_conversation_get_or_create_idempotent(client: TestClient):
    a = _register(client, "convoa")
    b = _register(client, "convob")
    a_h = _auth_headers(a["access_token"])

    res1 = client.post("/api/conversations", headers=a_h, json={"user_id": b["user"]["id"]})
    res2 = client.post("/api/conversations", headers=a_h, json={"user_id": b["user"]["id"]})
    assert res1.json()["id"] == res2.json()["id"]


def test_send_image_message(client: TestClient):
    a = _register(client, "imgsendera")
    b = _register(client, "imgsenderb")
    a_h = _auth_headers(a["access_token"])
    b_h = _auth_headers(b["access_token"])
    conv_id = client.post("/api/conversations", headers=a_h, json={"user_id": b["user"]["id"]}).json()["id"]

    res = client.post(
        f"/api/conversations/{conv_id}/messages",
        headers=a_h,
        data={"kind": "image"},
        files={"file": ("m.png", _tiny_png(), "image/png")},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["kind"] == "image"
    assert body["file_path"].startswith("http")

    res = client.get(f"/api/conversations/{conv_id}/messages", headers=b_h)
    assert any(m["kind"] == "image" for m in res.json()["items"])


# ---------- Explore pagination ----------


def test_explore_pagination_cursor_advances(client: TestClient):
    viewer = _register(client, "exploreviewer")
    viewer_h = _auth_headers(viewer["access_token"])
    for i in range(15):
        author = _register(client, f"exploreauthor{i}")
        _create_post(client, _auth_headers(author["access_token"]), caption=f"post{i}")

    res = client.get("/api/explore", headers=viewer_h, params={"limit": 5})
    page1 = res.json()
    assert len(page1["items"]) == 5
    assert page1["next_cursor"] is not None

    res = client.get("/api/explore", headers=viewer_h, params={"limit": 5, "cursor": page1["next_cursor"]})
    page2 = res.json()
    assert len(page2["items"]) == 5
    ids1 = {p["id"] for p in page1["items"]}
    ids2 = {p["id"] for p in page2["items"]}
    assert ids1.isdisjoint(ids2)


# ---------- 추가 확인: 차단 시 프로필 자체가 404인지, 해시태그 검색 ----------


def test_blocked_user_profile_returns_404_not_403(client: TestClient):
    a = _register(client, "blockviewera")
    b = _register(client, "blockviewerb")
    a_h = _auth_headers(a["access_token"])
    b_h = _auth_headers(b["access_token"])

    client.post("/api/users/blockviewerb/block", headers=a_h)

    res = client.get("/api/users/blockviewerb", headers=a_h)
    assert res.status_code == 404
    res = client.get("/api/users/blockviewera", headers=b_h)
    assert res.status_code == 404


def test_hashtag_hits_via_search(client: TestClient):
    me = _register(client, "tagsearcher")
    headers = _auth_headers(me["access_token"])
    _create_post(client, headers, caption="unique #zzztag123")

    res = client.get("/api/search", headers=headers, params={"q": "zzztag123", "type": "hashtag"})
    assert res.status_code == 200
    body = res.json()
    assert body["users"] == []
    assert any(h["name"] == "zzztag123" for h in body["hashtags"])


def test_feed_keyset_cursor_pagination(client: TestClient):
    author = _register(client, "cursorauthor")
    author_h = _auth_headers(author["access_token"])
    for i in range(25):
        _create_post(client, author_h, caption=f"post{i}")

    res = client.get("/api/feed", headers=author_h, params={"limit": 10})
    page1 = res.json()
    assert len(page1["items"]) == 10
    assert page1["next_cursor"] is not None

    res = client.get("/api/feed", headers=author_h, params={"limit": 10, "cursor": page1["next_cursor"]})
    page2 = res.json()
    assert len(page2["items"]) == 10
    ids1 = {p["id"] for p in page1["items"]}
    ids2 = {p["id"] for p in page2["items"]}
    assert ids1.isdisjoint(ids2)

    res = client.get("/api/feed", headers=author_h, params={"limit": 10, "cursor": page2["next_cursor"]})
    page3 = res.json()
    assert len(page3["items"]) == 5
    assert page3["next_cursor"] is None
