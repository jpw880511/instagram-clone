import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import styles from "./AccountMenu.module.css";

// ... 버튼을 누르면 펼쳐지는 계정 드롭다운. items: [{ icon, label, to?, onClick?, danger? }]
export function AccountMenu({ items }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleSelect(item) {
    setOpen(false);
    if (item.to) navigate(item.to);
    else item.onClick?.();
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.menuBtn}
        onClick={() => setOpen((v) => !v)}
        aria-label="계정 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div className={styles.dropdown} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? styles.danger : undefined}
              onClick={() => handleSelect(item)}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
