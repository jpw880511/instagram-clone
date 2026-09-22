import { Avatar } from "../media/Avatar";
import { timeAgo } from "../../utils/timeAgo";
import styles from "./NotificationItem.module.css";

const COPY = {
  like: (u) => `${u}님이 회원님의 게시물을 좋아합니다.`,
  comment: (u, preview) => `${u}님: ${preview || ""}`,
  follow: (u) => `${u}님이 회원님을 팔로우하기 시작했습니다.`,
  follow_request: (u) => `${u}님이 팔로우를 요청했습니다.`,
  mention: (u) => `${u}님이 회원님을 언급했습니다.`,
  tag: (u) => `${u}님이 회원님을 사진에 태그했습니다.`,
};

export function NotificationItem({ notification, onNavigate, onAccept, onReject }) {
  const { type, actor, post, comment_preview, is_read, created_at } = notification;
  const text = COPY[type] ? COPY[type](actor.username, comment_preview) : "";

  return (
    <div className={`${styles.row} ${!is_read ? styles.unread : ""}`}>
      <button type="button" className={styles.main} onClick={() => onNavigate(notification)}>
        <Avatar src={actor.avatar_url} username={actor.username} size="md" linkToProfile={false} />
        <span className={styles.text}>
          <span>{text}</span>
          <span className={styles.time}>{timeAgo(created_at)}</span>
        </span>
      </button>

      {type === "follow_request" ? (
        <div className={styles.actions}>
          <button type="button" className={styles.accept} onClick={() => onAccept(notification)}>
            확인
          </button>
          <button type="button" className={styles.reject} onClick={() => onReject(notification)}>
            삭제
          </button>
        </div>
      ) : (
        post?.thumbnail_url && (
          <button type="button" className={styles.thumb} onClick={() => onNavigate(notification)}>
            <img src={post.thumbnail_url} alt="" />
          </button>
        )
      )}
    </div>
  );
}
