"use client";

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

function getReincarnationParentName(monster) {
  if (!monster) return "";

  return (
    monster.reincarnation_parent_name ||
    monster.parent_name ||
    monster.reincarnation_parent?.name ||
    ""
  );
}

const styles = {
  card: {
    marginBottom: "16px",
    width: "100%",
    minWidth: 0,
  },
  pageTitle: {
    margin: "0 0 12px",
    fontSize: "clamp(26px, 5vw, 40px)",
    lineHeight: 1.15,
    fontWeight: 900,
    color: "var(--text-title)",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
  },
  contentCol: {
    minWidth: 0,
    display: "grid",
    gap: "12px",
    alignContent: "start",
    width: "100%",
  },
  titleBlock: {
    display: "grid",
    gap: "6px",
    width: "100%",
    minWidth: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    width: "100%",
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
  },
  reincarnationRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-start",
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
  description: {
    margin: 0,
    color: "var(--text-sub)",
    fontSize: "14px",
    lineHeight: 1.8,
    wordBreak: "break-word",
  },
  metaGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    width: "100%",
    minWidth: 0,
  },
  metaItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "var(--soft-bg)",
    border: "1px solid var(--soft-border)",
    borderRadius: "14px",
    padding: "8px 12px",
    minWidth: 0,
  },
  metaLabel: {
    fontSize: "12px",
    fontWeight: 800,
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
  },
  metaValue: {
    fontSize: "14px",
    fontWeight: 900,
    color: "var(--text-main)",
  },
};

export default function MonsterDetailHero({ monster, showName = false }) {
  const description =
    joinDisplayValue(monster?.description) ||
    joinDisplayValue(monster?.note) ||
    "";

  const parentName = getReincarnationParentName(monster);
  const isReincarnated =
    Number(monster?.is_reincarnated) === 1 || monster?.is_reincarnated === true;

  return (
    <section style={styles.card}>
      {showName ? <h1 style={styles.pageTitle}>{monster?.name || ""}</h1> : null}

      <div style={styles.contentCol}>
        <div style={styles.titleBlock}>
          <div style={styles.titleRow}>
            {showName && monster?.system_type ? (
              <span style={styles.systemTypeTag}>{monster.system_type}</span>
            ) : null}

            {isReincarnated ? (
              <div style={styles.reincarnationRow}>
                <span style={styles.reincarnationBadge}>転生</span>
                {parentName ? (
                  <span style={styles.parentText}>（{parentName}）</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {description ? <p style={styles.description}>{description}</p> : null}

        {monster?.exp != null || monster?.gold != null ? (
          <div style={styles.metaGrid}>
            {monster?.exp != null ? (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>EXP</span>
                <span style={styles.metaValue}>{monster.exp}</span>
              </div>
            ) : null}

            {monster?.gold != null ? (
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>G</span>
                <span style={styles.metaValue}>{monster.gold}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}