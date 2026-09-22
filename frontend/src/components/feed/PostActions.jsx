import { Icon } from "../common/Icon";
import styles from "./PostActions.module.css";

export function PostActions({ liked, saved, likeCount, onToggleLike, onToggleSave, onCommentClick, onShare, onShowLikes }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <div className={styles.left}>
          <button
            type="button"
            className={`${styles.iconBtn} ${liked ? styles.liked : ""}`}
            onClick={onToggleLike}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
            aria-pressed={liked}
          >
            <Icon name="heart" filled={liked} size={24} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={onCommentClick} aria-label="댓글">
            <Icon name="comment" size={24} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={onShare} aria-label="공유">
            <Icon name="send" size={24} />
          </button>
        </div>
        <button
          type="button"
          className={`${styles.iconBtn} ${saved ? styles.savedIcon : ""}`}
          onClick={onToggleSave}
          aria-label={saved ? "저장 취소" : "저장"}
          aria-pressed={saved}
        >
          <Icon name="bookmark" filled={saved} size={24} />
        </button>
      </div>
      {likeCount > 0 && (
        <button type="button" className={styles.likeCount} onClick={onShowLikes}>
          좋아요 {likeCount.toLocaleString()}개
        </button>
      )}
    </div>
  );
}
