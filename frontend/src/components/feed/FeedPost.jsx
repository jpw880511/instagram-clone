import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "../media/Avatar";
import { Carousel } from "../media/Carousel";
import { Icon } from "../common/Icon";
import { PostActions } from "./PostActions";
import { Caption } from "./Caption";
import { CommentInput } from "../comments/CommentInput";
import { LikesModal } from "../modal/LikesModal";
import { timeAgo } from "../../utils/timeAgo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import * as postsApi from "../../api/posts";
import * as commentsApi from "../../api/comments";
import * as followsApi from "../../api/follows";
import styles from "./FeedPost.module.css";

export function FeedPost({ post, onChanged }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [previewComments, setPreviewComments] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user: me } = useAuth();
  const { showToast } = useToast();
  const isOwner = me?.id === post.author.id;

  function goLogin() {
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?next=${next}`);
  }

  useEffect(() => {
    if (!me) return;
    commentsApi
      .getComments(post.id)
      .then((data) => setPreviewComments(data.items.slice(-2)))
      .catch(() => {});
  }, [post.id, me]);

  useEffect(() => {
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function update(patch) {
    onChanged?.({ ...post, ...patch });
  }

  async function toggleLike() {
    if (!me) {
      goLogin();
      return;
    }
    const wasLiked = post.liked;
    update({ liked: !wasLiked, like_count: post.like_count + (wasLiked ? -1 : 1) });
    try {
      wasLiked ? await postsApi.unlikePost(post.id) : await postsApi.likePost(post.id);
    } catch (err) {
      update({ liked: wasLiked, like_count: post.like_count });
      showToast(err.message, "error");
    }
  }

  function handleDoubleClick() {
    if (!me) {
      goLogin();
      return;
    }
    if (!post.liked) toggleLike();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 700);
  }

  async function toggleSave() {
    const wasSaved = post.saved;
    update({ saved: !wasSaved });
    try {
      wasSaved ? await postsApi.unsavePost(post.id) : await postsApi.savePost(post.id);
    } catch (err) {
      update({ saved: wasSaved });
      showToast(err.message, "error");
    }
  }

  function handleShare() {
    navigator.clipboard?.writeText(`${window.location.origin}/p/${post.id}`).catch(() => {});
    showToast("링크를 복사했습니다.");
  }

  async function handleDeletePost() {
    if (!window.confirm("게시물을 삭제할까요?")) return;
    try {
      await postsApi.deletePost(post.id);
      update({ _deleted: true });
      showToast("게시물을 삭제했습니다.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleUnfollow() {
    try {
      await followsApi.unfollow(post.author.username);
      showToast(`${post.author.username}님을 팔로우 취소했습니다.`);
    } catch (err) {
      showToast(err.message, "error");
    }
    setMenuOpen(false);
  }

  async function handleBlock() {
    if (!window.confirm(`${post.author.username}님을 차단할까요?`)) return;
    try {
      await followsApi.block(post.author.username);
      showToast(`${post.author.username}님을 차단했습니다.`);
    } catch (err) {
      showToast(err.message, "error");
    }
    setMenuOpen(false);
  }

  async function handleQuickComment(text) {
    if (!me) {
      goLogin();
      return;
    }
    const created = await commentsApi.addComment(post.id, { text });
    setPreviewComments((prev) => [...(prev || []), created].slice(-2));
    update({ comment_count: post.comment_count + 1 });
  }

  if (post._deleted) return null;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <Avatar src={post.author.avatar_url} username={post.author.username} size="sm" />
        <div className={styles.headerText}>
          <span className={styles.username} onClick={() => navigate(`/${post.author.username}`)}>
            {post.author.username}
          </span>
          {post.location && <span className={styles.location}>{post.location}</span>}
        </div>
        <div className={styles.menuWrap} ref={menuRef}>
          <button type="button" className={styles.moreBtn} onClick={() => setMenuOpen((v) => !v)} aria-label="더 보기">
            <Icon name="more" size={20} />
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              {isOwner ? (
                <>
                  <button type="button" onClick={handleDeletePost} className={styles.danger}>
                    삭제
                  </button>
                  <button type="button" onClick={() => navigate(`/p/${post.id}`)}>
                    수정
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleUnfollow}>
                    팔로우 취소
                  </button>
                  <button type="button" onClick={handleBlock} className={styles.danger}>
                    차단
                  </button>
                </>
              )}
              <button type="button" onClick={() => setMenuOpen(false)}>
                취소
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.mediaWrap}>
        <Carousel media={post.media} fit="cover" onDoubleClick={handleDoubleClick} />
        {showHeart && (
          <span className={styles.bigHeart}>
            <Icon name="heart" filled size={90} />
          </span>
        )}
      </div>

      <PostActions
        liked={post.liked}
        saved={post.saved}
        likeCount={post.like_count}
        onToggleLike={toggleLike}
        onToggleSave={toggleSave}
        onCommentClick={() => navigate(`/p/${post.id}`)}
        onShare={handleShare}
        onShowLikes={() => (me ? setShowLikes(true) : goLogin())}
      />

      <div className={styles.body}>
        {post.caption && <Caption username={post.author.username} text={post.caption} />}
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
        {post.comment_count > 0 && (
          <button type="button" className={styles.viewComments} onClick={() => navigate(`/p/${post.id}`)}>
            댓글 {post.comment_count}개 모두 보기
          </button>
        )}
        {previewComments?.map((c) => (
          <p key={c.id} className={styles.previewComment}>
            <strong>{c.author.username}</strong> {c.text}
          </p>
        ))}
        <span className={styles.time}>{timeAgo(post.created_at)}</span>
      </div>

      <CommentInput onSubmit={handleQuickComment} onFocus={!me ? goLogin : undefined} />

      {showLikes && <LikesModal postId={post.id} onClose={() => setShowLikes(false)} />}
    </article>
  );
}
