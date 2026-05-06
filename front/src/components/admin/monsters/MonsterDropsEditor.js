"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchItems } from "@/lib/items";
import { fetchAccessories } from "@/lib/accessories";
import { fetchOrbs } from "@/lib/orbs";
import { fetchEquipments } from "@/lib/equipments";

const TAB_ITEMS = "items";
const TAB_ORBS = "orbs";
const TAB_EQUIPMENTS = "equipments";

const NORMAL_ITEM_CATEGORIES = [
  { value: "scout", label: "スカウトの書" },
  { value: "consumable", label: "消費アイテム" },
  { value: "material", label: "素材" },
];

const RARE_ITEM_CATEGORIES = [
  { value: "scout", label: "スカウトの書" },
  { value: "consumable", label: "消費アイテム" },
  { value: "recipe", label: "レシピ" },
  { value: "material", label: "素材" },
  { value: "accessory", label: "アクセサリー" },
];

const ORB_CATEGORIES = [
  { value: "炎", label: "炎" },
  { value: "水", label: "水" },
  { value: "風", label: "風" },
  { value: "光", label: "光" },
  { value: "闇", label: "闇" },
];

const EQUIPMENT_CATEGORIES = [
  { value: "片手剣", label: "片手剣" },
  { value: "両手剣", label: "両手剣" },
  { value: "短剣", label: "短剣" },
  { value: "スティック", label: "スティック" },
  { value: "両手杖", label: "両手杖" },
  { value: "ヤリ", label: "ヤリ" },
  { value: "オノ", label: "オノ" },
  { value: "棍", label: "棍" },
  { value: "ツメ", label: "ツメ" },
  { value: "ムチ", label: "ムチ" },
  { value: "扇", label: "扇" },
  { value: "ハンマー", label: "ハンマー" },
  { value: "ブーメラン", label: "ブーメラン" },
  { value: "弓", label: "弓" },
  { value: "鎌", label: "鎌" },
  { value: "盾", label: "盾" },
  { value: "頭", label: "頭" },
  { value: "体上", label: "体上" },
  { value: "体下", label: "体下" },
  { value: "腕", label: "腕" },
  { value: "足", label: "足" },
];

function getDropKey(drop) {
  return drop.__key ?? drop.id;
}

function normalizeItemCategory(value = "") {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "scout") return "scout";
  if (v === "consumable") return "consumable";
  if (v === "material") return "material";
  return v;
}

function normalizeOptions(rows = [], type) {
  if (type === "item") {
    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      rawCategory: row.category ?? "",
      category: normalizeItemCategory(row.category),
    }));
  }

  if (type === "orb") {
    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      rawCategory: row.color ?? "",
      category: row.color ?? "",
    }));
  }

  if (type === "equipment") {
    return rows.map((row) => ({
      id: row.id,
      name: row.itemName ?? row.item_name ?? row.name ?? "",
      rawCategory: row.slot ?? "",
      category: row.slot ?? "",
    }));
  }

  if (type === "accessory") {
    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? row.item_name ?? "",
      category: "accessory",
      rawCategory: row.accessory_type ?? row.slot ?? "accessory",
    }));
  }

  return [];
}

function makeDrop({
  targetType,
  targetId,
  targetName,
  dropType,
  itemFilterCategory = "",
}) {
  return {
    id: null,
    __key: `new-drop-${Date.now()}-${Math.random()}`,
    drop_target_type: targetType,
    drop_target_id: targetId,
    drop_type: dropType,
    sort_order: 1,
    target_name: targetName,
    item_filter_category: itemFilterCategory,
  };
}

function filterByQuery(options, query) {
  const q = String(query ?? "").trim().toLowerCase();

  if (!q) {
    return options.slice(0, 100);
  }

  return options
    .filter((row) => String(row.name ?? "").toLowerCase().includes(q))
    .slice(0, 100);
}

function toItemApiCategory(category) {
  if (category === "scout") return "scout";
  if (category === "consumable") return "consumable";
  if (category === "material") return "material";
  return "";
}

