"use client";

export default function MonsterSearchSidebar({
  monsters = [],
  selectedId = null,
  keyword = "",
  loading = false,
  onKeywordChange,
  onSelect,
  onCreateNew,
  isOpen = true,
  onToggle,
  createDisabled = false,
  createLabel = "新規",
}) {
  return (
    <>
      <style>{`
        @media (max-width: 960px) {
          .monster-search-sidebar {
            width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
            max-height: none !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 20;
            padding: 12px !important;
            gap: 10px !important;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
          }

          .monster-search-sidebar-list {
            max-height: 32vh !important;
          }
        }

        @media (max-width: 640px) {
          .monster-search-sidebar {
            padding: 10px !important;
          }

          .monster-search-sidebar-title {
            font-size: 18px !important;
          }

          .monster-search-sidebar-header-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .monster-search-sidebar-new,
          .monster-search-sidebar-toggle {
            padding: 8px 10px !important;
          }

          .monster-search-sidebar-input {
            font-size: 16px !important;
          }

          .monster-search-sidebar-item {
            padding: 10px !important;
          }
        }
      `}</style>

      <aside className="monster-search-sidebar" style={sidebarStyle()}>
        <div style={headerStyle}>
          <h2 className="monster-search-sidebar-title" style={titleStyle()}>
            モンスター
          </h2>

          <div
            className="monster-search-sidebar-header-actions"
            style={headerActionsStyle}
          >
            <button
              type="button"
              onClick={onCreateNew}
              disabled={createDisabled}
              title={createDisabled ? "管理者のみ" : ""}
              className="monster-search-sidebar-new"
              style={newButtonStyle(createDisabled)}
            >
              {createLabel}
            </button>

            <button
              type="button"
              onClick={onToggle}
              className="monster-search-sidebar-toggle"
              style={toggleButtonStyle()}
            >
              {isOpen ? "閉じる" : "開く"}
            </button>
          </div>
        </div>

        {isOpen && (
          <>
            <input
              type="text"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="モンスター名で検索"
              className="monster-search-sidebar-input"
              style={inputStyle()}
            />

            <div className="monster-search-sidebar-list" style={listStyle}>
              {loading ? (
                <div style={emptyStyle()}>読み込み中...</div>
              ) : monsters.length === 0 ? (
                <div style={emptyStyle()}>モンスターなし</div>
              ) : (
                monsters.map((monster) => {
                  const active = Number(selectedId) === Number(monster.id);

                  return (
                    <button
                      key={monster.id}
                      type="button"
                      onClick={() => onSelect(monster)}
                      className="monster-search-sidebar-item"
                      style={{
                        ...itemStyle(),
                        ...(active ? itemActiveStyle() : {}),
                      }}
                    >
                      <div style={itemTopStyle}>
                        <strong style={itemNameStyle}>{monster.name}</strong>
                        <span style={orderStyle()}>
                          #{monster.display_order ?? 0}
                        </span>
                      </div>

                      <div style={metaStyle()}>
                        {monster.system_type || "系統なし"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

const sidebarStyle = () => ({
  width: 320,
  minWidth: 320,
  borderRight: "1px solid var(--card-border)",
  borderBottom: "1px solid var(--card-border)",
  padding: 16,
  background: "var(--card-bg)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  height: "100vh",
  position: "sticky",
  top: 0,
  overflow: "hidden",
});

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const titleStyle = () => ({
  margin: 0,
  fontSize: 20,
  color: "var(--text-title)",
});

const headerActionsStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const newButtonStyle = (disabled = false) => ({
  border: `1px solid ${
    disabled ? "var(--soft-border)" : "var(--primary-border)"
  }`,
  background: disabled ? "var(--input-disabled-bg)" : "var(--primary-bg)",
  color: disabled ? "var(--text-muted)" : "var(--primary-text)",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: disabled ? "not-allowed" : "pointer",
  minHeight: 38,
  flexShrink: 0,
  opacity: disabled ? 0.7 : 1,
});

const toggleButtonStyle = () => ({
  border: "1px solid var(--input-border)",
  background: "var(--secondary-bg)",
  color: "var(--text-main)",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  minHeight: 38,
  flexShrink: 0,
});

const inputStyle = () => ({
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--input-text)",
  boxSizing: "border-box",
});

const listStyle = {
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 0,
};

const itemStyle = () => ({
  textAlign: "left",
  border: "1px solid var(--card-border)",
  background: "var(--card-bg)",
  borderRadius: 10,
  padding: 12,
  cursor: "pointer",
  minWidth: 0,
});

const itemActiveStyle = () => ({
  background: "var(--selected-bg)",
  border: "1px solid var(--selected-border)",
});

const itemTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};

const itemNameStyle = {
  minWidth: 0,
  wordBreak: "break-word",
};

const orderStyle = () => ({
  color: "var(--text-muted)",
  fontSize: 12,
  flexShrink: 0,
});

const metaStyle = () => ({
  marginTop: 6,
  fontSize: 13,
  color: "var(--text-muted)",
  wordBreak: "break-word",
});

const emptyStyle = () => ({
  padding: 12,
  color: "var(--text-muted)",
});