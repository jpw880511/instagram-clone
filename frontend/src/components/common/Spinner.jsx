import styles from "./Spinner.module.css";

export function Spinner({ size = 24 }) {
  return (
    <div className={styles.spinner} style={{ width: size, height: size }} role="status" aria-label="로딩 중" />
  );
}
