"use client";

export default function FloatingToast({
  visible,
  message,
  type = "success",
  isMobile = false,
}) {
  return (
    <div
      style={{
        ...styles.toast,
        ...(isMobile ? styles.toastMobile : styles.toastDesktop),
        ...(visible ? styles.toastVisible : styles.toastHidden),
        ...(type === "error" ? styles.toastError : styles.toastSuccess),
      }}
      role="status"
      aria-live="polite"
    >
      <div style={styles.toastInner}>
        <div style={styles.toastIcon}>
          {type === "error" ? "!" : "✓"}
        </div>
        <div style={styles.toastText}>{message}</div>
      </div>
    </div>
  );
}

const styles = {
  toast: {
    position: "fixed",
    zIndex: 200,
    pointerEvents: "none",
    transition: "opacity 220ms ease, transform 220ms ease",
  },

  toastDesktop: {
    top: "calc(var(--site-header-height, 72px) + 16px)",
    right: 16,
  },

  toastMobile: {
    left: 12,
    right: 12,
    bottom: "calc(16px + env(safe-area-inset-bottom))",
  },

  toastVisible: {
    opacity: 1,
    transform: "translateY(0)",
  },

  toastHidden: {
    opacity: 0,
    transform: "translateY(12px)",
  },

  toastInner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--panel-border)",
    background: "color-mix(in srgb, var(--panel-bg) 92%, transparent)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 14px 34px rgba(15,23,42,0.16)",
  },

  toastSuccess: {
    color: "var(--text-main)",
  },

  toastError: {
    color: "var(--danger-text)",
  },

  toastIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 13,
    background: "var(--soft-bg)",
    border: "1px solid var(--soft-border)",
    flexShrink: 0,
  },

  toastText: {
    fontWeight: 700,
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
};