import { useState } from "react";
import { Icon } from "../common/Icon";
import styles from "./Carousel.module.css";

export function Carousel({ media, fit = "cover", onDoubleClick, muted, onToggleMute, fill = false }) {
  const [index, setIndex] = useState(0);
  if (!media || media.length === 0) return null;

  const go = (delta) => {
    setIndex((prev) => Math.min(Math.max(prev + delta, 0), media.length - 1));
  };

  const current = media[index];

  return (
    <div
      className={styles.wrap}
      style={fill ? { aspectRatio: "auto", height: "100%" } : undefined}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>
        {media.map((item) => (
          <div className={styles.slide} key={item.id}>
            {item.media_type === "video" ? (
              <video
                src={item.url}
                className={styles.media}
                style={{ objectFit: fit }}
                muted={muted}
                loop
                playsInline
                autoPlay
              />
            ) : (
              <img src={item.url} alt="" className={styles.media} style={{ objectFit: fit }} />
            )}
          </div>
        ))}
      </div>

      {current.media_type === "video" && onToggleMute && (
        <button
          type="button"
          className={styles.muteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-label={muted ? "음소거 해제" : "음소거"}
        >
          <Icon name={muted ? "mute" : "unmute"} size={18} />
        </button>
      )}

      {media.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              className={`${styles.arrow} ${styles.left}`}
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="이전 미디어"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
          )}
          {index < media.length - 1 && (
            <button
              type="button"
              className={`${styles.arrow} ${styles.right}`}
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="다음 미디어"
            >
              <Icon name="chevronRight" size={18} />
            </button>
          )}
          <div className={styles.dots}>
            {media.map((item, i) => (
              <span key={item.id} className={`${styles.dot} ${i === index ? styles.dotActive : ""}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
