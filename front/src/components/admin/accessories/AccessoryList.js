"use client";

export default function AccessoryList({
  accessories = [],
  loading = false,
  selectedId = null,
  onSelect,
  isMobile = false,
}) {
  if (loading) {
    return <div style={loadingStyle}>読み込み中...</div>;
  }

  if (!accessories.length) {
    return <div style={emptyStyle}>データがない</div>;
  }

  return (
    <div style={listStyle(isMobile)}>
      {accessories.map((accessory) => {
        const active = Number(selectedId) === Number(accessory.id);

        return (
          <button
            key={accessory.id}
            type="button"
            onClick={() => onSelect(accessory.id)}
            style={{
              ...itemStyle,
              ...(active ? activeItemStyle : null),
            }}
          >
            <div style={titleStyle}>
              {accessory.name || "名称未設定"}
            </div>
            <div style={metaStyle}>
              {accessory.slot || "-"} / {accessory.accessory_type || "-"}
            </div>
            <div style={subStyle}>{accessory.item_id || "-"}</div>
          </button>
        );
      })}
    </div>
  );
}

const listStyle = (isMobile) => ({
  display: "grid",
  gap: 8,
  maxHeight: isMobile ? "none" : "calc(100vh - 240px)",
  overflow: isMobile ? "visible" : "auto",
});

const itemStyle = {
  textAlign: "left",
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  padding: 12,
  background: "var(--card-bg)",
  cursor: "pointer",
  minWidth: 0,
};

const activeItemStyle = {
  border: "2px solid var(--selected-border)",
  background: "var(--selected-bg)",
};

const titleStyle = {
  fontWeight: 700,
  marginBottom: 4,
  wordBreak: "break-word",
  color: "var(--text-main)",
};

const metaStyle = {
  fontSize: 12,
  color: "var(--text-sub)",
  marginBottom: 4,
  wordBreak: "break-word",
};

const subStyle = {
  fontSize: 12,
  color: "var(--text-muted)",
  wordBreak: "break-all",
};

const emptyStyle = {
  padding: "16px 8px",
  color: "var(--text-muted)",
};

const loadingStyle = {
  color: "var(--text-sub)",
};