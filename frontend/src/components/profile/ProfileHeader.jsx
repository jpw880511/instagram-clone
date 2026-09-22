import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../media/Avatar";
import { useToast } from "../../context/ToastContext";
import * as followsApi from "../../api/follows";
import * as messagesApi from "../../api/messages";
import styles from "./ProfileHeader.module.css";

const FOLLOW_LABEL = { none: "팔로우", following: "팔로잉", requested: "요청됨" };

export function ProfileHeader({ user, isOwner, onFollowChange }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  async function handleFollowClick() {
    setBusy(true);
    try {
      if (user.follow_status === "following" || user.follow_status === "requested") {
        await followsApi.unfollow(user.username);
        onFollowChange({ follow_status: "none", is_following: false, follower_count: user.follower_count - (user.follow_status === "following" ? 1 : 0) });
      } else {
        const res = await followsApi.follow(user.username);
        onFollowChange({
          follow_status: res.follow_status,
          is_following: res.follow_status === "following",
          follower_count: user.follower_count + (res.follow_status === "following" ? 1 : 0),
        });
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleMessage() {
    try {
      const conv = await messagesApi.createConversation(user.id);
      navigate(`/direct/${conv.id}`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.avatarCol}>
        <Avatar src={user.avatar_url} username={user.username} size="xl" linkToProfile={false} />
      </div>
      <div className={styles.infoCol}>
        <div className={styles.topRow}>
          <h1 className={styles.username}>{user.username}</h1>
          {isOwner ? (
            <Link to="/accounts/edit" className={styles.editBtn}>
              프로필 편집
            </Link>
          ) : (
            <div className={styles.actions}>
              <button
                type="button"
                className={user.follow_status === "following" ? styles.followingBtn : styles.followBtn}
                onClick={handleFollowClick}
                disabled={busy}
              >
                {FOLLOW_LABEL[user.follow_status] || "팔로우"}
              </button>
              <button type="button" className={styles.messageBtn} onClick={handleMessage}>
                메시지 보내기
              </button>
            </div>
          )}
        </div>

        <ul className={styles.stats}>
          <li>
            <strong>{user.post_count}</strong> <span>게시물</span>
          </li>
          <li>
            <Link to={`/${user.username}/followers`}>
              <strong>{user.follower_count}</strong> <span>팔로워</span>
            </Link>
          </li>
          <li>
            <Link to={`/${user.username}/following`}>
              <strong>{user.following_count}</strong> <span>팔로잉</span>
            </Link>
          </li>
        </ul>

        <div className={styles.bio}>
          {user.full_name && <strong>{user.full_name}</strong>}
          {user.bio && <p>{user.bio}</p>}
          {user.website && /^https:\/\//.test(user.website) && (
            <a href={user.website} target="_blank" rel="noreferrer noopener" className={styles.website}>
              {user.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
