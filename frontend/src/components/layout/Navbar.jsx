import { NavLink } from "react-router-dom";
import { Icon } from "../common/Icon";
import { Avatar } from "../media/Avatar";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import styles from "./Navbar.module.css";

const NAV_ITEMS = [
  { to: "/", icon: "home", label: "홈" },
  { to: "/explore", icon: "compass", label: "탐색" },
  { to: "/reels", icon: "reels", label: "릴스" },
  { to: "/direct", icon: "send", label: "메시지" },
];

export function Navbar({ onToggleSearch, onToggleNotifications, onOpenCreate, searchOpen, notifOpen, unreadCount, dmUnreadCount }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className={styles.nav} aria-label="주 메뉴">
      <div className={styles.logoWrap}>
        <NavLink to="/" className={styles.logo}>
          <span className={styles.logoFull}>Gram</span>
          <span className={styles.logoIcon} aria-hidden="true">
            <Icon name="camera" size={26} />
          </span>
        </NavLink>
      </div>

      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}
            >
              <span className={styles.iconWithBadge}>
                <Icon name={item.icon} size={24} />
                {item.to === "/direct" && dmUnreadCount > 0 && (
                  <span className={styles.badge}>{dmUnreadCount > 9 ? "9+" : dmUnreadCount}</span>
                )}
              </span>
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}

        <li>
          <button
            type="button"
            className={`${styles.item} ${searchOpen ? styles.active : ""}`}
            onClick={onToggleSearch}
            aria-label="검색"
            aria-pressed={searchOpen}
          >
            <Icon name="search" size={24} />
            <span className={styles.label}>검색</span>
          </button>
        </li>

        <li>
          <button
            type="button"
            className={`${styles.item} ${notifOpen ? styles.active : ""}`}
            onClick={onToggleNotifications}
            aria-label="알림"
            aria-pressed={notifOpen}
          >
            <span className={styles.iconWithBadge}>
              <Icon name="bell" size={24} />
              {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </span>
            <span className={styles.label}>알림</span>
          </button>
        </li>

        <li>
          <button type="button" className={styles.item} onClick={onOpenCreate} aria-label="만들기">
            <Icon name="plusSquare" size={24} />
            <span className={styles.label}>만들기</span>
          </button>
        </li>

        {user && (
          <li>
            <NavLink to={`/${user.username}`} className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}>
              <Avatar src={user.avatar_url} username={user.username} size="sm" linkToProfile={false} />
              <span className={styles.label}>프로필</span>
            </NavLink>
          </li>
        )}
      </ul>

      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={24} />
        <span className={styles.label}>{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
      </button>
    </nav>
  );
}
