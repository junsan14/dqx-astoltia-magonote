"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FcLike } from "react-icons/fc";

import MonsterMapCard from "./MonsterMapCard";

function useIsMobile(breakpoint = 920) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [breakpoint]);

  return isMobile;
}

function chunkArray(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function hasHuntingGround(mapItem) {
  if (!mapItem) return false;
  if ((mapItem.is_hunting_ground)) return true;

  const spawns = Array.isArray(mapItem.spawns) ? mapItem.spawns : [];
  return spawns.some((spawn) => Boolean(spawn?.is_hunting_ground));
}

function sortMapsByHuntingGround(items = []) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aHunting = hasHuntingGround(a.item);
      const bHunting = hasHuntingGround(b.item);

      if (aHunting !== bHunting) {
        return aHunting ? -1 : 1;
      }

      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function getStyles() {
  return {
    section: {
      marginTop: "8px",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflowX: "clip",
      boxSizing: "border-box",
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
    tabScroller: {
      display: "flex",
      gap: "8px",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflowX: "auto",
      overflowY: "hidden",
      WebkitOverflowScrolling: "touch",
      overscrollBehaviorX: "contain",
      marginBottom: "14px",
      paddingBottom: "4px",
      boxSizing: "border-box",
      scrollbarWidth: "thin",
    },
    tabGroup: {
      display: "flex",
      gap: "8px",
      flex: "0 0 auto",
      minWidth: 0,
      maxWidth: "100%",
    },
    tabButton: {
      appearance: "none",
      border: `1px solid var(--panel-border)`,
      background: "var(--panel-bg)",
      color: "var(--text-sub)",
      padding: "8px 12px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 700,
      lineHeight: 1.2,
      cursor: "pointer",
      transition: "all 0.2s ease",
      whiteSpace: "nowrap",
      flex: "0 0 auto",
      flexShrink: 0,
      boxSizing: "border-box",
      maxWidth: "100%",
    },
    tabButtonActive: {
      background: "var(--primary-bg)",
      color: "var(--primary-text)",
      border: `1px solid var(--primary-border)`,
    },
    tabButtonContent: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      minWidth: 0,
    },
    tabButtonText: {
      display: "inline-block",
      minWidth: 0,
    },
    huntingLikeIcon: {
      display: "inline-block",
      width: "14px",
      height: "14px",
      flexShrink: 0,
      color: "var(--warning-text, #f59e0b)",
      transform: "translateY(-0.5px)",
    },
    huntingLikeIconActive: {
      color: "var(--primary-text)",
      opacity: 0.92,
    },
    emptyCard: {
      borderRadius: "18px",
      padding: "18px",
      background: "var(--soft-bg)",
      border: `1px dashed var(--soft-border)`,
      color: "var(--text-muted)",
      fontWeight: 700,
    },
    mobileContentScroller: {
      display: "flex",
      overflowX: "auto",
      scrollSnapType: "x mandatory",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      width: "100%",
    },
    mobilePage: {
      minWidth: "100%",
      width: "100%",
      flex: "0 0 100%",
      scrollSnapAlign: "start",
      boxSizing: "border-box",
    },
    mobilePageInner: {
      width: "100%",
      boxSizing: "border-box",
    },
    mobileCardWrap: {
      width: "100%",
      boxSizing: "border-box",
    },
    desktopGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0,1fr))",
      gap: "14px",
      width: "100%",
      minWidth: 0,
    },
    desktopCardWrap: {
      minWidth: 0,
    },
  };
}

function MapTabButton({ mapItem, isActive, onClick, styles }) {
  const liked = hasHuntingGround(mapItem);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.tabButton,
        ...(isActive ? styles.tabButtonActive : {}),
      }}
    >
      <span style={styles.tabButtonContent}>
        <span style={styles.tabButtonText}>{mapItem?.name || "地名なし"}</span>
        {liked ? (
          <FcLike
            style={{
              ...styles.huntingLikeIcon,
              ...(isActive ? styles.huntingLikeIconActive : {}),
            }}
          />
        ) : null}
      </span>
    </button>
  );
}

export default function MonsterMapSection({ maps = [] }) {
  const isMobile = useIsMobile();
  const styles = useMemo(() => getStyles(), []);

  const contentScrollerRef = useRef(null);
  const tabScrollerRef = useRef(null);
  const tabRefs = useRef({});
  const isProgrammaticScrollRef = useRef(false);

  const normalizedMaps = useMemo(() => {
    const filtered = Array.isArray(maps)
      ? maps.filter((item) => item && (item.name || item.id))
      : [];

    return sortMapsByHuntingGround(filtered);
  }, [maps]);

  const pageSize = isMobile ? 1 : 2;

  const pagedMaps = useMemo(() => {
    return chunkArray(normalizedMaps, pageSize);
  }, [normalizedMaps, pageSize]);

  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (activeTab > pagedMaps.length - 1) {
      setActiveTab(0);
    }
  }, [pagedMaps, activeTab]);

  useEffect(() => {
    const scroller = tabScrollerRef.current;
    const target = tabRefs.current[activeTab];
    if (!scroller || !target) return;

    const nextLeft =
      target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;

    scroller.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: "smooth",
    });
  }, [activeTab]);

  useEffect(() => {
    if (!isMobile) return;

    const el = contentScrollerRef.current;
    if (!el) return;

    const pageWidth = el.clientWidth;
    isProgrammaticScrollRef.current = true;

    el.scrollTo({
      left: pageWidth * activeTab,
      behavior: "auto",
    });

    const timer = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, isMobile]);

  useEffect(() => {
    if (!isMobile) return;

    const el = contentScrollerRef.current;
    if (!el) return;

    function handleScroll() {
      if (isProgrammaticScrollRef.current) return;

      const pageWidth = el.clientWidth || 1;
      const nextTab = Math.round(el.scrollLeft / pageWidth);

      if (nextTab !== activeTab && nextTab >= 0 && nextTab < pagedMaps.length) {
        setActiveTab(nextTab);
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeTab, isMobile, pagedMaps.length]);

  if (normalizedMaps.length === 0) {
    return (
      <section style={styles.section}>
        <div style={styles.header}>
          <h2 style={styles.title}>出現場所</h2>
        </div>
        <div style={styles.emptyCard}>出現場所データなし</div>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.title}>出現場所</h2>
      </div>

      <div ref={tabScrollerRef} style={styles.tabScroller}>
        {pagedMaps.map((group, index) => {
          const isActive = index === activeTab;

          return (
            <div
              key={`tab-group-${index}`}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              style={styles.tabGroup}
            >
              {group.map((mapItem) => (
                <MapTabButton
                  key={`tab-${index}-${mapItem.id ?? mapItem.name}`}
                  mapItem={mapItem}
                  isActive={isActive}
                  onClick={() => setActiveTab(index)}
                  styles={styles}
                />
              ))}
            </div>
          );
        })}
      </div>

      {isMobile ? (
        <div ref={contentScrollerRef} style={styles.mobileContentScroller}>
          {pagedMaps.map((group, index) => (
            <div key={`page-${index}`} style={styles.mobilePage}>
              <div style={styles.mobilePageInner}>
                {group.map((mapItem) => (
                  <div
                    key={mapItem.id ?? mapItem.name}
                    style={styles.mobileCardWrap}
                  >
                    <MonsterMapCard mapItem={mapItem} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.desktopGrid}>
          {(pagedMaps[activeTab] ?? []).map((mapItem) => (
            <div
              key={mapItem.id ?? mapItem.name}
              style={styles.desktopCardWrap}
            >
              <MonsterMapCard mapItem={mapItem} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}