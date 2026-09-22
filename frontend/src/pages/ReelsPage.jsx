import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/media/Avatar";
import { Icon } from "../components/common/Icon";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import { CommentList } from "../components/comments/CommentList";
import { LikesModal } from "../components/modal/LikesModal";
import { CreatePostModal } from "../components/modal/CreatePostModal";
import { useToast } from "../context/ToastContext";
import * as postsApi from "../api/posts";
import styles from "./ReelsPage.module.css";

function ReelCard({ reel, onChanged }) {
  const [muted, setMuted] = useState(true);
  const [showLikes, setShowLikes] = useState(false);
  // 댓글 시트: closed → open → closing(바깥 터치로 닫을 때 슬라이드 다운 후 closed). X 버튼은 바로 closed
  const [sheet, setSheet] = useState("closed");
  const videoRef = useRef(null);
  const navigate = useNavigate();

  function openSheet() {
    setSheet("open");
  }

  function closeSheet() {
    setSheet((s) => (s === "open" ? "closing" : s));
  }

  useEffect(() => {
    if (sheet !== "open") return undefined;
    function onKey(e) {
      if (e.key === "Escape") closeSheet();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet]);
  const { showToast } = useToast();

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) node.play().catch(() => {});
        else node.pause();
      },
      { threshold: 0.6 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  async function toggleLike() {
    const wasLiked = reel.liked;
    onChanged({ ...reel, liked: !wasLiked, like_count: reel.like_count + (wasLiked ? -1 : 1) });
    try {
      wasLiked ? await postsApi.unlikePost(reel.id) : await postsApi.likePost(reel.id);
    } catch (err) {
      onChanged(reel);
      showToast(err.message, "error");
    }
  }

  async function toggleSave() {
    const wasSaved = reel.saved;
    onChanged({ ...reel, saved: !wasSaved });
    try {
      wasSaved ? await postsApi.unsavePost(reel.id) : await postsApi.savePost(reel.id);
    } catch (err) {
      onChanged(reel);
      showToast(err.message, "error");
    }
  }

  const media = reel.media[0];

  return (
    <section className={styles.card}>
      {media.media_type === "video" ? (
        <video ref={videoRef} src={media.url} className={styles.media} loop playsInline muted={muted} />
      ) : (
        <img src={media.url} alt="" className={styles.media} />
      )}

      <div className={styles.overlayBottom}>
        <button type="button" className={styles.author} onClick={() => navigate(`/${reel.author.username}`)}>
          <Avatar src={reel.author.avatar_url} username={reel.author.username} size="sm" linkToProfile={false} />
          <span>{reel.author.username}</span>
        </button>
        {reel.caption && <p className={styles.caption}>{reel.caption}</p>}
      </div>

      <div className={styles.actionCol}>
        <button type="button" onClick={toggleLike} aria-label="좋아요">
          <Icon name="heart" filled={reel.liked} size={28} />
          <span>{reel.like_count}</span>
        </button>
        <button type="button" onClick={openSheet} aria-label="댓글">
          <Icon name="comment" size={28} />
          <span>{reel.comment_count}</span>
        </button>
        <button type="button" onClick={toggleSave} aria-label="저장">
          <Icon name="bookmark" filled={reel.saved} size={28} />
        </button>
        <button type="button" onClick={() => setShowLikes(true)} aria-label="좋아요 목록">
          <Icon name="more" size={24} />
        </button>
        {media.media_type === "video" && (
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "음소거 해제" : "음소거"}>
            <Icon name={muted ? "mute" : "unmute"} size={24} />
          </button>
        )}
      </div>

      {showLikes && <LikesModal postId={reel.id} onClose={() => setShowLikes(false)} />}

      {sheet !== "closed" && (
        <>
          {/* 시트 바깥의 빈 화면을 누르면 아래로 내려간다 */}
          <div className={styles.sheetBackdrop} onClick={closeSheet} aria-hidden="true" />
          <div
            className={`${styles.sheet} ${sheet === "closing" ? styles.sheetClosing : ""}`}
            role="dialog"
            aria-label="댓글"
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget && sheet === "closing") setSheet("closed");
            }}
          >
            <header className={styles.sheetHeader}>
              <strong>댓글</strong>
              <button type="button" className={styles.sheetToggle} onClick={() => setSheet("closed")} aria-label="댓글 닫기">
                <Icon name="close" size={18} />
              </button>
            </header>
            <CommentList postId={reel.id} postAuthorId={reel.author.id} />
          </div>
        </>
      )}
    </section>
  );
}

export function ReelsPage() {
  const [reels, setReels] = useState([]);
  const [cursor, setCursor] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (nextCursor) => {
    setLoading(true);
    try {
      const data = await postsApi.getReels(nextCursor);
      setReels((prev) => (nextCursor ? [...prev, ...data.items] : data.items));
      setCursor(data.next_cursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(undefined);
  }, [load]);

  function handleChanged(updated) {
    setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <>
      <button type="button" className={styles.createBtn} onClick={() => setCreateOpen(true)} aria-label="릴스 만들기">
        <Icon name="plus" size={22} />
        <span>만들기</span>
      </button>

      {loading && reels.length === 0 && <Spinner />}
      {!loading && reels.length === 0 && <EmptyState title="아직 릴스가 없습니다" />}
      {reels.length > 0 && (
        <div className={styles.scroller}>
          {reels.map((reel) => (
            <ReelCard key={reel.id} reel={reel} onChanged={handleChanged} />
          ))}
        </div>
      )}

      {createOpen && (
        <CreatePostModal
          mode="reel"
          onClose={() => setCreateOpen(false)}
          onCreated={(post) => setReels((prev) => [post, ...prev])}
        />
      )}
    </>
  );
}
