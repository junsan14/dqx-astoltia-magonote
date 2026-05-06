"use client";

import { useMemo } from "react";

export default function MonsterSearchCard({
  monster,
  searchType,
  formatSubText,
  isOpen = false,
  onClick,
}) {
  const styles = useMemo(() => getStyles(), []);

  const subText = formatSubText ? formatSubText(monster) : null;
  const typeText =
    searchType === "monster" ? monster?.system_type || "" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.card,
        ...(isOpen ? styles.cardOpen : {}),
      }}
    >
      <div style={styles.topRow}>
        <h2 style={styles.cardTitle}>{monster.name}</h2>

        <div style={styles.rightSide}>
          {typeText ? <span style={styles.typeTag}>{typeText}</span> : null}
          <span
            style={{
              ...styles.arrow,
              ...(isOpen ? styles.arrowOpen : {}),
            }}
          >
            {isOpen ? "−" : "+"}
          </span>
        </div>
      </div>

      {subText && searchType !== "monster" ? (
        <p style={styles.subText}>{subText}</p>
      ) : null}
    </button>
  );
}

function getStyles() {
  return {
    card: {
      width: "100%",
      display: "block",
      textAlign: "left",
      borderRadius: "5px",
      padding: "18px",
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
   
      transition:
        "transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease, color .16s ease",
      cursor: "pointer",
      appearance: "none",
    },
    cardOpen: {
      border: "1px solid var(--selected-border)",
      borderBottom: "1px solid transparent",
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,

      background: "var(--panel-bg)",
    },
    topRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "12px",
    },
    cardTitle: {
      margin: 0,
      fontSize: "24px",
      lineHeight: 1.2,
      fontWeight: 900,
      letterSpacing: "-0.03em",
      color: "var(--text-title)",
      minWidth: 0,
    },
    rightSide: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexShrink: 0,
    },
    typeTag: {
      display: "inline-flex",
      alignItems: "center",
      maxWidth: "220px",
      padding: "7px 10px",
      borderRadius: "999px",
      background: "var(--badge-bg)",
      color: "var(--badge-text)",
      fontSize: "12px",
      fontWeight: 800,
      border: "1px solid var(--selected-border)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    arrow: {
      minWidth: "32px",
      height: "32px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "999px",
      fontSize: "18px",
      color: "var(--text-muted)",
      fontWeight: 800,
      background: "var(--soft-bg)",
      border: "1px solid var(--soft-border)",
    },
    arrowOpen: {
      color: "var(--badge-text)",
      background: "var(--badge-bg)",
      border: "1px solid var(--selected-border)",
    },
    subText: {
      margin: "12px 0 0",
      color: "var(--text-sub)",
      fontSize: "14px",
      lineHeight: 1.7,
      minHeight: "24px",
    },
  };
}