import { useState } from "react";
import styles from "./CommentInput.module.css";

export function CommentInput({
  onSubmit,
  placeholder = "댓글 달기...",
  autoFocus = false,
  replyLabel,
  onCancelReply,
  onFocus,
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {replyLabel && (
        <div className={styles.replyBanner}>
          <span>{replyLabel}</span>
          <button type="button" onClick={onCancelReply}>
            취소
          </button>
        </div>
      )}
      <div className={styles.inputRow}>
        <textarea
          rows={1}
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
        />
        <button type="submit" disabled={!text.trim() || submitting} className={styles.postBtn}>
          게시
        </button>
      </div>
    </form>
  );
}
