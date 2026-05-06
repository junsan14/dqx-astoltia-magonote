"use client";

import { useEffect, useState } from "react";

export default function EditorShell({
  isMobile = false,
  sidebar = null,
  children,
}) {
  const hasSidebar = Boolean(sidebar);
  const [footerOverlap, setFooterOverlap] = useState(0);

  useEffect(() => {
    if (isMobile) {
      setFooterOverlap(0);
      return;
    }

    if (typeof window === "undefined") return;

    const updateFooterOverlap = () => {
      const footer =
        document.querySelector("footer") ||
        document.querySelector("#footer") ||
        document.querySelector("[data-footer]");

      if (!footer) {
        setFooterOverlap(0);
        return;
      }

      const rect = footer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const overlap = Math.max(0, viewportHeight - rect.top);

      setFooterOverlap(overlap);
    };

    updateFooterOverlap();

    window.addEventListener("scroll", updateFooterOverlap, { passive: true });
    window.addEventListener("resize", updateFooterOverlap);

    return () => {
      window.removeEventListener("scroll", updateFooterOverlap);
      window.removeEventListener("resize", updateFooterOverlap);
    };
  }, [isMobile]);

  return (
    <main
      style={{
        ...styles.root,
        ...(isMobile ? styles.rootMobile : null),
      }}
    >
      {!isMobile && hasSidebar ? (
        <div style={desktopSidebarLayerStyle(footerOverlap)}>{sidebar}</div>
      ) : null}

      <div
        style={{
          ...styles.inner,
          ...(isMobile ? styles.innerMobile : null),
        }}
      >
        {!isMobile && hasSidebar ? <div style={styles.sidebarSpacer} /> : null}

        {isMobile && hasSidebar ? (
          <div style={styles.mobileSidebar}>{sidebar}</div>
        ) : null}

        <section
          style={{
            ...styles.content,
            ...(isMobile ? styles.contentMobile : null),
          }}
        >
          {children}
        </section>
      </div>
    </main>
  );
}

const SIDEBAR_WIDTH = 400;
const PAGE_GAP = 10;
const SIDEBAR_LEFT_OFFSET = 104;
const SIDEBAR_FOOTPRINT =
  SIDEBAR_WIDTH + Math.max(0, SIDEBAR_LEFT_OFFSET - PAGE_GAP);

const desktopSidebarLayerStyle = (footerOverlap = 0) => ({
  position: "fixed",
  top: `calc(var(--site-header-height, 0px) + ${PAGE_GAP}px)`,
  left: SIDEBAR_LEFT_OFFSET,
  width: SIDEBAR_WIDTH,
  height: `calc(100vh - var(--site-header-height, 0px) - ${
    PAGE_GAP * 2
  }px - ${footerOverlap}px)`,
  zIndex: 30,
});

const styles = {
  root: {
    minHeight: "100vh",
    background: "var(--page-bg)",
    color: "var(--page-text)",
    width: "100%",
    overflowX: "hidden",
    boxSizing: "border-box",
  },

  rootMobile: {
    minHeight: "auto",
  },

  inner: {
    display: "flex",
    alignItems: "flex-start",
    gap: PAGE_GAP,
    padding: PAGE_GAP,
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
  },

  innerMobile: {
    display: "block",
    padding: "12px 0 20px",
  },

  sidebarSpacer: {
    width: SIDEBAR_FOOTPRINT,
    minWidth: SIDEBAR_FOOTPRINT,
    flexShrink: 0,
  },

  mobileSidebar: {
    width: "100%",
    minWidth: 0,
    marginBottom: 16,
    padding: "0 12px",
    boxSizing: "border-box",
  },

  content: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  },

  contentMobile: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    padding: "0 12px",
    boxSizing: "border-box",
  },
};