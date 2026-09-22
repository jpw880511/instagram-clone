import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Avatar } from "../components/media/Avatar";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as usersApi from "../api/users";
import * as followsApi from "../api/follows";
import styles from "./FollowListPage.module.css";

export function FollowListPage({ mode }) {
  const { username } = useParams();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const { user: me } = useAuth();
  const { showToast } = useToast();

  const fetcher = mode === "followers" ? usersApi.getFollowers : usersApi.getFollowing;

  async function load(nextCursor) {
    setLoading(true);
    try {
      const data = await fetcher(username, nextCursor);
      setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
      setCursor(data.next_cursor);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setError(null);
    load(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, mode]);

  const sentinelRef = useInfiniteScroll({ enabled: Boolean(cursor) && !loading, onIntersect: () => load(cursor) });

  const filtered = useMemo(
    () => items.filter((u) => u.username.includes(filter.toLowerCase()) || u.full_name.toLowerCase().includes(filter.toLowerCase())),
    [items, filter]
  );

  async function toggleFollow(target) {
    setItems((prev) => prev.map((u) => (u.id === target.id ? { ...u, _busy: true } : u)));
    try {
      if (target.follow_status === "following" || target.follow_status === "requested") {
        await followsApi.unfollow(target.username);
        setItems((prev) => prev.map((u) => (u.id === target.id ? { ...u, follow_status: "none", _busy: false } : u)));
      } else {
        const res = await followsApi.follow(target.username);
        setItems((prev) => prev.map((u) => (u.id === target.id ? { ...u, follow_status: res.follow_status, _busy: false } : u)));
      }
    } catch (err) {
      showToast(err.message, "error");
      setItems((prev) => prev.map((u) => (u.id === target.id ? { ...u, _busy: false } : u)));
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1>{mode === "followers" ? "팔로워" : "팔로우 중"}</h1>
      </header>
      <input
        type="text"
        className={styles.filterInput}
        placeholder="검색"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading && items.length === 0 && <Spinner />}
      {!loading && error?.status === 403 && (
        <EmptyState title="비공개 계정입니다" description="이 계정을 팔로우하면 목록을 볼 수 있어요." />
      )}
      {!loading && error && error.status !== 403 && (
        <ErrorBanner message={error.message} onRetry={() => load(undefined)} />
      )}
      {!loading && !error && filtered.length === 0 && <EmptyState title="표시할 사용자가 없습니다" />}
      {!error && (
        <ul className={styles.list}>
          {filtered.map((u) => (
            <li key={u.id} className={styles.row}>
              <Avatar src={u.avatar_url} username={u.username} size="md" />
              <div className={styles.info}>
                <strong>{u.username}</strong>
                <span>{u.full_name}</span>
              </div>
              {me && me.username !== u.username && (
                <button type="button" className={`${styles.followBtn} ${u.follow_status && u.follow_status !== "none" ? styles.following : ""}`} onClick={() => toggleFollow(u)} disabled={u._busy}>
                  {u.follow_status === "following" ? "팔로잉" : u.follow_status === "requested" ? "요청됨" : "팔로우"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!error && cursor && <div ref={sentinelRef} />}
    </div>
  );
}
