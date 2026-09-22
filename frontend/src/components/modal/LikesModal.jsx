import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Avatar } from "../media/Avatar";
import { Spinner } from "../common/Spinner";
import { EmptyState } from "../common/EmptyState";
import { useAuth } from "../../context/AuthContext";
import * as postsApi from "../../api/posts";
import * as followsApi from "../../api/follows";
import styles from "./LikesModal.module.css";

export function LikesModal({ postId, onClose }) {
  const [users, setUsers] = useState(null);
  const { user: me } = useAuth();

  useEffect(() => {
    postsApi.getLikers(postId).then(setUsers);
  }, [postId]);

  async function toggleFollow(target) {
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, follow_status: "pending" } : u)));
    try {
      if (target.follow_status === "following") {
        await followsApi.unfollow(target.username);
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, follow_status: "none", is_following: false } : u)));
      } else {
        const res = await followsApi.follow(target.username);
        setUsers((prev) =>
          prev.map((u) => (u.id === target.id ? { ...u, follow_status: res.follow_status, is_following: res.follow_status === "following" } : u))
        );
      }
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? target : u)));
    }
  }

  return (
    <Modal title="좋아요" onClose={onClose} width={400}>
      <div className={styles.list}>
        {!users && <Spinner />}
        {users && users.length === 0 && <EmptyState title="아직 좋아요가 없습니다" />}
        {users?.map((u) => (
          <div key={u.id} className={styles.row}>
            <Avatar src={u.avatar_url} username={u.username} size="md" />
            <div className={styles.info}>
              <strong>{u.username}</strong>
              <span>{u.full_name}</span>
            </div>
            {me && me.username !== u.username && (
              <button type="button" className={`${styles.followBtn} ${u.follow_status && u.follow_status !== "none" ? styles.following : ""}`} onClick={() => toggleFollow(u)}>
                {u.follow_status === "following" ? "팔로잉" : u.follow_status === "requested" ? "요청됨" : "팔로우"}
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
