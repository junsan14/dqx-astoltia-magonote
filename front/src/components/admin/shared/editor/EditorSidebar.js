"use client";

export default function EditorSidebar({
  isMobile = false,
  isOpen = true,
  onToggle,
  keyword,
  onKeywordChange,
  onCreateNew,
  createDisabled = false,
  createLabel = "新規追加",
  loading = false,
  title = "一覧",
  searchPlaceholder = "検索",
  children,
}) {
  const openMobileListIfNeeded = () => {
    if (isMobile && !isOpen && typeof onToggle === "function") {
      onToggle();
    }
  };

  const handleKeywordFocus = () => {
    openMobileListIfNeeded();
  };

  const handleKeywordChange = (value) => {
    openMobileListIfNeeded();
    onKeywordChange(value);
  };

  return (
    <aside
      style={{
        ...styles.sidebar,
        ...(isMobile ? styles.sidebarMobile : null),
      }}
    >
      <div
          style={{
            ...styles.box,
            ...(isMobile ? styles.boxMobile : null),
          }}
        >
        <div style={styles.topRow}>
          <h2 style={styles.title}>{title}</h2>

          <button
            type="button"
            onClick={onCreateNew}
            disabled={createDisabled}
            style={buttonStyle(createDisabled)}
          >
            {createLabel}
          </button>
        </div>

        <div style={styles.searchRow}>
          <input
            type="text"
            value={keyword}
            onFocus={handleKeywordFocus}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={styles.input}
          />
        </div>

        {loading ? <div style={styles.loading}>読み込み中...</div> : null}

        {(!isMobile || isOpen) && (
            <div
              style={{
                ...styles.listWrap,
                ...(isMobile ? styles.listWrapMobile : null),
              }}
            >
              {children}
            </div>
          )}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "100%",
    height: "100%",
    minWidth: 0,
  },
  boxMobile: {
  height: "auto",
  maxHeight: "50vh",
},

listWrapMobile: {
  maxHeight: "calc(50vh - 120px)",
  overflowY: "auto",
},
  sidebarMobile: {
    height: "auto",
  },

  box: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: 14,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
    height: "100%",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: 18,
    color: "var(--text-title)",
    lineHeight: 1.2,
    minWidth: 0,
    flex: 1,
  },

  searchRow: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flexShrink: 0,
  },

  input: {
    width: "100%",
    minWidth: 0,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
    boxSizing: "border-box",
  },

  loading: {
    color: "var(--text-muted)",
    fontSize: 13,
    flexShrink: 0,
  },

  listWrap: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: 4,
  },
};

const buttonStyle = (disabled = false) => ({
  border: `1px solid ${
    disabled ? "var(--soft-border)" : "var(--primary-border)"
  }`,
  background: disabled ? "var(--input-disabled-bg)" : "var(--primary-bg)",
  color: disabled ? "var(--text-muted)" : "var(--primary-text)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  lineHeight: 1.2,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.7 : 1,
  whiteSpace: "nowrap",
  flexShrink: 0,
});