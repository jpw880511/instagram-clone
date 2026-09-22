import { NavLink } from "react-router-dom";
import { Icon } from "../common/Icon";
import { Avatar } from "../media/Avatar";
import { useAuth } from "../../context/AuthContext";
import styles from "./BottomNav.module.css";

export function BottomNav({ onOpenCreate }) {
  const { user } = useAuth();

  return (
    <nav className={styles.nav} aria-label="하단 메뉴">
      <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : styles.item)}>
        <Icon name="home" size={26} />
      </NavLink>
      <NavLink to="/explore" className={({ isActive }) => (isActive ? styles.active : styles.item)}>
        <Icon name="compass" size={26} />
      </NavLink>
      <button type="button" className={styles.item} onClick={onOpenCreate} aria-label="만들기">
        <Icon name="plusSquare" size={26} />
      </button>
      <NavLink to="/reels" className={({ isActive }) => (isActive ? styles.active : styles.item)}>
        <Icon name="reels" size={26} />
      </NavLink>
      {user && (
        <NavLink to={`/${user.username}`} className={styles.item}>
          <Avatar src={user.avatar_url} username={user.username} size="xs" linkToProfile={false} />
        </NavLink>
      )}
    </nav>
  );
}
