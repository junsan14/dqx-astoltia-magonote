"use client";

import { useEffect, useRef, useState } from "react";

export default function EditorHeader({
  isMobile = false,
  title,
  description,
  notice,
  onSave,
  onDelete,
  saving = false,
  saveDisabled = false,
  deleteDisabled = false,
  deleteTitle = "",
}) {
  const [showMobileBar, setShowMobileBar] = useState(false);
 

  const scrollTimeoutRef = useRef(null);
  const focusTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isMobile) {
      setShowMobileBar(false);
    
      return;
    }

    const SHOW_AFTER_SCROLL_MS = 900;
    const SHOW_AFTER_INPUT_IDLE_MS = 2000;

    const clearTimers = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };

    const isEditableTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;

      const tag = target.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return true;
      }

      if (target.isContentEditable) return true;

      return false;
    };

    const scheduleShowAfterInputIdle = () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }

      focusTimeoutRef.current = setTimeout(() => {
        const active = document.activeElement;
        const stillEditing =
          active instanceof HTMLElement && isEditableTarget(active);



        if (stillEditing) {
          setShowMobileBar(true);
        }
      }, SHOW_AFTER_INPUT_IDLE_MS);
    };

    const scheduleShowAfterScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const active = document.activeElement;
        const stillEditing =
          active instanceof HTMLElement && isEditableTarget(active);

        if (!stillEditing) {
          setShowMobileBar(true);
        }
      }, SHOW_AFTER_SCROLL_MS);
    };

    const handleScrollLikeAction = () => {
      setShowMobileBar(false);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }

      scheduleShowAfterScroll();
    };

    const handleFocusIn = (event) => {
      if (!isEditableTarget(event.target)) return;

 
      setShowMobileBar(false);
      scheduleShowAfterInputIdle();
    };

    const handleInput = (event) => {
      if (!isEditableTarget(event.target)) return;


      setShowMobileBar(false);
      scheduleShowAfterInputIdle();
    };

    const handleFocusOut = () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }

      const active = document.activeElement;
      const stillEditing =
        active instanceof HTMLElement && isEditableTarget(active);


      if (!stillEditing) {
        setShowMobileBar(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShowMobileBar(false);
      }
    };

    window.addEventListener("scroll", handleScrollLikeAction, { passive: true });
    window.addEventListener("touchmove", handleScrollLikeAction, {
      passive: true,
    });
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const active = document.activeElement;
    const editingNow =
      active instanceof HTMLElement && isEditableTarget(active);

    setShowMobileBar(!editingNow);

    return () => {
      clearTimers();
      window.removeEventListener("scroll", handleScrollLikeAction);
      window.removeEventListener("touchmove", handleScrollLikeAction);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isMobile]);

  return (
    <>
      <header
        style={{
          ...styles.header,
          ...(isMobile ? styles.headerMobile : null),
        }}
      >
        <div style={styles.headerText}>
          <h1
            style={{
              ...styles.title,
              ...(isMobile ? styles.titleMobile : null),
            }}
          >
            {title}
          </h1>

          {description ? (
            <p style={styles.description}>{description}</p>
          ) : null}

          {notice ? <p style={styles.notice}>{notice}</p> : null}
        </div>

        {!isMobile ? (
          <div style={styles.actionsFloating}>
            <button
              type="button"
              onClick={onSave}
              disabled={saveDisabled}
              style={saveButtonStyle(saveDisabled)}
            >
              {saving ? "保存中..." : "保存"}
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={deleteDisabled}
              title={deleteTitle}
              style={deleteButtonStyle(deleteDisabled)}
            >
              削除
            </button>
          </div>
        ) : null}
      </header>

      {isMobile ? <div style={styles.mobileBottomSpacer} /> : null}

      {isMobile ? (
        <div
          style={{
            ...styles.mobileBottomBar,
            ...(showMobileBar ? styles.mobileBottomBarVisible : null),
            ...(!showMobileBar ? styles.mobileBottomBarHidden : null),
          }}
          aria-hidden={!showMobileBar}
        >
          <div style={styles.mobileBottomBarInner}>
            <button
              type="button"
              onClick={onSave}
              disabled={saveDisabled}
              style={{
                ...saveButtonStyle(saveDisabled),
                ...styles.actionButtonMobile,
              }}
            >
              {saving ? "保存中..." : "保存"}
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={deleteDisabled}
              title={deleteTitle}
              style={{
                ...deleteButtonStyle(deleteDisabled),
                ...styles.actionButtonMobile,
              }}
            >
              削除
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,

    flexWrap: "wrap",
    position: "relative",
  },

  headerMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    marginBottom: 16,
  },

  headerText: {
    minWidth: 0,
    flex: 1,
  },

  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.3,
    color: "var(--text-title)",
    wordBreak: "break-word",
  },

  titleMobile: {
    fontSize: 22,
  },

  description: {
    margin: "6px 0 0",
    color: "var(--text-muted)",
    lineHeight: 1.6,
  },

  notice: {
    margin: "8px 0 0",
    color: "var(--text-muted)",
    fontSize: 13,
    lineHeight: 1.6,
  },

  actionsFloating: {
    position: "fixed",
    top: "calc(var(--site-header-height))",
    right: "max(16px, calc((100vw - 1152px) / 2))",
    zIndex: 45,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    border: "1px solid var(--panel-border)",
    background: "color-mix(in srgb, var(--panel-bg) 88%, transparent)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 28px rgba(15,23,42,0.14)",
  },

  mobileBottomSpacer: {
    height: 88,
  },

  mobileBottomBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
    pointerEvents: "none",
    transition:
      "transform 220ms ease, opacity 220ms ease, visibility 220ms ease",
  },

  mobileBottomBarVisible: {
    opacity: 1,
    visibility: "visible",
    transform: "translateY(0)",
    pointerEvents: "auto",
  },

  mobileBottomBarHidden: {
    opacity: 0,
    visibility: "hidden",
    transform: "translateY(120%)",
    pointerEvents: "none",
  },

  mobileBottomBarInner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 16,
    border: "1px solid var(--panel-border)",
    background: "color-mix(in srgb, var(--panel-bg) 92%, transparent)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
  },

  actionButtonMobile: {
    flex: 1,
    width: "100%",
  },
};

const saveButtonStyle = (disabled = false) => ({
  border: `1px solid ${
    disabled ? "var(--soft-border)" : "var(--primary-border)"
  }`,
  background: disabled ? "var(--input-disabled-bg)" : "var(--primary-bg)",
  color: disabled ? "var(--text-muted)" : "var(--primary-text)",
  borderRadius: 10,
  padding: "10px 16px",
  cursor: disabled ? "not-allowed" : "pointer",
  minHeight: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: disabled ? 0.6 : 1,
  fontWeight: 700,
  whiteSpace: "nowrap",
});

const deleteButtonStyle = (disabled = false) => ({
  border: `1px solid ${
    disabled ? "var(--soft-border)" : "var(--danger-border)"
  }`,
  background: disabled ? "var(--input-disabled-bg)" : "var(--danger-bg)",
  color: disabled ? "var(--text-muted)" : "var(--danger-text)",
  borderRadius: 10,
  padding: "10px 16px",
  cursor: disabled ? "not-allowed" : "pointer",
  minHeight: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: disabled ? 0.6 : 1,
  fontWeight: 700,
  whiteSpace: "nowrap",
});