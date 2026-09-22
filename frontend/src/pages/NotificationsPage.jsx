import { NotificationsList } from "../components/notifications/NotificationsList";
import styles from "./NotificationsPage.module.css";

export function NotificationsPage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>알림</h1>
      <NotificationsList />
    </div>
  );
}
