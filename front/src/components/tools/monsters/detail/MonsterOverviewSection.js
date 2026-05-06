"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MonsterImageCard from "@/components/tools/monsters/detail/MonsterImageCard";

function joinDisplayValue(value) {
  if (value == null) return "";

  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean).join(" / ");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[]") return "";

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean).join(" / ");
      }

      if (typeof parsed === "string") return parsed.trim();
    } catch (_) {
      return trimmed;
    }

    return trimmed;
  }

  return String(value);
}

function pickMemoValues(monster) {
  const candidates = [
    monster?.memo_1,
    monster?.memo1,
    monster?.trivia_1,
    monster?.豆知識1,
    monster?.memo_2,
    monster?.memo2,
    monster?.trivia_2,
    monster?.豆知識2,
  ];

  return candidates.map(joinDisplayValue).filter(Boolean).slice(0, 2);
}

function getReincarnationParentName(monster) {
  if (!monster) return "";

  return (
    monster.reincarnation_parent_name ||
    monster.parent_name ||
    monster.reincarnation_parent?.name ||
    ""
  );
}

function useIsMobile(breakpoint = 920) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
}

const styles = {
  section: {
    marginBottom: "16px",
    width: "100%",
    minWidth: 0,
  },
  header: {
    marginBottom: "12px",
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
    color: "var(--text-title)",
  },
  card: {
    width: "100%",
    minWidth: 0,
    borderRadius: "18px",
    border: "1px solid var(--card-border)",
    background: "transparent",
    padding: "16px",
    boxSizing: "border-box",
  },

  desktopGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 200px",
    gap: "20px",
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },
  mobileGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 7fr) minmax(72px, 3fr)",
    gap: "12px",
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },

  leftCol: {
    minWidth: 0,
    display: "grid",
    gap: "12px",
    alignContent: "start",
  },

  desktopTitleBlock: {
    display: "grid",
    gap: "8px",
    minWidth: 0,
  },
  desktopTitleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "10px",
    width: "100%",
    minWidth: 0,
    flexWrap: "wrap",
  },

  mobileTitleBlock: {
    display: "grid",
    gap: "8px",
    minWidth: 0,
  },

  pageTitle: {
    margin: 0,
    fontSize: "clamp(22px, 4vw, 36px)",
    lineHeight: 1.15,
    fontWeight: 900,
    color: "var(--text-title)",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
    minWidth: 0,
  },

  systemTypeTag: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1,
    background: "var(--soft-bg)",
    color: "var(--text-main)",
    border: "1px solid var(--soft-border)",
    whiteSpace: "nowrap",
    width: "fit-content",
    maxWidth: "100%",
    flexShrink: 0,
  },
  desktopSystemTypeTag: {
    transform: "translateY(2px)",
  },

  reincarnationRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    minWidth: 0,
  },
  reincarnationBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1,
    background: "var(--warning-bg, var(--soft-bg))",
    color: "var(--warning-text, var(--text-main))",
    border: "1px solid var(--warning-border, var(--soft-border))",
    whiteSpace: "nowrap",
  },
  parentText: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-sub)",
    whiteSpace: "normal",
    wordBreak: "break-word",
  },

  imageColDesktop: {
    minWidth: 0,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
  imageColMobile: {
    minWidth: 0,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    paddingTop: "2px",
  },
  desktopImageWrap: {
    width: "200px",
    minWidth: "200px",
  },

  memoSectionDesktop: {
    display: "grid",
    gap: "10px",
    minWidth: 0,
  },
  memoSectionMobile: {
    marginTop: "14px",
    width: "100%",
    minWidth: 0,
  },
  memoHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "10px",
    minWidth: 0,
  },
  memoTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 900,
    color: "var(--text-title)",
  },
  memoCard: {
    margin: 0,
    borderRadius: "14px",
    padding: "12px 14px",
    background: "var(--card-bg)",
    border: "1px solid var(--soft-border)",
    color: "var(--text-sub)",
    fontSize: "14px",
    lineHeight: 1.8,
    wordBreak: "break-word",
    boxSizing: "border-box",
  },
  emptyMemo: {
    margin: 0,
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.8,
  },

  tabsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px",
    width: "100%",
    marginBottom: "10px",
  },
  tabButton: {
    appearance: "none",
    border: "1px solid var(--panel-border)",
    background: "var(--panel-bg)",
    color: "var(--text-sub)",
    padding: "8px 8px",
    fontSize: "12px",
    fontWeight: 900,
    lineHeight: 1.2,
    cursor: "pointer",
    borderRadius: "5px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  tabButtonActive: {
    background: "var(--primary-bg)",
    color: "var(--primary-text)",
    border: "1px solid var(--primary-border)",
  },
  mobileContentViewport: {
    overflow: "hidden",
    width: "100%",
    minWidth: 0,
  },
  mobileScroller: {
    display: "flex",
    overflowX: "auto",
    overflowY: "hidden",
    scrollSnapType: "x mandatory",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    width: "100%",
    minWidth: 0,
  },
  mobilePage: {
    minWidth: "100%",
    width: "100%",
    flex: "0 0 100%",
    scrollSnapAlign: "start",
    boxSizing: "border-box",
  },
  mobileMemoCard: {
    margin: 0,
    borderRadius: "14px",
    padding: "12px 14px",
    background: "var(--card-bg)",
    border: "1px solid var(--soft-border)",
    color: "var(--text-sub)",
    fontSize: "14px",
    lineHeight: 1.8,
    wordBreak: "break-word",
    boxSizing: "border-box",
    minHeight: "132px",
    display: "flex",
    alignItems: "center",
  },
  mobileMemoCardText: {
    margin: 0,
    width: "100%",
  },
  dots: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    marginTop: "10px",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "var(--soft-border)",
    opacity: 0.9,
  },
  dotActive: {
    background: "var(--primary-border)",
  },
};

