import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../common/Icon";
import styles from "./Modal.module.css";

export function Modal({ title, onClose, children, width = 400, hideHeader = false }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={styles.dialog}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
              <Icon name="close" size={20} />
            </button>
          </header>
        )}
        {hideHeader && (
          <button type="button" className={styles.floatingClose} onClick={onClose} aria-label="닫기">
            <Icon name="close" size={24} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
