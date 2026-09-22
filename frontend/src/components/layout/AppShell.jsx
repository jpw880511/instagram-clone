import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { Icon } from "../common/Icon";
import { SearchPanel } from "../search/SearchPanel";
import { NotificationsList } from "../notifications/NotificationsList";
import { CreatePostModal } from "../modal/CreatePostModal";
import { useAuth } from "../../context/AuthContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import * as notificationsApi from "../../api/notifications";
import * as messagesApi from "../../api/messages";
import styles from "./AppShell.module.css";

// 모바일 상단 아이콘으로 여는 화면은 이전 화면을 그대로 둔 채 그 위로 덮어씌우듯 슬라이드 인 된다.
function isOverlayPath(pathname) {
  return pathname === "/notifications" || pathname === "/direct" || pathname.startsWith("/direct/");
}

const HOME_LOCATION = { pathname: "/", search: "", hash: "", state: null, key: "home" };

export function AppShell({ renderPages }) {
  const [panel, setPanel] = useState(null); // "search" | "notifications" | null
  const [createOpen, setCreateOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 767px)");
  // 오버레이가 아닌 마지막 위치를 기억해 두었다가 오버레이 아래에 계속 렌더링한다.
  const backgroundRef = useRef(HOME_LOCATION);
  const showOverlay = isMobile && isOverlayPath(location.pathname);
  if (!isOverlayPath(location.pathname)) backgroundRef.current = location;
  const [closing, setClosing] = useState(false);

  // 같은 아이콘을 다시 누르면 오버레이를 오른쪽으로 밀어내며 닫고, 원래 화면으로 돌아간다.
  function handleOverlayIcon(e, section) {
    if (!isMobile || closing) return;
    const openSection = location.pathname.startsWith("/direct") ? "/direct" : location.pathname;
    if (openSection !== section) return; // 다른 오버레이로 전환하거나 처음 여는 경우는 링크 기본 동작
    e.preventDefault();
    setClosing(true);
  }

  function handleOverlayAnimationEnd(e) {
    // 자식 요소(말풍선, 스피너 등)의 애니메이션 종료 이벤트도 버블링되므로 오버레이 자신의 것만 처리한다
    if (!closing || e.target !== e.currentTarget) return;
    const bg = backgroundRef.current;
    setClosing(false);
    navigate({ pathname: bg.pathname, search: bg.search });
  }

  const refreshUnread = useCallback(() => {
    if (!user) return;
    notificationsApi
      .getUnreadCount()
      .then((data) => setUnreadCount(data.count))
      .catch(() => {});
  }, [user]);

  const refreshDmUnread = useCallback(() => {
    if (!user) {
      setDmUnread(0);
      return;
    }
    messagesApi
      .getUnreadConversationCount()
      .then((data) => setDmUnread(data.count))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    refreshUnread();
    if (!user) return;
    const interval = setInterval(refreshUnread, 15000);
    return () => clearInterval(interval);
  }, [refreshUnread, user]);

  useEffect(() => {
    refreshDmUnread();
    if (!user) return;
    const interval = setInterval(refreshDmUnread, 4000);
    window.addEventListener(messagesApi.DM_UNREAD_EVENT, refreshDmUnread);
    return () => {
      clearInterval(interval);
      window.removeEventListener(messagesApi.DM_UNREAD_EVENT, refreshDmUnread);
    };
  }, [refreshDmUnread, user]);

  function goLogin() {
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?next=${next}`);
  }

  function togglePanel(name) {
    if (!user) {
      goLogin();
      return;
    }
    setPanel((prev) => {
      const next = prev === name ? null : name;
      if (next === "notifications") setUnreadCount(0);
      return next;
    });
  }

  function openCreate() {
    if (!user) {
      goLogin();
      return;
    }
    setCreateOpen(true);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.mobileTopBar}>
        <Link to="/" className={styles.mobileLogo}>
          Gram
        </Link>
        <div className={styles.mobileTopIcons}>
          <Link to="/notifications" aria-label="알림" className={styles.iconWithBadge} onClick={(e) => handleOverlayIcon(e, "/notifications")}>
            <Icon name="bell" size={24} />
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </Link>
          <Link to="/direct" aria-label="메시지" className={styles.iconWithBadge} onClick={(e) => handleOverlayIcon(e, "/direct")}>
            <Icon name="send" size={24} />
            {dmUnread > 0 && <span className={styles.badge}>{dmUnread > 9 ? "9+" : dmUnread}</span>}
          </Link>
        </div>
      </header>

      <Navbar
        searchOpen={panel === "search"}
        notifOpen={panel === "notifications"}
        unreadCount={unreadCount}
        dmUnreadCount={dmUnread}
        onToggleSearch={() => togglePanel("search")}
        onToggleNotifications={() => togglePanel("notifications")}
        onOpenCreate={openCreate}
      />

      {panel && (
        <div className={styles.sidePanel} role="dialog" aria-label={panel === "search" ? "검색 패널" : "알림 패널"}>
          {panel === "search" ? (
            <SearchPanel onClose={() => setPanel(null)} />
          ) : (
            <div className={styles.notifPanelBody}>
              <header className={styles.notifHeader}>
                <h2>알림</h2>
              </header>
              <NotificationsList onNavigateItem={() => setPanel(null)} />
            </div>
          )}
        </div>
      )}
      {panel && <button type="button" className={styles.scrim} aria-label="패널 닫기" onClick={() => setPanel(null)} />}

      <main className={styles.main}>{renderPages(showOverlay ? backgroundRef.current : location)}</main>

      {showOverlay && (
        <div key={location.pathname.startsWith("/direct") ? "/direct" : location.pathname} className={`${styles.overlayPage} ${closing ? styles.overlayClosing : ""}`}
          onAnimationEnd={handleOverlayAnimationEnd}
        >
          {renderPages(location)}
        </div>
      )}

      <BottomNav onOpenCreate={openCreate} />

      {createOpen && <CreatePostModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
