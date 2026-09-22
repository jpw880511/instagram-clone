import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../components/media/Avatar";
import { Carousel } from "../components/media/Carousel";
import { Caption } from "../components/feed/Caption";
import { PostActions } from "../components/feed/PostActions";
import { CommentList } from "../components/comments/CommentList";
import { LikesModal } from "../components/modal/LikesModal";
import { Icon } from "../components/common/Icon";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { timeAgo } from "../utils/timeAgo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as postsApi from "../api/posts";
import styles from "./PostDetailPage.module.css";

export function PostDetailPage() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [showLikes, setShowLikes] = useState(false);
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    setPost(null);
    setError(null);
    postsApi
      .getPost(postId)
      .then(setPost)
      .catch((err) => setError(err));
  }, [postId]);

  if (error) {
    return (
      <EmptyState
        title={error.status === 403 ? "비공개 계정입니다" : "게시물을 찾을 수 없습니다"}
        description={error.message}
      />
    );
  }
  if (!post) return <Spinner />;

  async function toggleLike() {
    const wasLiked = post.liked;
    setPost((p) => ({ ...p, liked: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) }));
    try {
      wasLiked ? await postsApi.unlikePost(post.id) : await postsApi.likePost(post.id);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function toggleSave() {
    const wasSaved = post.saved;
    setPost((p) => ({ ...p, saved: !wasSaved }));
    try {
      wasSaved ? await postsApi.unsavePost(post.id) : await postsApi.savePost(post.id);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDelete() {
    if (!window.confirm("게시물을 삭제할까요?")) return;
    await postsApi.deletePost(post.id);
    showToast("게시물을 삭제했습니다.");
    navigate(`/${post.author.username}`);
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
        <Icon name="chevronLeft" size={22} /> 뒤로
      </button>
      <div className={styles.card}>
        <div className={styles.mediaCol}>
          <Carousel media={post.media} fit="contain" fill />
        </div>
        <div className={styles.sideCol}>
          <header className={styles.header}>
            <Avatar src={post.author.avatar_url} username={post.author.username} size="sm" />
            <span className={styles.username}>{post.author.username}</span>
            {me?.id === post.author.id && (
              <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
                삭제
              </button>
            )}
          </header>

          {post.caption && (
            <div className={styles.captionRow}>
              <Avatar src={post.author.avatar_url} username={post.author.username} size="sm" />
              <Caption username={post.author.username} text={post.caption} />
            </div>
          )}

          {post.tagged_users?.length > 0 && (
            <p className={styles.taggedUsers}>
              함께 태그됨:{" "}
              {post.tagged_users.map((u, i) => (
                <span key={u.id}>
                  <button type="button" onClick={() => navigate(`/${u.username}`)}>
                    {u.username}
                  </button>
                  {i < post.tagged_users.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}

          <CommentList postId={post.id} postAuthorId={post.author.id} />

          <div className={styles.footer}>
            <PostActions
              liked={post.liked}
              saved={post.saved}
              likeCount={post.like_count}
              onToggleLike={toggleLike}
              onToggleSave={toggleSave}
              onCommentClick={() => {}}
              onShare={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {});
                showToast("링크를 복사했습니다.");
              }}
              onShowLikes={() => setShowLikes(true)}
            />
            <span className={styles.time}>{timeAgo(post.created_at)}</span>
          </div>
        </div>
      </div>

      {showLikes && <LikesModal postId={post.id} onClose={() => setShowLikes(false)} />}
    </div>
  );
}