export default function MonsterOverviewSection({ monster }) {
  const isMobile = useIsMobile();
  const memos = useMemo(() => pickMemoValues(monster), [monster]);

  const parentName = getReincarnationParentName(monster);
  const isReincarnated =
    Number(monster?.is_reincarnated) === 1 || monster?.is_reincarnated === true;

  const scrollerRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!isMobile || !memos.length) return;

    const el = scrollerRef.current;
    if (!el) return;

    const pageWidth = el.clientWidth || 1;
    isProgrammaticScrollRef.current = true;

    el.scrollTo({
      left: pageWidth * activeTab,
      behavior: "smooth",
    });

    const timer = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 350);

    return () => clearTimeout(timer);
  }, [activeTab, isMobile, memos.length]);

  useEffect(() => {
    if (!isMobile || !memos.length) return;

    const el = scrollerRef.current;
    if (!el) return;

    function handleScroll() {
      if (isProgrammaticScrollRef.current) return;

      const pageWidth = el.clientWidth || 1;
      const nextTab = Math.round(el.scrollLeft / pageWidth);

      if (nextTab !== activeTab && nextTab >= 0 && nextTab < memos.length) {
        setActiveTab(nextTab);
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeTab, isMobile, memos.length]);

  useEffect(() => {
    if (activeTab > Math.max(0, memos.length - 1)) {
      setActiveTab(0);
    }
  }, [activeTab, memos.length]);

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>モンスター情報</h2>
      </div>

      <div style={styles.card}>
        <div style={isMobile ? styles.mobileGrid : styles.desktopGrid}>
          <div style={styles.leftCol}>
            {!isMobile ? (
              <>
                <div style={styles.desktopTitleBlock}>
                  <div style={styles.desktopTitleRow}>
                    <h1 style={styles.pageTitle}>{monster?.name || ""}</h1>

                    {monster?.system_type ? (
                      <span
                        style={{
                          ...styles.systemTypeTag,
                          ...styles.desktopSystemTypeTag,
                        }}
                      >
                        {monster.system_type}
                      </span>
                    ) : null}
                  </div>

                  {isReincarnated ? (
                    <div style={styles.reincarnationRow}>
                      <span style={styles.reincarnationBadge}>転生</span>
                      {parentName ? (
                        <span style={styles.parentText}>（{parentName}）</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {memos.length ? (
                  <div style={styles.memoSectionDesktop}>
                    {memos.map((memo, index) => (
                      <p key={`memo-${index}`} style={styles.memoCard}>
                        {memo}
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div style={styles.mobileTitleBlock}>
                <h1 style={styles.pageTitle}>{monster?.name || ""}</h1>

                {(isReincarnated || monster?.system_type) ? (
                  <div style={styles.reincarnationRow}>
                    {isReincarnated ? (
                      <span style={styles.reincarnationBadge}>転生</span>
                    ) : null}

                    {parentName && isReincarnated ? (
                      <span style={styles.parentText}>（{parentName}）</span>
                    ) : null}

                    {monster?.system_type ? (
                      <span style={styles.systemTypeTag}>{monster.system_type}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div style={isMobile ? styles.imageColMobile : styles.imageColDesktop}>
            {!isMobile ? (
              <div style={styles.desktopImageWrap}>
                <MonsterImageCard monster={monster} size="sm" rounded={5} />
              </div>
            ) : (
              <MonsterImageCard monster={monster} size="sm" rounded={5} />
            )}
          </div>
        </div>

        {isMobile && memos.length ? (
          <div style={styles.memoSectionMobile}>
            <div style={styles.memoHeader}>
              <h3 style={styles.memoTitle}>豆知識</h3>
            </div>

            {memos.length > 1 ? (
              <div style={styles.tabsRow}>
                {memos.map((_, index) => {
                  const isActive = index === activeTab;

                  return (
                    <button
                      key={`memo-tab-${index}`}
                      type="button"
                      onClick={() => setActiveTab(index)}
                      style={{
                        ...styles.tabButton,
                        ...(isActive ? styles.tabButtonActive : {}),
                      }}
                    >
                      豆知識 {index + 1}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div style={styles.mobileContentViewport}>
              <div ref={scrollerRef} style={styles.mobileScroller}>
                {memos.map((memo, index) => (
                  <div key={`memo-page-${index}`} style={styles.mobilePage}>
                    <div style={styles.mobileMemoCard}>
                      <p style={styles.mobileMemoCardText}>{memo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {memos.length > 1 ? (
              <div style={styles.dots}>
                {memos.map((_, index) => (
                  <span
                    key={`memo-dot-${index}`}
                    style={{
                      ...styles.dot,
                      ...(index === activeTab ? styles.dotActive : {}),
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}