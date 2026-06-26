// ===== CraftCalculatorClient.jsx =====
"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./craft-calculator.module.css";

import {
  CLOTH_TYPES,
  POWER_LABELS,
  POWER_ORDER,
  POWER_TABLES,
  SKILL_LIST,
  getGlobalOptimizedCandidates,
  getPowerRangeLabel,
} from "./craftOptimizer";

const DEFAULT_CRAFT_TYPE = {
  key: "sewing",
  name: "さいほう職人",
};

function safeJsonParse(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getValue(obj, camelKey, snakeKey) {
  return obj?.[camelKey] ?? obj?.[snakeKey] ?? null;
}

function normalizeEquipment(equipment) {
  const craftType = equipment.craftType ?? equipment.craft_type ?? null;

  const craftTypeKey =
    equipment.craftTypeKey ??
    equipment.craft_type_key ??
    equipment.craft_key ??
    craftType?.key ??
    DEFAULT_CRAFT_TYPE.key;

  const craftTypeName =
    equipment.craftTypeName ??
    equipment.craft_type_name ??
    equipment.craft_name ??
    craftType?.name ??
    DEFAULT_CRAFT_TYPE.name;

  return {
    ...equipment,
    id: equipment.id,
    itemId: getValue(equipment, "itemId", "item_id"),
    itemName:
      getValue(equipment, "itemName", "item_name") ??
      equipment.name ??
      "名称未設定",
    itemNameEn: getValue(equipment, "itemNameEn", "item_name_en"),
    groupId: getValue(equipment, "groupId", "group_id"),
    groupName: getValue(equipment, "groupName", "group_name"),
    groupKind: getValue(equipment, "groupKind", "group_kind"),
    equipLevel: getValue(equipment, "equipLevel", "equip_level"),
    craftLevel: getValue(equipment, "craftLevel", "craft_level"),
    defaultPrice: getValue(equipment, "defaultPrice", "default_price"),
    slotGridJson: getValue(equipment, "slotGridJson", "slot_grid_json"),
    clothType: getValue(equipment, "clothType", "cloth_type"),
    craftTypeKey,
    craftTypeName,
  };
}

function normalizeCell(cell) {
  if (cell === null || cell === undefined || cell === "") return null;

  if (typeof cell === "number") {
    return { target: cell, label: "" };
  }

  if (typeof cell === "string") {
    const number = Number(cell);

    return {
      target: Number.isNaN(number) ? null : number,
      label: "",
    };
  }

  if (typeof cell === "object") {
    const target =
      cell.target ??
      cell.value ??
      cell.num ??
      cell.number ??
      cell.required ??
      cell.requiredValue ??
      cell.score ??
      null;

    return {
      target: target === null || target === "" ? null : Number(target),
      label: cell.label ?? cell.name ?? cell.title ?? "",
    };
  }

  return null;
}

function normalizeSlotGrid(slotGridJson) {
  const parsed = safeJsonParse(slotGridJson, null);

  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    return parsed.map((row) => {
      if (Array.isArray(row)) return row.map((cell) => normalizeCell(cell));
      return [normalizeCell(row)];
    });
  }

  if (Array.isArray(parsed.rows)) {
    return parsed.rows.map((row) => {
      if (Array.isArray(row)) return row.map((cell) => normalizeCell(cell));
      return [normalizeCell(row)];
    });
  }

  if (Array.isArray(parsed.grid)) {
    return parsed.grid.map((row) => {
      if (Array.isArray(row)) return row.map((cell) => normalizeCell(cell));
      return [normalizeCell(row)];
    });
  }

  if (Array.isArray(parsed.cells)) {
    const cols = Number(parsed.cols ?? parsed.columns ?? 3) || 3;
    const rows = [];

    parsed.cells.forEach((cell, index) => {
      const rowIndex = Math.floor(index / cols);
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex].push(normalizeCell(cell));
    });

    return rows;
  }

  return [];
}

function createInitialValues(grid) {
  const values = {};

  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell || cell.target === null || Number.isNaN(cell.target)) return;
      values[`${rowIndex}-${colIndex}`] = "";
    });
  });

  return values;
}

function getCellStatus(target, currentValue) {
  if (
    currentValue === "" ||
    currentValue === null ||
    currentValue === undefined
  ) {
    return {
      diff: null,
      label: "未入力",
      className: styles.empty,
    };
  }

  const current = Number(currentValue);

  if (Number.isNaN(current)) {
    return {
      diff: null,
      label: "数値エラー",
      className: styles.over,
    };
  }

  const diff = Number(target) - current;

  if (diff === 0) {
    return {
      diff,
      label: "ぴったり",
      className: styles.perfect,
    };
  }

  if (diff > 0) {
    return {
      diff,
      label: `あと ${diff}`,
      className: styles.short,
    };
  }

  return {
    diff,
    label: `${Math.abs(diff)} オーバー`,
    className: styles.over,
  };
}

function getMaxCols(grid) {
  if (!Array.isArray(grid) || grid.length === 0) return 1;
  return Math.max(...grid.map((row) => row.length || 1));
}

