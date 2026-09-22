import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { PostGrid } from "../components/profile/PostGrid";
import { Icon } from "../components/common/Icon";
import { AccountMenu } from "../components/common/AccountMenu";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as usersApi from "../api/users";
import styles from "./ProfilePage.module.css";

const TABS = [
  { key: "posts", label: "게시물", icon: "grid" },
  { key: "saved", label: "저장됨", icon: "bookmark", ownerOnly: true },
  { key: "tagged", label: "태그됨", icon: "tag" },
];

export function ProfilePage() {
  const { username } = useParams();
  const { user: me, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("posts");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loadingGrid, setLoadingGrid] = useState(true);

  const isOwner = me?.username === username;

  useEffect(() => {
    setProfile(null);
    setError(null);
    setTab("posts");
    usersApi
      .getUserByUsername(username)
      .then(setProfile)
      .catch((err) => setError(err));
  }, [username]);

  const loadGrid = useCallback(
    async (nextCursor) => {
      setLoadingGrid(true);
      try {
        const fetcher = tab === "posts" ? usersApi.getUserPosts : tab === "saved" ? usersApi.getMySaved : usersApi.getUserTagged;
        const data = tab === "saved" ? await fetcher(nextCursor) : await fetcher(username, nextCursor);
        setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.next_cursor);
      } catch {
        setItems([]);
        setCursor(null);
      } finally {
        setLoadingGrid(false);
      }
    },
    [tab, username]
  );

  useEffect(() => {
    if (!profile) return;
    if (profile.is_private && profile.follow_status !== "self" && profile.follow_status !== "following") return;
    setItems([]);
    loadGrid(undefined);
  }, [profile, loadGrid]);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (error) {
    return <EmptyState title="사용자를 찾을 수 없습니다" description={error.message} />;
  }
  if (!profile) return <Spinner />;

  const isLocked = profile.is_private && profile.follow_status !== "self" && profile.follow_status !== "following";

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <ProfileHeader user={profile} isOwner={isOwner} onFollowChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} />
        {isOwner && (
          <div className={styles.headerActions}>
            <AccountMenu
              items={[
                { icon: "gear", label: "설정", to: "/accounts/edit" },
                { icon: "logout", label: "로그아웃", onClick: handleLogout, danger: true },
              ]}
            />
          </div>
        )}
      </div>

      <nav className={styles.tabs}>
        {TABS.filter((t) => !t.ownerOnly || isOwner).map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {isLocked ? (
        <EmptyState title="비공개 계정입니다" description="게시물을 보려면 이 계정을 팔로우하세요." />
      ) : (
        <PostGrid
          items={items}
          loading={loadingGrid}
          hasMore={Boolean(cursor)}
          onLoadMore={() => loadGrid(cursor)}
          emptyTitle={tab === "saved" ? "저장한 게시물이 없습니다" : tab === "tagged" ? "태그된 게시물이 없습니다" : "게시물이 없습니다"}
        />
      )}
    </div>
  );
}
