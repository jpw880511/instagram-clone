import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StoryBar } from "../components/stories/StoryBar";
import { FeedPost } from "../components/feed/FeedPost";
import { Avatar } from "../components/media/Avatar";
import { AccountMenu } from "../components/common/AccountMenu";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as postsApi from "../api/posts";
import * as usersApi from "../api/users";
import * as followsApi from "../api/follows";
import styles from "./HomePage.module.css";

export function HomePage() {
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [suggested, setSuggested] = useState([]);
  const { user, booting, logout } = useAuth();
  const { showToast } = useToast();

  const load = useCallback(
    async (nextCursor) => {
      setLoading(true);
      setError("");
      try {
        const data = user ? await postsApi.getFeed(nextCursor) : await postsApi.getPublicFeed(nextCursor);
        setPosts((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.next_cursor);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (booting) return;
    load(undefined);
    if (user) usersApi.getSuggested().then(setSuggested).catch(() => {});
  }, [booting, load, user]);

  const sentinelRef = useInfiniteScroll({ enabled: Boolean(cursor) && !loading, onIntersect: () => load(cursor) });

  function handleChanged(updated) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleFollow(target) {
    setSuggested((prev) => prev.filter((u) => u.id !== target.id));
    try {
      await followsApi.follow(target.username);
      showToast(`${target.username}님을 팔로우했습니다.`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.feedCol}>
        <StoryBar />
        {error && posts.length === 0 && <ErrorBanner message={error} onRetry={() => load(undefined)} />}
        {!loading && posts.length === 0 && !error && (
          <EmptyState
            title="아직 게시물이 없습니다"
            description={user ? "사람을 팔로우하면 이곳에 피드가 표시됩니다." : "로그인하면 더 많은 게시물을 볼 수 있습니다."}
            action={
              user ? (
                <Link to="/explore" className={styles.exploreLink}>
                  Explore 둘러보기
                </Link>
              ) : (
                <Link to="/login" className={styles.exploreLink}>
                  로그인
                </Link>
              )
            }
          />
        )}
        {posts.map((post) => (
          <FeedPost key={post.id} post={post} onChanged={handleChanged} />
        ))}
        {cursor && <div ref={sentinelRef} />}
        {loading && <Spinner />}
      </div>

      <aside className={styles.sideCol}>
        {user ? (
          <>
            <div className={styles.meRow}>
              <Avatar src={user.avatar_url} username={user.username} size="lg" />
              <div className={styles.meInfo}>
                <Link to={`/${user.username}`} className={styles.meUsername}>
                  {user.username}
                </Link>
                <span className={styles.meFullname}>{user.full_name}</span>
              </div>
              <AccountMenu
                items={[
                  { icon: "user", label: "프로필", to: `/${user.username}` },
                  { icon: "gear", label: "설정", to: "/accounts/edit" },
                  { icon: "logout", label: "로그아웃", onClick: handleLogout, danger: true },
                ]}
              />
            </div>

            {suggested.length > 0 && (
              <div className={styles.suggested}>
                <div className={styles.suggestedHeader}>회원님을 위한 추천</div>
                {suggested.map((u) => (
                  <div key={u.id} className={styles.suggestedRow}>
                    <Avatar src={u.avatar_url} username={u.username} size="md" />
                    <div className={styles.meInfo}>
                      <Link to={`/${u.username}`} className={styles.meUsername}>
                        {u.username}
                      </Link>
                      <span className={styles.meFullname}>{u.full_name}</span>
                    </div>
                    <button type="button" className={styles.followBtn} onClick={() => handleFollow(u)}>
                      팔로우
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={styles.guestCard}>
            <p className={styles.guestMessage}>로그인하고 친구를 팔로우하거나 사진과 동영상에 좋아요와 댓글을 남겨보세요.</p>
            <Link to="/login" className={styles.guestLoginBtn}>
              로그인
            </Link>
            <p className={styles.guestSignup}>
              계정이 없으신가요? <Link to="/register">가입하기</Link>
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
