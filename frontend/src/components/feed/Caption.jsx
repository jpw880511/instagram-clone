import { useState } from "react";
import { Link } from "react-router-dom";
import { parseCaption } from "../../utils/parseCaption";
import styles from "./Caption.module.css";

function renderParts(text) {
  return parseCaption(text).map((part, i) => {
    if (part.type === "hashtag") {
      return (
        <Link key={i} to={`/explore/tags/${part.value.toLowerCase()}`} className={styles.tag}>
          #{part.value}
        </Link>
      );
    }
    if (part.type === "mention") {
      return (
        <Link key={i} to={`/${part.value.toLowerCase()}`} className={styles.tag}>
          @{part.value}
        </Link>
      );
    }
    return <span key={i}>{part.value}</span>;
  });
}

export function Caption({ username, text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > 140;

  return (
    <p className={`${styles.caption} ${!expanded && isLong ? styles.clamped : ""}`}>
      <Link to={`/${username}`} className={styles.username}>
        {username}
      </Link>{" "}
      {renderParts(text)}
      {isLong && !expanded && (
        <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
          {" "}
          더 보기
        </button>
      )}
    </p>
  );
}
