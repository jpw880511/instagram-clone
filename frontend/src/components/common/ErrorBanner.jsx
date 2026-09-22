import styles from "./ErrorBanner.module.css";

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className={styles.banner} role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
