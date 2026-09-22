import { NavLink } from "react-router-dom";
import { Avatar } from "../media/Avatar";
import { timeAgo } from "../../utils/timeAgo";
import styles from "./ConversationList.module.css";

export function ConversationList({ conversations, activeId }) {
  return (
    <ul className={styles.list}>
      {conversations.map((c) => (
        <li key={c.id}>
          <NavLink to={`/direct/${c.id}`} className={`${styles.row} ${activeId === c.id ? styles.active : ""}`}>
            <Avatar src={c.other_user.avatar_url} username={c.other_user.username} size="lg" linkToProfile={false} />
            <div className={styles.info}>
              <span className={styles.username}>{c.other_user.username}</span>
              <span className={styles.preview}>
                {c.last_message ? (c.last_message.kind === "image" ? "사진을 보냈습니다" : c.last_message.text) : "대화를 시작해보세요"}
                {c.last_message && ` · ${timeAgo(c.last_message.created_at)}`}
              </span>
            </div>
            {c.unread_count > 0 && <span className={styles.badge}>{c.unread_count}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
