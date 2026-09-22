import { Outlet } from "react-router-dom";
import styles from "./AuthLayout.module.css";

export function AuthLayout() {
  return (
    <div className={styles.wrap}>
      <Outlet />
      <footer className={styles.footer}>
        <p>Instagram 학습용 클론 &middot; Gram</p>
      </footer>
    </div>
  );
}
