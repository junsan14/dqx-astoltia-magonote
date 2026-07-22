"use client";

import { useMemo, useState } from "react";

export default function EquipmentDetailsPanel({
  row,
  allItems = [],
  materials = [],
  effects = [],
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddEffect,
  onUpdateEffect,
  onDeleteEffect,
}) {
  const [keyword, setKeyword] = useState("");

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return [];

    return (Array.isArray(allItems) ? allItems : [])
      .filter((item) => String(item?.name ?? "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [allItems, keyword]);

  if (!row) {
    return null;
  }

  function getMaterialItemId(mat) {
    return mat?.item_id ?? mat?.itemId ?? "";
  }

  function findItemNameById(itemId) {
    if (itemId == null || itemId === "") return "";

    const found = allItems.find((item) => String(item.id) === String(itemId));

    return found?.name ?? "";
  }

  function getDisplayMaterialName(mat) {
    const rawName = mat?.name ?? mat?.item_name ?? mat?.itemName ?? "";

    if (String(rawName).trim()) {
      return rawName;
    }

    return findItemNameById(getMaterialItemId(mat));
  }

  function addMaterialFromItem(item) {
    if (!item) return;

    onAddMaterial({
      item_id: Number(item.id),
      count: 1,
    });

    setKeyword("");
  }

  return (
    <div style={styles.stack}>
      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div style={styles.sectionTitle}>素材</div>
        </div>

        <div style={styles.materialSearchBox}>
          <input
            type="text"
            style={styles.inputCompactWide}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="素材を検索して追加"
          />

          {keyword.trim() ? (
            <div style={styles.materialSearchResults}>
              {filteredItems.length ? (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    style={styles.materialSearchItem}
                    onClick={() => addMaterialFromItem(item)}
                  >
                    {item.name}
                  </button>
                ))
              ) : (
                <div style={styles.materialSearchEmpty}>該当なし</div>
              )}
            </div>
          ) : null}
        </div>

        {!materials.length ? (
          <div style={styles.mutedText}>素材なし</div>
        ) : (
          <div style={styles.materialTableWrap}>
            <div style={styles.materialTableHead}>
              <div style={styles.materialCellName}>素材</div>
              <div style={styles.materialCellCount}>個数</div>
              <div style={styles.materialCellAction}>操作</div>
            </div>

            <div style={styles.materialTableBody}>
              {materials.map((mat, index) => (
                <div key={index} style={styles.materialTableRow}>
                  <div style={styles.materialCellName}>
                    <input
                      style={styles.inputCompact}
                      value={getDisplayMaterialName(mat)}
                      onChange={(e) =>
                        onUpdateMaterial(index, "name", e.target.value)
                      }
                      placeholder="素材名"
                    />
                  </div>

                  <div style={styles.materialCellCount}>
                  <input
                    type="number"
                    style={styles.inputCompactXs}
                    value={mat?.count ?? 1}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) =>
                      onUpdateMaterial(index, "count", event.target.value)
                    }
                  />
                </div>

                  <div style={styles.materialCellAction}>
                    <button
                      type="button"
                      style={dangerButtonStyle()}
                      onClick={() => onDeleteMaterial(index)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div style={styles.sectionTitle}>効果</div>
          <button
            type="button"
            style={secondaryButtonStyle()}
            onClick={onAddEffect}
          >
            効果追加
          </button>
        </div>

        <div style={styles.stackSmall}>
          {effects.length ? (
            effects.map((effect, i) => (
              <div key={i} style={styles.materialRow}>
                <div style={styles.materialNameWrap}>
                  <input
                    value={
                      typeof effect === "string"
                        ? effect
                        : JSON.stringify(effect)
                    }
                    onChange={(e) => onUpdateEffect(i, e.target.value)}
                    placeholder="効果"
                    style={styles.input}
                  />
                </div>

                <button
                  type="button"
                  style={dangerButtonStyle()}
                  onClick={() => onDeleteEffect(i)}
                >
                  削除
                </button>
              </div>
            ))
          ) : (
            <div style={styles.mutedText}>効果なし</div>
          )}
        </div>
      </section>
    </div>
  );
}

const styles = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
  },

  stackSmall: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },

  card: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: 14,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
  },

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-title)",
  },

  materialSearchBox: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  materialSearchResults: {
    border: "1px solid var(--soft-border)",
    background: "var(--soft-bg)",
    borderRadius: 10,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  materialSearchItem: {
    border: "1px solid var(--soft-border)",
    background: "var(--card-bg)",
    color: "var(--text-main)",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    textAlign: "left",
  },

  materialSearchEmpty: {
    color: "var(--text-muted)",
    fontSize: 13,
  },

  input: {
    boxSizing: "border-box",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "10px 12px",
    width: "100%",
  },

  inputCompact: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "10px 12px",
  },

  inputCompactWide: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "10px 12px",
  },

  inputCompactXs: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "10px 12px",
  },

  mutedText: {
    color: "var(--text-muted)",
    fontSize: 13,
  },

  materialTableWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  materialTableHead: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 90px 100px",
    gap: 8,
    alignItems: "center",
    color: "var(--text-muted)",
    fontSize: 12,
    fontWeight: 700,
  },

  materialTableBody: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  materialTableRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 90px 100px",
    gap: 8,
    alignItems: "center",
    minWidth: 0,
  },

  materialCellName: {
    minWidth: 0,
  },

  materialCellCount: {
    minWidth: 0,
  },

  materialCellAction: {
    minWidth: 0,
  },

  materialRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  materialNameWrap: {
    flex: 1,
    minWidth: 0,
  },
};

const secondaryButtonStyle = () => ({
  border: "1px solid var(--soft-border)",
  background: "var(--soft-bg)",
  color: "var(--text-main)",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
});

const dangerButtonStyle = () => ({
  border: "1px solid var(--danger-border)",
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  borderRadius: 10,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 700,
});