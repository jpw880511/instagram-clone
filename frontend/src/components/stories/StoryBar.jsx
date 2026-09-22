import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "../media/Avatar";
import { Icon } from "../common/Icon";
import { StoryViewer } from "./StoryViewer";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import * as storiesApi from "../../api/stories";
import styles from "./StoryBar.module.css";

export function StoryBar() {
  const [groups, setGroups] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const { user: me } = useAuth();
  const { showToast } = useToast();

  const load = useCallback(() => {
    if (!me) return;
    storiesApi.getStoryTray().then(setGroups).catch(() => {});
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  if (!me) return null;

  function handleAvatarClick(index, group) {
    if (group.user.id === me.id && group.story_count === 0) {
      fileRef.current?.click();
      return;
    }
    setOpenIndex(index);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await storiesApi.createStory(file);
      showToast("스토리를 공유했습니다.");
      load();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUploading(false);
    }
  }

  if (groups.length === 0) return null;

  return (
    <div className={styles.bar}>
      <div className={styles.scroll}>
        {groups.map((group, index) => {
          const isMe = group.user.id === me.id;
          return (
            <button key={group.user.id} type="button" className={styles.item} onClick={() => handleAvatarClick(index, group)}>
              <span className={styles.ringWrap}>
                <Avatar
                  src={group.user.avatar_url}
                  username={group.user.username}
                  size="story"
                  linkToProfile={false}
                  ring={group.story_count > 0 && (isMe || group.has_unseen)}
                />
                {isMe && (
                  <span className={styles.plusBadge} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                    <Icon name="plus" size={12} />
                  </span>
                )}
              </span>
              <span className={styles.name}>{isMe ? "내 스토리" : group.user.username}</span>
            </button>
          );
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleUpload} disabled={uploading} />

      {openIndex !== null && (
        <StoryViewer groups={groups} startIndex={openIndex} onClose={() => setOpenIndex(null)} onViewed={load} />
      )}
    </div>
  );
}
