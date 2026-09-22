import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "../media/Avatar";
import { Icon } from "../common/Icon";
import { timeAgo } from "../../utils/timeAgo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import * as storiesApi from "../../api/stories";
import * as messagesApi from "../../api/messages";
import styles from "./StoryViewer.module.css";

const DURATION_MS = 5000;

export function StoryViewer({ groups, startIndex, onClose, onViewed }) {
  const [userIndex, setUserIndex] = useState(startIndex);
  const [stories, setStories] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState(null);
  const [replyText, setReplyText] = useState("");
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);
  const { user: me } = useAuth();
  const { showToast } = useToast();

  const group = groups[userIndex];
  const isOwn = group?.user.id === me.id;
  const current = stories?.[storyIndex];

  const loadStories = useCallback(async (index) => {
    setStories(null);
    setStoryIndex(0);
    setViewers(null);
    const g = groups[index];
    if (!g) return;
    const list = await storiesApi.getUserStories(g.user.username);
    setStories(list);
  }, [groups]);

  useEffect(() => {
    loadStories(userIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIndex]);

  useEffect(() => {
    if (!current) return;
    storiesApi.viewStory(current.id).then(() => onViewed?.());
  }, [current, onViewed]);

  const goNextStory = useCallback(() => {
    if (!stories) return;
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (userIndex < groups.length - 1) {
      setUserIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [stories, storyIndex, userIndex, groups.length, onClose]);

  const goPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (userIndex > 0) {
      setUserIndex((i) => i - 1);
    }
  }, [storyIndex, userIndex]);

  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [storyIndex, userIndex]);

  useEffect(() => {
    if (paused || !current) return undefined;
    startedAtRef.current = performance.now() - elapsedRef.current;

    function tick(now) {
      const elapsed = now - startedAtRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        goNextStory();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, current, goNextStory]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNextStory();
      if (e.key === "ArrowLeft") goPrevStory();
      if (e.key === " ") setPaused((p) => !p);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, goNextStory, goPrevStory]);

  async function loadViewers() {
    const list = await storiesApi.getStoryViewers(current.id);
    setViewers(list);
  }

  async function handleReply(e) {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;
    try {
      const conv = await messagesApi.createConversation(group.user.id);
      await messagesApi.sendMessage(conv.id, { text, kind: "story_reply", story_id: current.id });
      setReplyText("");
      showToast("답장을 보냈습니다.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (!group) return null;

  return createPortal(
    <div className={styles.overlay}>
      <button type="button" className={styles.sideNav} style={{ left: 0 }} onClick={goPrevStory} aria-label="이전" />
      <button type="button" className={styles.sideNav} style={{ right: 0 }} onClick={goNextStory} aria-label="다음" />

      <div
        className={styles.stage}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div className={styles.progressRow}>
          {stories?.map((s, i) => (
            <div key={s.id} className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className={styles.header}>
          <Avatar src={group.user.avatar_url} username={group.user.username} size="sm" linkToProfile={false} />
          <span className={styles.username}>{group.user.username}</span>
          {current && <span className={styles.time}>{timeAgo(current.created_at)}</span>}
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            <Icon name="close" size={26} />
          </button>
        </div>

        {current && (
          current.media_type === "video" ? (
            <video src={current.url} className={styles.media} autoPlay muted playsInline />
          ) : (
            <img src={current.url} alt="" className={styles.media} />
          )
        )}

        {isOwn ? (
          <button type="button" className={styles.viewersBtn} onClick={loadViewers}>
            <Icon name="eye" size={16} /> 조회자 보기
          </button>
        ) : (
          <form className={styles.replyForm} onSubmit={handleReply}>
            <input
              type="text"
              placeholder={`${group.user.username}님에게 메시지 보내기`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <button type="submit" disabled={!replyText.trim()} aria-label="답장 보내기">
              <Icon name="send" size={20} />
            </button>
          </form>
        )}

        {viewers && (
          <div className={styles.viewersPanel}>
            <div className={styles.viewersHeader}>
              <strong>조회자 {viewers.length}명</strong>
              <button type="button" onClick={() => setViewers(null)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className={styles.viewersList}>
              {viewers.map((v) => (
                <div key={v.id} className={styles.viewerRow}>
                  <Avatar src={v.avatar_url} username={v.username} size="sm" linkToProfile={false} />
                  <span>{v.username}</span>
                </div>
              ))}
              {viewers.length === 0 && <p className={styles.muted}>아직 조회한 사람이 없습니다.</p>}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
