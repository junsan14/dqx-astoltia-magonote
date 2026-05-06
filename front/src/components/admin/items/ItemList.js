"use client";

export default function ItemList({
  items = [],
  loading = false,
  selectedId = null,
  onSelect,
}) {
  if (loading) {
    return <div style={loadingStyle}>読み込み中...</div>;
  }

  if (!items.length) {
    return <div style={emptyStyle}>アイテムがない</div>;
  }

  return (
    <div style={listStyle}>
      {items.map((item) => {
        const active = Number(item.id) === Number(selectedId);

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            style={{
              ...rowStyle,
              ...(active ? activeRowStyle : {}),
            }}
          >
            <div style={nameStyle}>{item.name}</div>
            <div style={subStyle}>
              ID: {item.id}
              {item.category ? ` / ${item.category}` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const listStyle = {
  display: "grid",
  gap: 8,
  minWidth: 0,
  maxHeight: "min(60vh, 560px)",
  overflowY: "auto",

};

const rowStyle = {
  textAlign: "left",
  padding: 12,
  border: "1px solid var(--card-border, #ddd)",
  borderRadius: 10,
  background: "var(--card-bg, #ffffff)",
  cursor: "pointer",
  width: "100%",
  minWidth: 0,
};

const activeRowStyle = {
  border: "1px solid var(--primary-border, #111111)",
  background: "var(--soft-bg, #f5f5f5)",
};

const nameStyle = {
  fontWeight: 700,
  wordBreak: "break-word",
  color: "var(--text-main, var(--page-text, #111827))",
};

const subStyle = {
  marginTop: 6,
  fontSize: 13,
  color: "var(--text-muted, #666)",
  wordBreak: "break-word",
};

const emptyStyle = {
  padding: 16,
  color: "var(--text-muted, #666)",
};

const loadingStyle = {
  color: "var(--text-muted, #666)",
};