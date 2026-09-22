import { Link } from "react-router-dom";
import styles from "./Avatar.module.css";

const SIZE_CLASS = {
  xs: styles.xs,
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
  story: styles.story,
};

export function Avatar({ src, username, size = "md", ring = false, linkToProfile = true }) {
  const img = (
    <span className={`${styles.avatar} ${SIZE_CLASS[size]} ${ring ? styles.ring : ""}`}>
      <span className={styles.inner}>
        {src ? (
          <img src={src} alt={username ? `${username} 프로필 사진` : "프로필 사진"} />
        ) : (
          <span className={styles.placeholder}>{username?.[0]?.toUpperCase() || "?"}</span>
        )}
      </span>
    </span>
  );

  if (linkToProfile && username) {
    return (
      <Link to={`/${username}`} className={styles.link} aria-label={`${username} 프로필로 이동`}>
        {img}
      </Link>
    );
  }
  return img;
}
