import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "./Modal";
import { Icon } from "../common/Icon";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useMediaPreview } from "../../hooks/useMediaPreview";
import { useToast } from "../../context/ToastContext";
import * as postsApi from "../../api/posts";
import * as usersApi from "../../api/users";
import styles from "./CreatePostModal.module.css";

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4";
const REEL_ACCEPT = "video/mp4";

export function CreatePostModal({ onClose, onCreated, mode = "post" }) {
  const isReelMode = mode === "reel";
  const [files, setFiles] = useState([]);
  const [step, setStep] = useState("select");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [taggedUsers, setTaggedUsers] = useState([]);
  const [tagQuery, setTagQuery] = useState("");
  const [tagChecking, setTagChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [editDragActive, setEditDragActive] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const inputRef = useRef(null);
  const addInputRef = useRef(null);
  const pendingTagRef = useRef(null);
  const pointerDragRef = useRef(null);
  const thumbNodesRef = useRef([]);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const previews = useMediaPreview(files);
  const isReel = files.some((f) => f.type.startsWith("video"));

  function isVideoBatch(list) {
    return list.some((f) => f.type.startsWith("video"));
  }

  function isSameFile(a, b) {
    return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
  }

  function dedupeAgainst(existing, incoming) {
    const result = [];
    for (const f of incoming) {
      if (existing.some((e) => isSameFile(e, f)) || result.some((r) => isSameFile(r, f))) continue;
      result.push(f);
    }
    return result;
  }

  function pickFiles(fileList) {
    let picked = dedupeAgainst([], Array.from(fileList || []));
    if (isReelMode) {
      const before = picked.length;
      picked = picked.filter((f) => f.type.startsWith("video"));
      if (picked.length === 0) {
        if (before > 0) showToast("릴스는 동영상 파일만 업로드할 수 있습니다.", "error");
        return;
      }
      setFiles(picked.slice(0, 1));
      setStep("edit");
      return;
    }
    if (picked.length === 0) return;
    const limited = isVideoBatch(picked) ? picked.slice(0, 1) : picked.slice(0, 10);
    setFiles(limited);
    setStep("edit");
  }

  function addFiles(fileList) {
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;
    if (isReel || isVideoBatch(picked)) {
      showToast("동영상은 다른 사진과 함께 추가할 수 없습니다.", "error");
      return;
    }
    setFiles((prev) => {
      const deduped = dedupeAgainst(prev, picked);
      if (deduped.length < picked.length) showToast("이미 추가된 사진은 다시 추가되지 않았습니다.");
      return [...prev, ...deduped].slice(0, 10);
    });
  }

  function handlePick(e) {
    pickFiles(e.target.files);
    e.target.value = "";
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    pickFiles(e.dataTransfer.files);
  }

  function handleAddMore(e) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function handleEditDragOver(e) {
    e.preventDefault();
    setEditDragActive(true);
  }

  function handleEditDragLeave(e) {
    e.preventDefault();
    setEditDragActive(false);
  }

  function handleEditDrop(e) {
    e.preventDefault();
    setEditDragActive(false);
    addFiles(e.dataTransfer.files);
  }

  // 썸네일 순서 변경은 네이티브 HTML5 드래그 대신 포인터 이벤트로 직접 구현한다.
  // 네이티브 드래그는 아주 짧게 움직이면 브라우저가 "드래그"가 아니라 "클릭"으로 처리해버려서,
  // 바로 옆 "+" 버튼 위에서 놓았을 때 파일 선택창이 열리고 같은 사진이 다시 추가되는 문제가 있었다.
  // 포인터 이벤트로 직접 처리하면 일정 거리 이상 움직였을 때만 드래그로 인정하므로 이 문제가 없다.
  const DRAG_THRESHOLD = 6;

  function getIndexAtPoint(x, y) {
    for (let i = 0; i < thumbNodesRef.current.length; i += 1) {
      const el = thumbNodesRef.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return i;
    }
    return null;
  }

  function handleThumbPointerMove(e) {
    const state = pointerDragRef.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      state.dragging = true;
      setDraggingIndex(state.index);
    }
    if (state.dragging) {
      const overIndex = getIndexAtPoint(e.clientX, e.clientY);
      if (overIndex !== null) state.overIndex = overIndex;
    }
  }

  function handleThumbPointerUp() {
    const state = pointerDragRef.current;
    pointerDragRef.current = null;
    window.removeEventListener("pointermove", handleThumbPointerMove);
    window.removeEventListener("pointerup", handleThumbPointerUp);
    setDraggingIndex(null);
    if (!state || !state.dragging) return;
    const { index: dragIndex, overIndex: dropIndex } = state;
    if (dragIndex === dropIndex) return;
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
  }

  function handleThumbPointerDown(e, index) {
    if (previews.length <= 1) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerDragRef.current = { index, overIndex: index, startX: e.clientX, startY: e.clientY, dragging: false };
    window.addEventListener("pointermove", handleThumbPointerMove);
    window.addEventListener("pointerup", handleThumbPointerUp);
  }

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", handleThumbPointerMove);
      window.removeEventListener("pointerup", handleThumbPointerUp);
    },
    []
  );

  function removeFile(index) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    if (next.length === 0) setStep("select");
  }

  async function addTag(rawValue) {
    const uname = rawValue.trim().replace(/^@/, "").toLowerCase();
    if (!uname) return;
    if (taggedUsers.includes(uname) || pendingTagRef.current === uname) {
      setTagQuery("");
      return;
    }
    pendingTagRef.current = uname;
    setTagChecking(true);
    try {
      await usersApi.getUserByUsername(uname);
      setTaggedUsers((prev) => (prev.includes(uname) ? prev : [...prev, uname]));
      setTagQuery("");
    } catch {
      showToast(`'${uname}' 사용자를 찾을 수 없습니다.`, "error");
    } finally {
      setTagChecking(false);
      pendingTagRef.current = null;
    }
  }

  function handleTagKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagQuery);
    }
  }

  function handleTagBlur() {
    if (tagQuery.trim()) addTag(tagQuery);
  }

  function removeTag(uname) {
    setTaggedUsers((prev) => prev.filter((u) => u !== uname));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const post = await postsApi.createPost({
        caption,
        location,
        post_type: isReel ? "reel" : "post",
        files,
        tagged_usernames: taggedUsers,
      });
      showToast(isReelMode ? "릴스를 공유했습니다." : "게시물을 공유했습니다.");
      onCreated?.(post);
      onClose();
      navigate(`/p/${post.id}`);
    } catch (err) {
      setError(err.message || "게시에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isReelMode ? "새 릴스 만들기" : "새 게시물 만들기"}
      onClose={onClose}
      width={step === "select" ? 500 : 900}
    >
      {step === "select" && (
        <div
          className={`${styles.selectStep} ${dragActive ? styles.dragActive : ""}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Icon name={isReelMode ? "reels" : "image"} size={72} className={styles.bigIcon} />
          <p>
            {isMobile
              ? isReelMode
                ? "동영상을 업로드 해보세요"
                : "사진과 동영상을 업로드 해보세요"
              : isReelMode
                ? "릴스에 사용할 동영상을 여기에 끌어다 놓으세요"
                : "사진과 동영상을 여기에 끌어다 놓으세요"}
          </p>
          <button type="button" className={styles.pickBtn} onClick={() => inputRef.current?.click()}>
            {isMobile ? "사진첩에서 선택" : "컴퓨터에서 선택"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={isReelMode ? REEL_ACCEPT : ACCEPT}
            multiple={!isReelMode}
            hidden
            onChange={handlePick}
          />
        </div>
      )}

      {step === "edit" && (
        <div className={styles.editStep}>
          <div
            className={`${styles.previewCol} ${editDragActive ? styles.editDragActive : ""}`}
            onDragOver={handleEditDragOver}
            onDragEnter={handleEditDragOver}
            onDragLeave={handleEditDragLeave}
            onDrop={handleEditDrop}
          >
            {previews[0] && (
              <div className={styles.previewMain}>
                {previews[0].type === "video" ? (
                  <video src={previews[0].url} controls className={styles.previewMedia} />
                ) : (
                  <img src={previews[0].url} alt="" className={styles.previewMedia} />
                )}
                <button
                  type="button"
                  className={styles.removeMainBtn}
                  onClick={() => removeFile(0)}
                  aria-label="이 미디어 제거"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            )}
            <div className={styles.thumbRow}>
              {previews.map((p, i) => (
                <div
                  key={p.url}
                  ref={(el) => (thumbNodesRef.current[i] = el)}
                  className={`${styles.thumbItem} ${draggingIndex === i ? styles.thumbDragging : ""}`}
                  onPointerDown={(e) => handleThumbPointerDown(e, i)}
                >
                  {p.type === "video" ? (
                    <video src={p.url} draggable={false} />
                  ) : (
                    <img src={p.url} alt="" draggable={false} />
                  )}
                  <button type="button" onClick={() => removeFile(i)} aria-label="이미지 제거">
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
              {!isReel && files.length < 10 && (
                <button
                  type="button"
                  className={styles.addMoreBtn}
                  onClick={() => addInputRef.current?.click()}
                  aria-label="사진 추가"
                >
                  <Icon name="plus" size={20} />
                </button>
              )}
            </div>
            <input ref={addInputRef} type="file" accept={ACCEPT} multiple hidden onChange={handleAddMore} />
          </div>

          <div className={styles.formCol}>
            <textarea
              placeholder="문구 입력..."
              value={caption}
              maxLength={2200}
              rows={5}
              onChange={(e) => setCaption(e.target.value)}
            />
            <input
              type="text"
              placeholder="위치 추가"
              value={location}
              maxLength={100}
              onChange={(e) => setLocation(e.target.value)}
            />
            <div className={styles.tagField}>
              <input
                type="text"
                placeholder="사람 태그 (아이디 입력 후 Enter)"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleTagBlur}
                disabled={tagChecking}
              />
              {taggedUsers.length > 0 && (
                <div className={styles.tagChips}>
                  {taggedUsers.map((u) => (
                    <span key={u} className={styles.tagChip}>
                      @{u}
                      <button type="button" onClick={() => removeTag(u)} aria-label={`${u} 태그 제거`}>
                        <Icon name="close" size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actionsRow}>
              <button type="button" onClick={() => setStep("select")} disabled={submitting}>
                뒤로
              </button>
              <button type="button" className={styles.shareBtn} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "공유 중..." : "공유하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