function SuggestInput({
  label = "名前",
  query,
  onQueryChange,
  suggestions = [],
  selected = null,
  onSelect,
  placeholder = "名前で検索",
  loading = false,
  styles,
}) {
  return (
    <div style={styles.addComposer}>
      <label style={styles.field}>
        <span style={styles.label}>{label}</span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="monster-drops-editor-input"
          style={styles.input}
        />
      </label>

      <div style={styles.suggestBox}>
        {loading ? (
          <div style={styles.emptySuggest}>読み込み中...</div>
        ) : query.trim() === "" ? (
          <div style={styles.emptySuggest}>文字を入力</div>
        ) : suggestions.length === 0 ? (
          <div style={styles.emptySuggest}>候補なし</div>
        ) : (
          <div
            className="monster-drops-editor-suggest-list"
            style={styles.suggestList}
          >
            {suggestions.map((option) => {
              const isActive =
                selected &&
                String(selected.id) === String(option.id) &&
                String(selected.source_type ?? "") ===
                  String(option.source_type ?? "");

              return (
                <button
                  key={`${option.source_type ?? "default"}-${option.id}`}
                  type="button"
                  onClick={() => onSelect(option)}
                  className="monster-drops-editor-suggest-item"
                  style={{
                    ...styles.suggestItem,
                    ...(isActive ? styles.suggestItemActive : {}),
                  }}
                >
                  <span style={styles.suggestName}>{option.name}</span>
                  {option.rawCategory || option.category ? (
                    <span style={styles.suggestMeta}>
                      {option.rawCategory ?? option.category}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MonsterDropsEditor({ drops = [], onChange }) {
  const styles = useMemo(() => getComponentStyles(), []);
  const [activeTab, setActiveTab] = useState(TAB_ITEMS);

  const [normalCategory, setNormalCategory] = useState("scout");
  const [normalQuery, setNormalQuery] = useState("");
  const [normalSelected, setNormalSelected] = useState(null);

  const [rareCategory, setRareCategory] = useState("scout");
  const [rareQuery, setRareQuery] = useState("");
  const [rareSelected, setRareSelected] = useState(null);

  const [orbCategory, setOrbCategory] = useState("炎");
  const [orbQuery, setOrbQuery] = useState("");
  const [orbSelected, setOrbSelected] = useState(null);

  const [equipmentCategory, setEquipmentCategory] = useState("片手剣");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentSelected, setEquipmentSelected] = useState(null);

  const [normalItemOptions, setNormalItemOptions] = useState([]);
  const [rareItemOptions, setRareItemOptions] = useState([]);
  const [orbOptions, setOrbOptions] = useState([]);
  const [equipmentOptions, setEquipmentOptions] = useState([]);

  const [loadingNormalItems, setLoadingNormalItems] = useState(false);
  const [loadingRareItems, setLoadingRareItems] = useState(false);
  const [loadingOrbs, setLoadingOrbs] = useState(false);
  const [loadingEquipments, setLoadingEquipments] = useState(false);

  const normalItems = drops.filter(
    (drop) => drop?.drop_target_type === "item" && drop?.drop_type === "normal"
  );

  const rareItems = drops.filter(
    (drop) =>
      (drop?.drop_target_type === "item" ||
        drop?.drop_target_type === "accessory") &&
      drop?.drop_type === "rare"
  );

  const orbDrops = drops.filter((drop) => drop?.drop_target_type === "orb");
  const equipmentDrops = drops.filter(
    (drop) => drop?.drop_target_type === "equipment"
  );

  function rebuildSortOrder(nextDrops) {
    return nextDrops.map((drop, index) => ({
      ...drop,
      sort_order: index + 1,
    }));
  }

  function setNextDrops(nextDrops) {
    onChange(rebuildSortOrder(nextDrops));
  }

  function removeDrop(dropKey) {
    setNextDrops(drops.filter((drop) => getDropKey(drop) !== dropKey));
  }

  function addDrop(newDrop) {
    setNextDrops([...drops, newDrop]);
  }

  useEffect(() => {
    let ignore = false;

    async function loadNormalItems() {
      try {
        setLoadingNormalItems(true);
        const rows = await fetchItems("", toItemApiCategory(normalCategory));
        if (!ignore) setNormalItemOptions(normalizeOptions(rows, "item"));
      } catch (error) {
        console.error(error);
        if (!ignore) setNormalItemOptions([]);
      } finally {
        if (!ignore) setLoadingNormalItems(false);
      }
    }

    loadNormalItems();

    return () => {
      ignore = true;
    };
  }, [normalCategory]);

  useEffect(() => {
    let ignore = false;

    async function loadRareItems() {
      try {
        setLoadingRareItems(true);

        if (rareCategory === "accessory") {
          const rows = await fetchAccessories("");
          if (!ignore) {
            setRareItemOptions(
              normalizeOptions(rows, "accessory").map((row) => ({
                ...row,
                source_type: "accessory",
              }))
            );
          }
          return;
        }

        const rows = await fetchItems("", toItemApiCategory(rareCategory));
        if (!ignore) {
          setRareItemOptions(
            normalizeOptions(rows, "item").map((row) => ({
              ...row,
              source_type: "item",
            }))
          );
        }
      } catch (error) {
        console.error(error);
        if (!ignore) setRareItemOptions([]);
      } finally {
        if (!ignore) setLoadingRareItems(false);
      }
    }

    loadRareItems();

    return () => {
      ignore = true;
    };
  }, [rareCategory]);

  useEffect(() => {
    let ignore = false;

    async function loadOrbs() {
      try {
        setLoadingOrbs(true);
        const rows = await fetchOrbs("", orbCategory);
        if (!ignore) setOrbOptions(normalizeOptions(rows, "orb"));
      } catch (error) {
        console.error(error);
        if (!ignore) setOrbOptions([]);
      } finally {
        if (!ignore) setLoadingOrbs(false);
      }
    }

    loadOrbs();

    return () => {
      ignore = true;
    };
  }, [orbCategory]);

  useEffect(() => {
    let ignore = false;

    async function loadEquipments() {
      try {
        setLoadingEquipments(true);
        const rows = await fetchEquipments("", equipmentCategory);
        if (!ignore) setEquipmentOptions(normalizeOptions(rows, "equipment"));
      } catch (error) {
        console.error(error);
        if (!ignore) setEquipmentOptions([]);
      } finally {
        if (!ignore) setLoadingEquipments(false);
      }
    }

    loadEquipments();

    return () => {
      ignore = true;
    };
  }, [equipmentCategory]);

  const normalFilteredOptions = useMemo(
    () => filterByQuery(normalItemOptions, normalQuery),
    [normalItemOptions, normalQuery]
  );

  const rareFilteredOptions = useMemo(
    () => filterByQuery(rareItemOptions, rareQuery),
    [rareItemOptions, rareQuery]
  );

  const orbFilteredOptions = useMemo(
    () => filterByQuery(orbOptions, orbQuery),
    [orbOptions, orbQuery]
  );

  const equipmentFilteredOptions = useMemo(
    () => filterByQuery(equipmentOptions, equipmentQuery),
    [equipmentOptions, equipmentQuery]
  );

  function handleImmediateAddNormal(option) {
    addDrop(
      makeDrop({
        targetType: "item",
        targetId: Number(option.id),
        targetName: option.name,
        dropType: "normal",
        itemFilterCategory: normalCategory,
      })
    );
    setNormalQuery("");
    setNormalSelected(null);
  }

  function handleImmediateAddRare(option) {
    addDrop(
      makeDrop({
        targetType: rareCategory === "accessory" ? "accessory" : "item",
        targetId: Number(option.id),
        targetName: option.name,
        dropType: "rare",
        itemFilterCategory: rareCategory,
      })
    );
    setRareQuery("");
    setRareSelected(null);
  }

  function handleImmediateAddOrb(option) {
    addDrop(
      makeDrop({
        targetType: "orb",
        targetId: Number(option.id),
        targetName: option.name,
        dropType: "orb",
        itemFilterCategory: orbCategory,
      })
    );
    setOrbQuery("");
    setOrbSelected(null);
  }

  function handleImmediateAddEquipment(option) {
    addDrop(
      makeDrop({
        targetType: "equipment",
        targetId: Number(option.id),
        targetName: option.name,
        dropType: "equipment",
        itemFilterCategory: equipmentCategory,
      })
    );
    setEquipmentQuery("");
    setEquipmentSelected(null);
  }

  function renderTagList(sectionDrops) {
    if (sectionDrops.length === 0) {
      return <div style={styles.emptyTags}>未登録</div>;
    }

    return (
      <div className="monster-drops-editor-tag-wrap" style={styles.tagWrap}>
        {sectionDrops.map((drop) => {
          const dropKey = getDropKey(drop);
          return (
            <div
              key={`tag-${dropKey}`}
              className="monster-drops-editor-tag"
              style={styles.tag}
            >
              <span style={styles.tagText}>{drop?.target_name || "未選択"}</span>
              <button
                type="button"
                onClick={() => removeDrop(dropKey)}
                style={styles.tagDelete}
                aria-label="削除"
                title="削除"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderItemsTab() {
    return (
      <div style={styles.panel}>
        <div className="monster-drops-editor-section" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3
              className="monster-drops-editor-section-title"
              style={styles.sectionTitle}
            >
              通常ドロップ
            </h3>
          </div>

          {renderTagList(normalItems)}

          <div
            className="monster-drops-editor-category-row"
            style={styles.categoryRow}
          >
            <label style={styles.field}>
              <span style={styles.label}>種別</span>
              <select
                value={normalCategory}
                onChange={(e) => {
                  setNormalCategory(e.target.value);
                  setNormalQuery("");
                  setNormalSelected(null);
                }}
                className="monster-drops-editor-select"
                style={styles.input}
              >
                {NORMAL_ITEM_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SuggestInput
            label="名前"
            query={normalQuery}
            onQueryChange={(value) => {
              setNormalQuery(value);
              setNormalSelected(null);
            }}
            suggestions={normalFilteredOptions}
            selected={normalSelected}
            loading={loadingNormalItems}
            onSelect={(option) => {
              setNormalSelected(option);
              handleImmediateAddNormal(option);
            }}
            placeholder="名前で検索"
            styles={styles}
          />
        </div>

        <div className="monster-drops-editor-section" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3
              className="monster-drops-editor-section-title"
              style={styles.sectionTitle}
            >
              レアドロップ
            </h3>
          </div>

          {renderTagList(rareItems)}

          <div
            className="monster-drops-editor-category-row"
            style={styles.categoryRow}
          >
            <label style={styles.field}>
              <span style={styles.label}>種別</span>
              <select
                value={rareCategory}
                onChange={(e) => {
                  setRareCategory(e.target.value);
                  setRareQuery("");
                  setRareSelected(null);
                }}
                className="monster-drops-editor-select"
                style={styles.input}
              >
                {RARE_ITEM_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SuggestInput
            label="名前"
            query={rareQuery}
            onQueryChange={(value) => {
              setRareQuery(value);
              setRareSelected(null);
            }}
            suggestions={rareFilteredOptions}
            selected={rareSelected}
            loading={loadingRareItems}
            onSelect={(option) => {
              setRareSelected(option);
              handleImmediateAddRare(option);
            }}
            placeholder="名前で検索"
            styles={styles}
          />
        </div>
      </div>
    );
  }

  function renderOrbsTab() {
    return (
      <div style={styles.panel}>
        <div className="monster-drops-editor-section" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3
              className="monster-drops-editor-section-title"
              style={styles.sectionTitle}
            >
              宝珠
            </h3>
          </div>

          {renderTagList(orbDrops)}

          <div
            className="monster-drops-editor-category-row"
            style={styles.categoryRow}
          >
            <label style={styles.field}>
              <span style={styles.label}>種別</span>
              <select
                value={orbCategory}
                onChange={(e) => {
                  setOrbCategory(e.target.value);
                  setOrbQuery("");
                  setOrbSelected(null);
                }}
                className="monster-drops-editor-select"
                style={styles.input}
              >
                {ORB_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SuggestInput
            label="名前"
            query={orbQuery}
            onQueryChange={(value) => {
              setOrbQuery(value);
              setOrbSelected(null);
            }}
            suggestions={orbFilteredOptions}
            selected={orbSelected}
            loading={loadingOrbs}
            onSelect={(option) => {
              setOrbSelected(option);
              handleImmediateAddOrb(option);
            }}
            placeholder="名前で検索"
            styles={styles}
          />
        </div>
      </div>
    );
  }

  function renderEquipmentsTab() {
    return (
      <div style={styles.panel}>
        <div className="monster-drops-editor-section" style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3
              className="monster-drops-editor-section-title"
              style={styles.sectionTitle}
            >
              装備
            </h3>
          </div>

          {renderTagList(equipmentDrops)}

          <div
            className="monster-drops-editor-category-row"
            style={styles.categoryRow}
          >
            <label style={styles.field}>
              <span style={styles.label}>種別</span>
              <select
                value={equipmentCategory}
                onChange={(e) => {
                  setEquipmentCategory(e.target.value);
                  setEquipmentQuery("");
                  setEquipmentSelected(null);
                }}
                className="monster-drops-editor-select"
                style={styles.input}
              >
                {EQUIPMENT_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SuggestInput
            label="名前"
            query={equipmentQuery}
            onQueryChange={(value) => {
              setEquipmentQuery(value);
              setEquipmentSelected(null);
            }}
            suggestions={equipmentFilteredOptions}
            selected={equipmentSelected}
            loading={loadingEquipments}
            onSelect={(option) => {
              setEquipmentSelected(option);
              handleImmediateAddEquipment(option);
            }}
            placeholder="名前で検索"
            styles={styles}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .monster-drops-editor-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }

        .monster-drops-editor-input::placeholder {
          color: ${styles.placeholderColor};
          opacity: 1;
        }

        .monster-drops-editor-input,
        .monster-drops-editor-select,
        .monster-drops-editor-suggest-item,
        .monster-drops-editor-tab {
          transition:
            background-color 0.18s ease,
            border-color 0.18s ease,
            color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .monster-drops-editor-input:focus,
        .monster-drops-editor-select:focus {
          outline: none;
          border-color: ${styles.focusRingColor};
          box-shadow: 0 0 0 3px ${styles.focusRingShadow};
        }

        .monster-drops-editor-suggest-item:hover {
          background: ${styles.suggestItemHover.background} !important;
        }

        .monster-drops-editor-tab:hover {
          background: ${styles.tabButtonHover.background} !important;
          color: ${styles.tabButtonHover.color} !important;
        }

        @media (max-width: 768px) {
          .monster-drops-editor-title {
            font-size: 18px !important;
          }

          .monster-drops-editor-tab {
            flex: 1 1 calc(50% - 8px);
            justify-content: center;
            text-align: center;
            padding: 10px 12px !important;
          }

          .monster-drops-editor-section {
            padding: 14px !important;
            border-radius: 14px !important;
            gap: 14px !important;
          }

          .monster-drops-editor-section-title {
            font-size: 17px !important;
          }

          .monster-drops-editor-category-row {
            grid-template-columns: 1fr !important;
          }

          .monster-drops-editor-input,
          .monster-drops-editor-select {
            font-size: 16px !important;
          }

          .monster-drops-editor-suggest-list {
            max-height: 220px !important;
          }

          .monster-drops-editor-suggest-item {
            padding: 12px !important;
            flex-direction: column;
            align-items: flex-start !important;
            gap: 4px !important;
          }

          .monster-drops-editor-tag {
            max-width: 100%;
            padding-right: 28px !important;
          }
        }

        @media (max-width: 480px) {
          .monster-drops-editor-tabbar {
            gap: 6px !important;
            padding: 5px !important;
          }

          .monster-drops-editor-tab {
            flex: 1 1 100%;
          }

          .monster-drops-editor-section {
            padding: 12px !important;
          }

          .monster-drops-editor-tag-wrap {
            gap: 8px !important;
          }

          .monster-drops-editor-tag {
            font-size: 12px !important;
            min-height: 36px !important;
          }

          .monster-drops-editor-page-title {
            font-size: 20px !important;
          }
        }
      `}</style>

      <section style={styles.wrapper}>
        <div style={styles.titleRow}>
          <h2
            className="monster-drops-editor-page-title monster-drops-editor-title"
            style={styles.pageTitle}
          >
            ドロップ編集
          </h2>
        </div>

        <div className="monster-drops-editor-tabbar" style={styles.tabBar}>
          <button
            type="button"
            onClick={() => setActiveTab(TAB_ITEMS)}
            className="monster-drops-editor-tab"
            style={{
              ...styles.tabButton,
              ...(activeTab === TAB_ITEMS ? styles.tabButtonActive : {}),
            }}
          >
            アイテム
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(TAB_ORBS)}
            className="monster-drops-editor-tab"
            style={{
              ...styles.tabButton,
              ...(activeTab === TAB_ORBS ? styles.tabButtonActive : {}),
            }}
          >
            宝珠
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(TAB_EQUIPMENTS)}
            className="monster-drops-editor-tab"
            style={{
              ...styles.tabButton,
              ...(activeTab === TAB_EQUIPMENTS ? styles.tabButtonActive : {}),
            }}
          >
            装備
          </button>
        </div>

        <div className="monster-drops-editor-grid">
          {activeTab === TAB_ITEMS && renderItemsTab()}
          {activeTab === TAB_ORBS && renderOrbsTab()}
          {activeTab === TAB_EQUIPMENTS && renderEquipmentsTab()}
        </div>
      </section>
    </>
  );
}

function getComponentStyles() {
  return {
    wrapper: {
      display: "flex",
      flexDirection: "column",
      gap: 18,
      minWidth: 0,
    },
    titleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    pageTitle: {
      margin: 0,
      fontSize: 22,
      fontWeight: 800,
      color: "var(--text-title)",
    },
    tabBar: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      padding: 6,
      borderRadius: 14,
      background: "var(--soft-bg)",
      border: "1px solid var(--soft-border)",
    },
    tabButton: {
      border: "none",
      background: "transparent",
      color: "var(--text-muted)",
      borderRadius: 10,
      padding: "10px 16px",
      fontWeight: 700,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
    },
    tabButtonHover: {
      background: "var(--card-bg)",
      color: "var(--text-main)",
    },
    tabButtonActive: {
      background: "var(--card-bg)",
      color: "var(--text-main)",
      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    },
    panel: {
      display: "flex",
      flexDirection: "column",
      gap: 18,
      minWidth: 0,
    },
    section: {
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 14,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 16,
      minWidth: 0,
    },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    sectionTitle: {
      margin: 0,
      fontSize: 18,
      fontWeight: 800,
      color: "var(--text-title)",
    },
    categoryRow: {
      display: "grid",
      gridTemplateColumns: "minmax(220px, 320px)",
      gap: 12,
    },
    tagWrap: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      minWidth: 0,
    },
    tag: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      maxWidth: "100%",
      padding: "10px 14px 8px",
      borderRadius: 999,
      background: "var(--soft-bg)",
      color: "var(--text-main)",
      fontSize: 13,
      fontWeight: 700,
      border: "1px solid var(--soft-border)",
      minHeight: 40,
    },
    tagText: {
      paddingRight: 10,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    tagDelete: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: "9999px",
      border: "1px solid var(--soft-border)",
      background: "var(--card-bg)",
      color: "var(--danger-text)",
      fontSize: 14,
      fontWeight: 800,
      lineHeight: 1,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    emptyTags: {
      color: "var(--text-muted)",
      fontSize: 14,
    },
    addComposer: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minWidth: 0,
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      minWidth: 0,
    },
    label: {
      fontSize: 13,
      fontWeight: 700,
      color: "var(--text-muted)",
    },
    input: {
      width: "100%",
      padding: "11px 12px",
      borderRadius: 10,
      border: "1px solid var(--input-border)",
      background: "var(--input-bg)",
      fontSize: 14,
      color: "var(--input-text)",
      minWidth: 0,
      boxSizing: "border-box",
    },
    suggestBox: {
      border: "1px solid var(--soft-border)",
      borderRadius: 12,
      background: "var(--soft-bg)",
      overflow: "hidden",
      minWidth: 0,
    },
    emptySuggest: {
      padding: "12px 14px",
      color: "var(--text-muted)",
      fontSize: 14,
    },
    suggestList: {
      display: "flex",
      flexDirection: "column",
      maxHeight: 280,
      overflowY: "auto",
    },
    suggestItem: {
      border: "none",
      background: "var(--card-bg)",
      borderBottom: "1px solid var(--soft-border)",
      padding: "12px 14px",
      textAlign: "left",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      minWidth: 0,
      color: "var(--text-main)",
    },
    suggestItemHover: {
      background: "var(--soft-bg)",
    },
    suggestItemActive: {
      background: "var(--selected-bg)",
    },
    suggestName: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: 0,
    },
    suggestMeta: {
      color: "var(--text-muted)",
      fontSize: 12,
      whiteSpace: "nowrap",
      flexShrink: 0,
    },
    focusRingColor: "var(--selected-border)",
    focusRingShadow: "rgba(148, 163, 184, 0.18)",
    placeholderColor: "var(--input-placeholder)",
  };
}