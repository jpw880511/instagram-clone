import { Link } from "react-router-dom";
import { Icon } from "../common/Icon";
import { Spinner } from "../common/Spinner";
import { EmptyState } from "../common/EmptyState";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import styles from "./PostGrid.module.css";

export function PostGrid({ items, loading, hasMore, onLoadMore, emptyTitle, emptyDescription }) {
  const sentinelRef = useInfiniteScroll({ enabled: Boolean(hasMore) && !loading, onIntersect: onLoadMore });

  if (!loading && items.length === 0) {
    return <EmptyState title={emptyTitle || "게시물이 없습니다"} description={emptyDescription} />;
  }

  return (
    <div>
      <div className={styles.grid}>
        {items.map((item) => (
          <Link key={item.id} to={`/p/${item.id}`} className={styles.cell}>
            <img src={item.thumbnail_url} alt="" loading="lazy" />
            <div className={styles.overlay}>
              <span>
                <Icon name="heart" filled size={16} /> {item.like_count}
              </span>
              <span>
                <Icon name="comment" size={16} /> {item.comment_count}
              </span>
            </div>
            {item.post_type === "reel" && (
              <span className={styles.badge}>
                <Icon name="reels" size={14} />
              </span>
            )}
            {item.media_count > 1 && item.post_type !== "reel" && (
              <span className={styles.badge}>
                <Icon name="grid" size={14} />
              </span>
            )}
          </Link>
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} />}
      {loading && <Spinner />}
    </div>
  );
}
