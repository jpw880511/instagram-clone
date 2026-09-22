import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../media/Avatar";
import { Icon } from "../common/Icon";
import { Spinner } from "../common/Spinner";
import { EmptyState } from "../common/EmptyState";
import { CommentInput } from "./CommentInput";
import { timeAgo } from "../../utils/timeAgo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import * as commentsApi from "../../api/comments";
import styles from "./CommentList.module.css";

function CommentRow({ comment, onLikeToggle, onDelete, onReply, canDelete }) {
  return (
    <div className={styles.row}>
      <Avatar src={comment.author.avatar_url} username={comment.author.username} size="sm" />
      <div className={styles.body}>
        <p className={styles.text}>
          <Link to={`/${comment.author.username}`} className={styles.username}>
            {comment.author.username}
          </Link>{" "}
          {comment.text}
        </p>
        <div className={styles.meta}>
          <span>{timeAgo(comment.created_at)}</span>
          {comment.like_count > 0 && <span>좋아요 {comment.like_count}개</span>}
          <button type="button" onClick={() => onReply(comment)}>
            답글 달기
          </button>
          {canDelete && (
            <button type="button" onClick={() => onDelete(comment)}>
              삭제
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className={`${styles.likeBtn} ${comment.liked ? styles.liked : ""}`}
        onClick={() => onLikeToggle(comment)}
        aria-label={comment.liked ? "댓글 좋아요 취소" : "댓글 좋아요"}
      >
        <Icon name="heart" filled={comment.liked} size={12} />
      </button>
    </div>
  );
}

export function CommentList({ postId, postAuthorId, onReplyTarget }) {
  const [comments, setComments] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [repliesOpen, setRepliesOpen] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const { user: me } = useAuth();
  const { showToast } = useToast();

  const load = useCallback(
    async (nextCursor) => {
      setLoading(true);
      try {
        const data = await commentsApi.getComments(postId, nextCursor);
        setComments((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.next_cursor);
      } finally {
        setLoading(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    load(undefined);
  }, [load]);

  async function toggleReplies(comment) {
    setRepliesOpen((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }));
    if (!repliesOpen[comment.id] && !comment._replies) {
      const replies = await commentsApi.getReplies(comment.id);
      setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, _replies: replies } : c)));
    }
  }

  async function handleLikeToggle(comment, parentId) {
    const apply = (list) =>
      list.map((c) => {
        if (c.id !== comment.id) return c;
        return { ...c, liked: !c.liked, like_count: c.like_count + (c.liked ? -1 : 1) };
      });
    setComments((prev) => (parentId ? prev.map((c) => (c.id === parentId ? { ...c, _replies: apply(c._replies || []) } : c)) : apply(prev)));
    try {
      if (comment.liked) await commentsApi.unlikeComment(comment.id);
      else await commentsApi.likeComment(comment.id);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDelete(comment, parentId) {
    try {
      await commentsApi.deleteComment(comment.id);
      if (parentId) {
        setComments((prev) => prev.map((c) => (c.id === parentId ? { ...c, _replies: (c._replies || []).filter((r) => r.id !== comment.id) } : c)));
      } else {
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleAddComment(text) {
    const parentId = replyTo?.id || null;
    const created = await commentsApi.addComment(postId, { text, parent_id: parentId });
    if (parentId) {
      setComments((prev) =>
        prev.map((c) => (c.id === parentId ? { ...c, _replies: [...(c._replies || []), created], reply_count: c.reply_count + 1 } : c))
      );
      setRepliesOpen((prev) => ({ ...prev, [parentId]: true }));
    } else {
      setComments((prev) => [...prev, created]);
    }
    setReplyTo(null);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        {loading && comments.length === 0 && <Spinner />}
        {!loading && comments.length === 0 && <EmptyState title="첫 댓글을 남겨보세요" />}
        {comments.map((comment) => (
          <div key={comment.id}>
            <CommentRow
              comment={comment}
              canDelete={me && (me.id === comment.author.id || me.id === postAuthorId)}
              onLikeToggle={(c) => handleLikeToggle(c)}
              onDelete={(c) => handleDelete(c)}
              onReply={(c) => {
                setReplyTo(c);
                onReplyTarget?.(c);
              }}
            />
            {comment.reply_count > 0 && (
              <button type="button" className={styles.viewReplies} onClick={() => toggleReplies(comment)}>
                <span className={styles.replyLine} />
                {repliesOpen[comment.id] ? "답글 숨기기" : `답글 ${comment.reply_count}개 보기`}
              </button>
            )}
            {repliesOpen[comment.id] && (
              <div className={styles.replies}>
                {(comment._replies || []).map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    canDelete={me && (me.id === reply.author.id || me.id === postAuthorId)}
                    onLikeToggle={(c) => handleLikeToggle(c, comment.id)}
                    onDelete={(c) => handleDelete(c, comment.id)}
                    onReply={() => {
                      setReplyTo(comment);
                      onReplyTarget?.(comment);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {cursor && (
          <button type="button" className={styles.loadMore} onClick={() => load(cursor)} disabled={loading}>
            댓글 더 보기
          </button>
        )}
      </div>
      <CommentInput
        onSubmit={handleAddComment}
        replyLabel={replyTo ? `@${replyTo.author.username}님에게 답글 남기는 중` : null}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
