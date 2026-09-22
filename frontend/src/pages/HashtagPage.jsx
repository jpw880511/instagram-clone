import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PostGrid } from "../components/profile/PostGrid";
import * as searchApi from "../api/search";
import styles from "./HashtagPage.module.css";

export function HashtagPage() {
  const { name } = useParams();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextCursor) => {
      setLoading(true);
      try {
        const data = await searchApi.getHashtag(name, nextCursor);
        setMeta(data);
        setItems((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.next_cursor);
      } finally {
        setLoading(false);
      }
    },
    [name]
  );

  useEffect(() => {
    setItems([]);
    load(undefined);
  }, [load]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1>#{name}</h1>
        <span>게시물 {meta?.post_count ?? 0}개</span>
      </header>
      <PostGrid items={items} loading={loading} hasMore={Boolean(cursor)} onLoadMore={() => load(cursor)} emptyTitle="게시물이 없습니다" />
    </div>
  );
}