function getCurrentNumber(value) {
  if (value === "" || value === null || value === undefined) return 0;

  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function getCellName(rowIndex, colIndex) {
  const rowNames = ["上", "中", "下", "4段目", "5段目"];
  const colNames = ["左", "中", "右", "4列目", "5列目"];

  return `${rowNames[rowIndex] ?? `${rowIndex + 1}段目`}${
    colNames[colIndex] ?? `${colIndex + 1}列目`
  }`;
}

function isClothEffectTurn(turnCount) {
  const current = Number(turnCount || 1);
  // 素材特性は4ターン経過後なので、最初は5ターン目。
  return current >= 5 && (current - 1) % 4 === 0;
}

function getNextClothTurn(turnCount) {
  const current = Number(turnCount || 1);
  if (isClothEffectTurn(current)) return current;

  const passed = Math.max(0, current - 1);
  return 1 + Math.ceil((passed + 1) / 4) * 4;
}

function getCellKey(rowIndex, colIndex) {
  return `${rowIndex}-${colIndex}`;
}

export default function CraftCalculatorClient({
  equipments = [],
  craftTypes: propCraftTypes = [],
}) {
  const normalizedEquipments = useMemo(() => {
    return equipments.map((equipment) => normalizeEquipment(equipment));
  }, [equipments]);

  const validEquipments = useMemo(() => {
    return normalizedEquipments.filter((equipment) => {
      const grid = normalizeSlotGrid(equipment.slotGridJson);
      return grid.length > 0;
    });
  }, [normalizedEquipments]);

  const craftTypes = useMemo(() => {
    const map = new Map();

    propCraftTypes.forEach((craftType) => {
      const key = craftType.key ?? craftType.craft_type_key;
      const name = craftType.name ?? craftType.craft_type_name;

      if (!key) return;

      map.set(key, {
        key,
        name: name || key,
      });
    });

    validEquipments.forEach((equipment) => {
      if (!equipment.craftTypeKey) return;

      map.set(equipment.craftTypeKey, {
        key: equipment.craftTypeKey,
        name: equipment.craftTypeName || equipment.craftTypeKey,
      });
    });

    if (map.size === 0) {
      map.set(DEFAULT_CRAFT_TYPE.key, DEFAULT_CRAFT_TYPE);
    }

    return Array.from(map.values());
  }, [propCraftTypes, validEquipments]);

  const [activeCraftType, setActiveCraftType] = useState(
    craftTypes[0]?.key ?? DEFAULT_CRAFT_TYPE.key
  );

  const [searchWord, setSearchWord] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState({});

  const [currentPower, setCurrentPower] = useState("unknown");
  const [nextPower, setNextPower] = useState("unknown");
  const [mentalPower, setMentalPower] = useState(252);
  const [turnCount, setTurnCount] = useState(1);
  const [clothType, setClothType] = useState("regen");
  const [clothEvents, setClothEvents] = useState({});
  const [focusTurns, setFocusTurns] = useState(0);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [previewCandidate, setPreviewCandidate] = useState(null);
  const [showMoreCandidates, setShowMoreCandidates] = useState(false);

  const [powerModalOpen, setPowerModalOpen] = useState(false);
  const [powerModalMode, setPowerModalMode] = useState("initial");
  const [modalCurrentPower, setModalCurrentPower] = useState("weak");
  const [modalNextPower, setModalNextPower] = useState("unknown");

  const [clothEffectModalOpen, setClothEffectModalOpen] = useState(false);
  const [actionCurrentValues, setActionCurrentValues] = useState({});
  const [regenCurrentValues, setRegenCurrentValues] = useState({});

  const filteredEquipments = useMemo(() => {
    const keyword = searchWord.trim().toLowerCase();

    return validEquipments.filter((equipment) => {
      if (equipment.craftTypeKey !== activeCraftType) return false;

      if (!keyword) return true;

      const targetText = [
        equipment.itemName,
        equipment.itemNameEn,
        equipment.itemId,
        equipment.groupName,
        equipment.groupKind,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [validEquipments, activeCraftType, searchWord]);

  const selectedEquipment = useMemo(() => {
    return validEquipments.find((item) => String(item.id) === selectedId);
  }, [validEquipments, selectedId]);

  const grid = useMemo(() => {
    return normalizeSlotGrid(selectedEquipment?.slotGridJson);
  }, [selectedEquipment]);

  const maxCols = useMemo(() => getMaxCols(grid), [grid]);
  const currentTurnEvent = clothEvents[String(turnCount)] ?? null;

  const summary = useMemo(() => {
    let totalTarget = 0;
    let totalCurrent = 0;
    let perfectCount = 0;
    let overCount = 0;
    let inputCount = 0;
    let cellCount = 0;

    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell || cell.target === null || Number.isNaN(cell.target)) return;

        cellCount += 1;
        totalTarget += Number(cell.target);

        const key = `${rowIndex}-${colIndex}`;
        const currentValue = values[key];

        if (
          currentValue === "" ||
          currentValue === null ||
          currentValue === undefined
        ) {
          return;
        }

        const current = Number(currentValue);
        if (Number.isNaN(current)) return;

        inputCount += 1;
        totalCurrent += current;

        const diff = Number(cell.target) - current;

        if (diff === 0) perfectCount += 1;
        if (diff < 0) overCount += 1;
      });
    });

    return {
      totalTarget,
      totalCurrent,
      totalDiff: totalTarget - totalCurrent,
      perfectCount,
      overCount,
      inputCount,
      cellCount,
    };
  }, [grid, values]);

  const globalCandidates = useMemo(() => {
    return getGlobalOptimizedCandidates({
      grid,
      values,
      currentPower,
      nextPower,
      mentalPower,
      turnCount,
      clothType,
      clothEvents,
      focusTurns,
      limit: 5,
    });
  }, [
    grid,
    values,
    currentPower,
    nextPower,
    mentalPower,
    turnCount,
    clothType,
    clothEvents,
    focusTurns,
  ]);

  useEffect(() => {
    if (!craftTypes.length) return;

    const exists = craftTypes.some((type) => type.key === activeCraftType);

    if (!exists) {
      setActiveCraftType(craftTypes[0].key);
    }
  }, [craftTypes, activeCraftType]);

  useEffect(() => {
    if (!selectedId) return;

    const existsInFiltered = filteredEquipments.some(
      (equipment) => String(equipment.id) === selectedId
    );

    if (existsInFiltered) return;

    setSelectedId("");
    setValues({});
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setShowMoreCandidates(false);
    setPowerModalOpen(false);
  }, [filteredEquipments, selectedId]);

  function handleCraftTypeChange(craftTypeKey) {
    setActiveCraftType(craftTypeKey);
    setSearchWord("");
    setSelectedId("");
    setValues({});
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setShowMoreCandidates(false);
    setPowerModalOpen(false);
  }

  function handleEquipmentSelect(equipment) {
    const nextGrid = normalizeSlotGrid(equipment.slotGridJson);

    setSelectedId(String(equipment.id));
    setValues(createInitialValues(nextGrid));
    setTurnCount(1);
    setClothEvents({});
    setFocusTurns(0);
    setCurrentPower("unknown");
    setNextPower("unknown");
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setPowerModalMode("initial");
    setModalCurrentPower("weak");
    setModalNextPower("unknown");
    setShowMoreCandidates(false);
    setPowerModalOpen(true);
    setClothEffectModalOpen(false);

    if (equipment.clothType) {
      setClothType(equipment.clothType);
    }
  }

  function handleValueChange(key, value) {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPreviewCandidate(null);
  }

  function resetValues() {
    if (!selectedEquipment) {
      setValues({});
      setSelectedCandidate(null);
      setPreviewCandidate(null);
      setPowerModalOpen(false);
      return;
    }

    setValues(createInitialValues(grid));
    setTurnCount(1);
    setClothEvents({});
    setFocusTurns(0);
    setCurrentPower("unknown");
    setNextPower("unknown");
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setPowerModalMode("initial");
    setModalCurrentPower("weak");
    setModalNextPower("unknown");
    setShowMoreCandidates(false);
    setPowerModalOpen(true);
    setClothEffectModalOpen(false);
    setActionCurrentValues({});
    setRegenCurrentValues({});
  }

  function fillZero() {
    const next = {};

    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell || cell.target === null || Number.isNaN(cell.target)) return;
        next[`${rowIndex}-${colIndex}`] = "0";
      });
    });

    setValues(next);
  }

  function handleClothTypeChange(nextType) {
    setClothType(nextType);
    setClothEvents({});
    setRegenCurrentValues({});
    setClothEffectModalOpen(false);
  }

  function shouldOpenClothEffectModal(nextTurn) {
    return clothType && Number(nextTurn) > 0 && Number(nextTurn) % 4 === 0;
  }

  function openManualPowerModal() {
    setPowerModalMode("initial");
    setModalCurrentPower(currentPower === "unknown" ? "weak" : currentPower);
    setModalNextPower(nextPower || "unknown");
    setPowerModalOpen(true);
  }

  function openAfterActionPowerModal() {
    if (focusTurns > 0) {
      advanceFocusTurn();
      return;
    }

    if (nextPower === "unknown") {
      setPowerModalMode("afterUnknown");
      setModalCurrentPower("weak");
      setModalNextPower("unknown");
      setPowerModalOpen(true);
      return;
    }

    setPowerModalMode("afterKnown");
    setModalCurrentPower(nextPower);
    setModalNextPower("unknown");
    setPowerModalOpen(true);
  }

  function advanceTurnWithResolvedPower(resolvedCurrentPower, resolvedNextPower) {
    setCurrentPower(resolvedCurrentPower);
    setNextPower(resolvedNextPower);

    setTurnCount((prev) => {
      const nextTurn = Number(prev || 1) + 1;

      if (shouldOpenClothEffectModal(nextTurn)) {
        setTimeout(() => setClothEffectModalOpen(true), 0);
      }

      return nextTurn;
    });
  }

  function applyPowerModal() {
    if (powerModalMode === "initial") {
      setCurrentPower(modalCurrentPower);
      setNextPower(modalNextPower);
      setPowerModalOpen(false);
      return;
    }

    if (powerModalMode === "afterUnknown") {
      advanceTurnWithResolvedPower(modalCurrentPower, modalNextPower);
      setPowerModalOpen(false);
      return;
    }

    if (powerModalMode === "afterKnown") {
      advanceTurnWithResolvedPower(modalCurrentPower, modalNextPower);
      setPowerModalOpen(false);
    }
  }

  function advanceFocusTurn() {
    setCurrentPower(currentPower);
    setNextPower(currentPower);
    setFocusTurns((prev) => Math.max(0, Number(prev || 0) - 1));

    setTurnCount((prev) => {
      const nextTurn = Number(prev || 1) + 1;

      if (shouldOpenClothEffectModal(nextTurn)) {
        setTimeout(() => setClothEffectModalOpen(true), 0);
      }

      return nextTurn;
    });
  }

  function selectCandidatePreview(candidate) {
    setPreviewCandidate(candidate);
  }

  function openCandidateModal(candidate = previewCandidate) {
    if (!candidate) return;

    const initialValues = {};

    candidate.affectedPreview.forEach((item) => {
      // 候補選択時に想定値を勝手に入れない。実際に縫った後の現在値を入力する。
      initialValues[item.cellKey] = item.current;
    });

    setPreviewCandidate(candidate);
    setActionCurrentValues(initialValues);
    setSelectedCandidate(candidate);
  }

  function applyCandidateResult() {
    if (!selectedCandidate) return;

    if (selectedCandidate.skillKey !== "focus") {
      setValues((prev) => {
        const next = { ...prev };

        selectedCandidate.affectedPreview.forEach((item) => {
          const nextCurrent = Number(
            actionCurrentValues[item.cellKey] ?? item.current
          );
          next[item.cellKey] = String(Math.max(0, nextCurrent));
        });

        return next;
      });
    }

    setMentalPower((prev) =>
      Math.max(
        0,
        Number(prev || 0) - Number(selectedCandidate.effectiveCost || 0)
      )
    );

    if (selectedCandidate.skillKey === "focus") {
      setFocusTurns(3);
      setNextPower(currentPower);
      setSelectedCandidate(null);
      setPreviewCandidate(null);

      setTurnCount((prev) => {
        const nextTurn = Number(prev || 1) + 1;

        if (shouldOpenClothEffectModal(nextTurn)) {
          setTimeout(() => setClothEffectModalOpen(true), 0);
        }

        return nextTurn;
      });

      return;
    }

    if (selectedCandidate.skillKey === "powerShift") {
      setNextPower("unknown");
    }

    setSelectedCandidate(null);
    setPreviewCandidate(null);
    openAfterActionPowerModal();
  }

  function openRegenModal() {
    const initialValues = {};

    grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell || cell.target === null || Number.isNaN(cell.target)) return;

        const cellKey = getCellKey(rowIndex, colIndex);
        initialValues[cellKey] = getCurrentNumber(values[cellKey]);
      });
    });

    setRegenCurrentValues(initialValues);
    setClothEffectModalOpen(true);
  }

  function applyRegenResult() {
    const eventKey = String(turnCount);

    setValues((prev) => {
      const next = { ...prev };

      Object.entries(regenCurrentValues).forEach(([cellKey, currentValue]) => {
        const nextCurrent = Number(currentValue);
        if (Number.isNaN(nextCurrent)) return;

        next[cellKey] = String(Math.max(0, nextCurrent));
      });

      return next;
    });

    const changedCellKeys = Object.entries(regenCurrentValues)
      .filter(([cellKey, currentValue]) => {
        const before = getCurrentNumber(values[cellKey]);
        const after = Number(currentValue);

        return !Number.isNaN(after) && before !== after;
      })
      .map(([cellKey]) => cellKey);

    setClothEvents((prev) => ({
      ...prev,
      [eventKey]: {
        clothType,
        cellKeys: changedCellKeys,
        rainbowMode: prev[eventKey]?.rainbowMode ?? "halfCost",
      },
    }));

    setRegenCurrentValues({});
    setClothEffectModalOpen(false);
  }

  function applyPinkCell(cellKey) {
    const eventKey = String(turnCount);

    setClothEvents((prev) => ({
      ...prev,
      [eventKey]: {
        clothType,
        cellKeys: [cellKey],
        rainbowMode: prev[eventKey]?.rainbowMode ?? "halfCost",
      },
    }));

    setClothEffectModalOpen(false);
  }

  function applyRainbowMode(rainbowMode) {
    const eventKey = String(turnCount);

    setClothEvents((prev) => ({
      ...prev,
      [eventKey]: {
        clothType,
        cellKeys: [],
        rainbowMode,
      },
    }));

    setClothEffectModalOpen(false);
  }

  function isCurrentTurnClothCell(rowIndex, colIndex) {
    const cellKey = getCellKey(rowIndex, colIndex);
    return currentTurnEvent?.cellKeys?.includes(cellKey);
  }

  function getActiveCandidate() {
    return selectedCandidate ?? previewCandidate;
  }

  function isAffectedCell(cellKey) {
    const candidate = getActiveCandidate();

    if (!candidate) return false;

    if (candidate.skillKey === "randomSew") return true;

    return candidate.affectedPreview.some((item) => item.cellKey === cellKey);
  }

  function getAffectedPreview(cellKey) {
    const candidate = getActiveCandidate();

    if (!candidate) return null;

    return (
      candidate.affectedPreview.find((item) => item.cellKey === cellKey) ?? null
    );
  }

  function getCandidateTitle(candidate) {
    if (!candidate) return "";

    if (
      candidate.skillKey === "focus" ||
      candidate.skillKey === "randomSew" ||
      candidate.skillKey === "powerShift"
    ) {
      return candidate.label;
    }

    return `${candidate.cellName} に ${candidate.label}`;
  }

  function renderCandidateButton(candidate, index, compact = false) {
    const isActivePreview = previewCandidate?.key === candidate.key;

    return (
      <button
        key={`${candidate.key}-${index}`}
        type="button"
        onClick={() => selectCandidatePreview(candidate)}
        className={`${styles.globalCandidate} ${
          compact ? styles.compactGlobalCandidate : ""
        } ${isActivePreview ? styles.activeGlobalCandidate : ""} ${
          candidate.skillKey === "randomSew" ? styles.randomCandidate : ""
        }`}
      >
        <span className={styles.globalRank}>{index + 1}</span>

        <span className={styles.globalMain}>
          <strong>{getCandidateTitle(candidate)}</strong>
          <small>{candidate.riskText}</small>
        </span>

        <em>
          {candidate.actionSummary} / 集中{candidate.effectiveCost}
        </em>
      </button>
    );
  }

  if (validEquipments.length === 0) {
    return (
      <section className={styles.emptyState}>
        <h2>slot_grid_json がある装備が見つかりませんでした</h2>
        <p>
          API側で <code>slot_grid_json</code>{" "}
          が入っている装備を返しているか確認してください。
        </p>
      </section>
    );
  }

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionLabel}>Craft Type</p>
            <h2>職人・装備を選択</h2>
          </div>

          <button type="button" onClick={resetValues} className={styles.subButton}>
            入力リセット
          </button>
        </div>

        <div className={styles.tabs}>
          {craftTypes.map((craftType) => (
            <button
              key={craftType.key}
              type="button"
              onClick={() => handleCraftTypeChange(craftType.key)}
              className={`${styles.tabButton} ${
                activeCraftType === craftType.key ? styles.activeTab : ""
              }`}
            >
              {craftType.name}
            </button>
          ))}
        </div>

        <div className={styles.searchBox}>
          <label htmlFor="equipment-search">装備検索</label>
          <input
            id="equipment-search"
            type="search"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            placeholder="装備名・グループ名で検索"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.searchResult}>
          {filteredEquipments.length === 0 ? (
            <p className={styles.noResult}>該当する装備がありません。</p>
          ) : (
            filteredEquipments.slice(0, 40).map((equipment) => (
              <button
                key={equipment.id}
                type="button"
                onClick={() => handleEquipmentSelect(equipment)}
                className={`${styles.equipmentButton} ${
                  String(equipment.id) === selectedId
                    ? styles.activeEquipment
                    : ""
                }`}
              >
                <span>{equipment.itemName}</span>
                <small>
                  Lv {equipment.equipLevel || "-"} / 職人Lv{" "}
                  {equipment.craftLevel || "-"}
                </small>
              </button>
            ))
          )}
        </div>

        <div className={styles.compactClothArea}>
          <div className={styles.compactClothHeader}>
            <span>布の種類</span>
            <strong>
              {CLOTH_TYPES.find((cloth) => cloth.key === clothType)?.label}
            </strong>
          </div>

          <div className={styles.compactClothTabs}>
            {CLOTH_TYPES.map((cloth) => (
              <button
                key={cloth.key}
                type="button"
                onClick={() => handleClothTypeChange(cloth.key)}
                className={`${styles.miniTabButton} ${
                  clothType === cloth.key ? styles.activeMiniTab : ""
                }`}
              >
                {cloth.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.stickyPowerPanel}`}>
        <div className={styles.statusHeaderCompact}>
          <div>
            <p className={styles.sectionLabel}>Sewing Status</p>
            <h2>
              現在状況
              {focusTurns > 0 ? ` / 精神統一中 残り${focusTurns}` : ""}
            </h2>
          </div>

          <div className={styles.statusActions}>
            <button
              type="button"
              onClick={openManualPowerModal}
              className={styles.subButton}
            >
              ぬいパワーを設定
            </button>

            {clothType === "regen" && isClothEffectTurn(turnCount) && (
              <button
                type="button"
                onClick={openRegenModal}
                className={styles.subButton}
              >
                再生結果を入力
              </button>
            )}

            {clothType !== "regen" && isClothEffectTurn(turnCount) && (
              <button
                type="button"
                onClick={() => setClothEffectModalOpen(true)}
                className={styles.subButton}
              >
                布効果を設定
              </button>
            )}
          </div>
        </div>

        <div className={styles.powerDisplayGrid}>
          <div className={styles.powerDisplayItem}>
            <span>現在</span>
            <strong>{POWER_LABELS[currentPower]}</strong>
          </div>

          <div className={styles.powerDisplayItem}>
            <span>次</span>
            <strong>{POWER_LABELS[nextPower]}</strong>
          </div>

          <div className={styles.powerDisplayItem}>
            <span>精神力</span>
            <strong>{mentalPower}</strong>
          </div>

          <div className={styles.powerDisplayItem}>
            <span>ターン</span>
            <strong>{turnCount}</strong>
          </div>

          <div className={styles.powerDisplayItem}>
            <span>布効果</span>
            <strong>
              {isClothEffectTurn(turnCount)
                ? "効果ターン"
                : `${getNextClothTurn(turnCount)}T`}
            </strong>
          </div>

          {focusTurns > 0 && (
            <div className={styles.powerDisplayItem}>
              <span>精神統一</span>
              <strong>残り{focusTurns}</strong>
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionLabel}>Target Grid</p>
            <h2>大成功数値チェック</h2>
          </div>

          <button type="button" onClick={fillZero} className={styles.subButton}>
            0を入力
          </button>
        </div>

        {!selectedEquipment ? (
          <div className={styles.emptySelectionBox}>
            <h3>装備を選択してください</h3>
            <p>
              最初は装備を自動選択しないようにしました。上の検索から縫いたい装備を選ぶと、数値グリッドとおすすめ候補が表示されます。
            </p>
          </div>
        ) : (
          <div className={styles.workbenchGrid}>
            <div className={styles.gridColumnPanel}>
              <div className={styles.summaryGrid}>
                <div>
                  <span>目標合計</span>
                  <strong>{summary.totalTarget}</strong>
                </div>

                <div>
                  <span>現在合計</span>
                  <strong>{summary.totalCurrent}</strong>
                </div>

                <div>
                  <span>残り合計</span>
                  <strong>{summary.totalDiff}</strong>
                </div>

                <div>
                  <span>ぴったり</span>
                  <strong>
                    {summary.perfectCount} / {summary.cellCount}
                  </strong>
                </div>
              </div>

              <div className={styles.gridWrap}>
                <div
                  className={styles.craftGrid}
                  style={{
                    gridTemplateColumns: `repeat(${maxCols}, minmax(72px, 1fr))`,
                  }}
                >
                  {grid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const key = getCellKey(rowIndex, colIndex);

                      if (!cell || cell.target === null || Number.isNaN(cell.target)) {
                        return <div key={key} className={styles.disabledCell} />;
                      }

                      const currentValue = values[key];
                      const currentNumber = getCurrentNumber(currentValue);
                      const status = getCellStatus(cell.target, currentValue);
                      const isClothCell = isCurrentTurnClothCell(rowIndex, colIndex);
                      const isPreviewAffected = isAffectedCell(key);
                      return (
                        <div
                          key={key}
                          className={`${styles.cell} ${status.className} ${
                            isClothCell ? styles.clothActiveCell : ""
                          } ${isPreviewAffected ? styles.previewAffectedCell : ""}`}
                        >
                          <div className={styles.cellTop}>
                            <span>{getCellName(rowIndex, colIndex)}</span>
                            <strong>{cell.target}</strong>
                          </div>

                          <input
                            type="number"
                            inputMode="numeric"
                            value={values[key] ?? ""}
                            onChange={(e) => handleValueChange(key, e.target.value)}
                            placeholder="現在"
                            className={styles.input}
                          />

                          <p className={styles.status}>
                            {currentNumber} / {status.label}
                          </p>

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <aside className={styles.candidateColumnPanel}>
              <div className={styles.globalCandidateBox}>
                <div className={styles.globalCandidateHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Best Actions</p>
                    <h3>全体おすすめTOP1</h3>
                  </div>
                </div>

                {currentPower === "unknown" ? (
                  <p className={styles.noResult}>
                    まず「ぬいパワーを設定」から現在と次のぬいパワーを設定してください。
                  </p>
                ) : globalCandidates.length === 0 ? (
                  <p className={styles.noResult}>候補なし</p>
                ) : (
                  <>
                    <div className={styles.globalCandidateList}>
                      {renderCandidateButton(globalCandidates[0], 0)}
                    </div>

                    {globalCandidates.length > 1 && (
                      <details
                        className={styles.moreCandidateDetails}
                        open={showMoreCandidates}
                        onToggle={(e) => setShowMoreCandidates(e.currentTarget.open)}
                      >
                        <summary>他の候補を見る</summary>

                        <div className={styles.moreCandidateList}>
                          {globalCandidates
                            .slice(1, 5)
                            .map((candidate, index) =>
                              renderCandidateButton(candidate, index + 1, true)
                            )}
                        </div>
                      </details>
                    )}

                    <div className={styles.selectedCandidateActionBox}>
                      {previewCandidate ? (
                        <>
                          <p>
                            選択中：
                            <strong>
                              {getCandidateTitle(previewCandidate)}
                            </strong>
                          </p>

                          <button
                            type="button"
                            onClick={() => openCandidateModal(previewCandidate)}
                            className={styles.primaryButton}
                          >
                            結果を入力して反映
                          </button>
                        </>
                      ) : (
                        <p>候補をクリックすると、左の数値グリッドで縫うマスが光ります。</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionLabel}>Skill List</p>
            <h2>裁縫特技</h2>
          </div>
        </div>

        <div className={styles.skillTableWrap}>
          <table className={styles.skillTable}>
            <thead>
              <tr>
                <th>特技</th>
                <th>消費</th>
                <th>効果</th>
              </tr>
            </thead>

            <tbody>
              {SKILL_LIST.map((skill) => (
                <tr key={skill.key}>
                  <td>{skill.label}</td>
                  <td>{skill.cost ?? "??"}</td>
                  <td>{skill.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionLabel}>Sewing Numbers</p>
            <h2>裁縫の基礎数値</h2>
          </div>
        </div>

        <div className={styles.numberTables}>
          {Object.entries(POWER_TABLES)
            .filter(([, table]) => {
              return (
                Array.isArray(table.weak) ||
                Array.isArray(table.normal) ||
                Array.isArray(table.strong) ||
                Array.isArray(table.super)
              );
            })
            .map(([tableKey, table]) => (
              <div key={tableKey} className={styles.numberCard}>
                <h3>{table.label}</h3>

                <p className={styles.numberEffect}>
                  消費：{table.cost ?? "??"} / {table.effect}
                </p>

                {POWER_ORDER.map((powerKey) => (
                  <div key={powerKey} className={styles.numberRow}>
                    <span>{POWER_LABELS[powerKey]}</span>
                    <p>{getPowerRangeLabel(tableKey, powerKey)}</p>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </section>

      {powerModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.smallModal}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.sectionLabel}>Sewing Power</p>
                <h2>
                  {powerModalMode === "initial"
                    ? "ぬいパワーを設定"
                    : powerModalMode === "afterUnknown"
                      ? "現在と次のぬいパワーを設定"
                      : "次のぬいパワーを設定"}
                </h2>
              </div>

              {currentPower !== "unknown" && (
                <button
                  type="button"
                  onClick={() => setPowerModalOpen(false)}
                  className={styles.modalClose}
                >
                  ×
                </button>
              )}
            </div>

            {powerModalMode === "afterKnown" && (
              <p className={styles.modalLead}>
                今のターンは「{POWER_LABELS[modalCurrentPower]}」として進みます。
              </p>
            )}

            {(powerModalMode === "initial" ||
              powerModalMode === "afterUnknown") && (
              <div className={styles.initialPowerBlock}>
                <h3>今のターン</h3>

                <div className={styles.powerSelectList}>
                  {POWER_ORDER.map((powerKey) => (
                    <button
                      key={powerKey}
                      type="button"
                      onClick={() => setModalCurrentPower(powerKey)}
                      className={`${styles.powerSelectButton} ${
                        modalCurrentPower === powerKey ? styles.activePower : ""
                      }`}
                    >
                      {POWER_LABELS[powerKey]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.initialPowerBlock}>
              <h3>次のターン</h3>

              <div className={styles.powerSelectList}>
                {[...POWER_ORDER, "unknown"].map((powerKey) => (
                  <button
                    key={powerKey}
                    type="button"
                    onClick={() => setModalNextPower(powerKey)}
                    className={`${styles.powerSelectButton} ${
                      modalNextPower === powerKey ? styles.activePower : ""
                    }`}
                  >
                    {POWER_LABELS[powerKey]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={applyPowerModal}
                className={styles.primaryButton}
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCandidate && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.sectionLabel}>Action Result</p>
                <h2>
                  {getCandidateTitle(selectedCandidate)}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className={styles.modalClose}
              >
                ×
              </button>
            </div>

            {selectedCandidate.skillKey === "focus" ? (
              <p className={styles.modalLead}>
                現在のぬいパワー「{POWER_LABELS[currentPower]}」を次の3ターン固定します。
              </p>
            ) : selectedCandidate.skillKey === "powerShift" ? (
              <p className={styles.modalLead}>
                ぬいパワーシフトを実行します。反映後、次ターンのぬいパワーを入力してください。
              </p>
            ) : selectedCandidate.skillKey === "basting" ? (
              <p className={styles.modalLead}>
                しつけがけを実行します。対象マスを左のグリッドで確認し、反映してください。
              </p>
            ) : (
              <>
                <p className={styles.modalLead}>
                  縫った後の現在値を入力してください。対象マスだけ編集できます。
                  乱れぬいの場合は、実際に縫われたマスだけ修正してください。
                </p>

                <div
                  className={styles.resultGrid}
                  style={{
                    gridTemplateColumns: `repeat(${maxCols}, minmax(88px, 1fr))`,
                  }}
                >
                  {grid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const cellKey = getCellKey(rowIndex, colIndex);

                      if (
                        !cell ||
                        cell.target === null ||
                        Number.isNaN(cell.target)
                      ) {
                        return (
                          <div
                            key={cellKey}
                            className={`${styles.resultGridCell} ${styles.resultGridDisabled}`}
                          />
                        );
                      }

                      const affected = getAffectedPreview(cellKey);
                      const editable = isAffectedCell(cellKey);
                      const current = getCurrentNumber(values[cellKey]);
                      const status = getCellStatus(cell.target, values[cellKey]);

                      return (
                        <label
                          key={cellKey}
                          className={`${styles.resultGridCell} ${
                            editable
                              ? styles.resultGridEditable
                              : styles.resultGridReadonly
                          }`}
                        >
                          <span className={styles.resultCellName}>
                            {getCellName(rowIndex, colIndex)}
                          </span>

                          <strong className={styles.resultCellTarget}>
                            目標 {cell.target}
                          </strong>

                          <small>
                            現在 {current} / {status.label}
                          </small>

                          {affected ? (
                            <small>対象マス。縫った後の現在値を入力</small>
                          ) : (
                            <small>影響なし</small>
                          )}

                          <input
                            type="number"
                            inputMode="numeric"
                            value={
                              editable
                                ? actionCurrentValues[cellKey] ?? current
                                : current
                            }
                            readOnly={!editable}
                            onChange={(e) =>
                              setActionCurrentValues((prev) => ({
                                ...prev,
                                [cellKey]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className={styles.subButton}
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={applyCandidateResult}
                className={styles.primaryButton}
              >
                反映する
              </button>
            </div>
          </div>
        </div>
      )}

      {clothEffectModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.sectionLabel}>Cloth Effect</p>
                <h2>{turnCount}ターン目の布効果</h2>
              </div>

              <button
                type="button"
                onClick={() => setClothEffectModalOpen(false)}
                className={styles.modalClose}
              >
                ×
              </button>
            </div>

            {clothType === "regen" && (
              <>
                <p className={styles.modalLead}>
                  再生後の現在値を入力してください。減った量ではなく、回復後の最終的な現在値です。
                </p>

                <div
                  className={styles.resultGrid}
                  style={{
                    gridTemplateColumns: `repeat(${maxCols}, minmax(88px, 1fr))`,
                  }}
                >
                  {grid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const cellKey = getCellKey(rowIndex, colIndex);

                      if (
                        !cell ||
                        cell.target === null ||
                        Number.isNaN(cell.target)
                      ) {
                        return (
                          <div
                            key={cellKey}
                            className={`${styles.resultGridCell} ${styles.resultGridDisabled}`}
                          />
                        );
                      }

                      const current = getCurrentNumber(values[cellKey]);

                      return (
                        <label
                          key={cellKey}
                          className={`${styles.resultGridCell} ${styles.resultGridEditable}`}
                        >
                          <span className={styles.resultCellName}>
                            {getCellName(rowIndex, colIndex)}
                          </span>
                          <strong className={styles.resultCellTarget}>
                            目標 {cell.target}
                          </strong>
                          <small>再生前 {current}</small>

                          <input
                            type="number"
                            inputMode="numeric"
                            value={regenCurrentValues[cellKey] ?? current}
                            onChange={(e) =>
                              setRegenCurrentValues((prev) => ({
                                ...prev,
                                [cellKey]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      );
                    })
                  )}
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setClothEffectModalOpen(false)}
                    className={styles.subButton}
                  >
                    あとで
                  </button>

                  <button
                    type="button"
                    onClick={applyRegenResult}
                    className={styles.primaryButton}
                  >
                    再生結果を反映
                  </button>
                </div>
              </>
            )}

            {clothType === "pink" && (
              <>
                <p className={styles.modalLead}>
                  威力2倍＆会心率アップになったマスを選択してください。
                </p>

                <div
                  className={styles.resultGrid}
                  style={{
                    gridTemplateColumns: `repeat(${maxCols}, minmax(88px, 1fr))`,
                  }}
                >
                  {grid.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const cellKey = getCellKey(rowIndex, colIndex);

                      if (
                        !cell ||
                        cell.target === null ||
                        Number.isNaN(cell.target)
                      ) {
                        return (
                          <div
                            key={cellKey}
                            className={`${styles.resultGridCell} ${styles.resultGridDisabled}`}
                          />
                        );
                      }

                      return (
                        <button
                          key={cellKey}
                          type="button"
                          onClick={() => applyPinkCell(cellKey)}
                          className={`${styles.resultGridCell} ${styles.resultGridEditable}`}
                        >
                          <span className={styles.resultCellName}>
                            {getCellName(rowIndex, colIndex)}
                          </span>
                          <strong className={styles.resultCellTarget}>
                            目標 {cell.target}
                          </strong>
                          <small>現在 {getCurrentNumber(values[cellKey])}</small>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {clothType === "rainbow" && (
              <>
                <p className={styles.modalLead}>
                  このターンの虹布効果を選択してください。
                </p>

                <div className={styles.powerSelectList}>
                  <button
                    type="button"
                    onClick={() => applyRainbowMode("halfCost")}
                    className={styles.powerSelectButton}
                  >
                    消費集中半分
                  </button>

                  <button
                    type="button"
                    onClick={() => applyRainbowMode("critical")}
                    className={styles.powerSelectButton}
                  >
                    消費集中1.5倍・会心率7倍
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
