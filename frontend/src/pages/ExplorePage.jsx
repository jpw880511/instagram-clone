import { useCallback, useEffect, useState } from "react";
import { PostGrid } from "../components/profile/PostGrid";
import { ErrorBanner } from "../components/common/ErrorBanner";
import * as postsApi from "../api/posts";
import styles from "./ExplorePage.module.css";

export function ExplorePage() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextCursor) => {
    setLoading(true);
    setError("");
    try {
      const data = await postsApi.getExplore(nextCursor);
      setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
      setCursor(data.next_cursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(undefined);
  }, [load]);

  return (
    <div className={styles.wrap}>
      {error && items.length === 0 ? (
        <ErrorBanner message={error} onRetry={() => load(undefined)} />
      ) : (
        <PostGrid
          items={items}
          loading={loading}
          hasMore={Boolean(cursor)}
          onLoadMore={() => load(cursor)}
          emptyTitle="탐색할 게시물이 없습니다"
        />
      )}
    </div>
  );
}
