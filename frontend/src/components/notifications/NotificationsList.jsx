import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationItem } from "./NotificationItem";
import { Spinner } from "../common/Spinner";
import { EmptyState } from "../common/EmptyState";
import { ErrorBanner } from "../common/ErrorBanner";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useToast } from "../../context/ToastContext";
import * as notificationsApi from "../../api/notifications";
import * as followsApi from "../../api/follows";

export function NotificationsList({ onNavigateItem }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const load = useCallback(async (nextCursor) => {
    setLoading(true);
    setError("");
    try {
      const data = await notificationsApi.getNotifications(nextCursor);
      setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
      setCursor(data.next_cursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(undefined).then(() => notificationsApi.markNotificationsRead());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sentinelRef = useInfiniteScroll({
    enabled: Boolean(cursor) && !loading,
    onIntersect: () => load(cursor),
  });

  function handleNavigate(notification) {
    onNavigateItem?.();
    if (notification.type === "follow_request") return;
    if (notification.post) navigate(`/p/${notification.post.id}`);
    else navigate(`/${notification.actor.username}`);
  }

  async function handleAccept(notification) {
    try {
      await followsApi.acceptFollowRequest(notification.actor.id);
      setItems((prev) => prev.filter((n) => n.id !== notification.id));
      showToast(`${notification.actor.username}님의 요청을 수락했습니다.`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleReject(notification) {
    try {
      await followsApi.rejectFollowRequest(notification.actor.id);
      setItems((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (loading && items.length === 0) return <Spinner />;
  if (error && items.length === 0) return <ErrorBanner message={error} onRetry={() => load(undefined)} />;
  if (items.length === 0) return <EmptyState title="알림이 없습니다" description="활동이 생기면 여기에 표시됩니다." />;

  return (
    <div>
      {items.map((n) => (
        <NotificationItem key={n.id} notification={n} onNavigate={handleNavigate} onAccept={handleAccept} onReject={handleReject} />
      ))}
      <div ref={sentinelRef} />
      {loading && items.length > 0 && <Spinner />}
    </div>
  );
}
