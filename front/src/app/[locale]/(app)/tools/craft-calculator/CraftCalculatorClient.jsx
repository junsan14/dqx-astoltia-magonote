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
  getBoardSummary,
  getRegenTargets,
  getClothEvent,
  applySewingResult,
  isClothEffectTurn,
  getNextClothTurn,
  advancePowerState,
  getEquipmentTolerance,
} from "./craftOptimizer";

// A pointer's default caret placement can undo selection made during focus.
// Re-select after click and after the browser finishes the current event/frame.
function selectInputValue(event) {
  const input = event.currentTarget;
  if (input.readOnly) return;
  input.select();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.select();
    });
  }
}

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
  const [history, setHistory] = useState([]);
  const [resultError, setResultError] = useState("");
  const [equipmentOpen, setEquipmentOpen] = useState(true);

  const [currentPower, setCurrentPower] = useState("unknown");
  const [nextPower, setNextPower] = useState("unknown");
  const [powerQueue, setPowerQueue] = useState([]);
  const [mentalPower, setMentalPower] = useState(252);
  const [turnCount, setTurnCount] = useState(1);
  const [clothType, setClothType] = useState("regen");
  const [clothEvents, setClothEvents] = useState({});
  const [heldPower, setHeldPower] = useState("");
  const [focusTurns, setFocusTurns] = useState(0);
  const [bastingCells, setBastingCells] = useState({});
  const [tolerance, setTolerance] = useState(0);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [previewCandidate, setPreviewCandidate] = useState(null);

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
  const currentTurnEvent = getClothEvent(clothType, turnCount, clothEvents);
  const boardSummary = getBoardSummary(grid, values, tolerance);
  const regenTargets = getRegenTargets(grid, values);
  const regenNeedsInput = clothType === "regen" && isClothEffectTurn(turnCount) && !clothEvents[String(turnCount)] && regenTargets.length > 0;
  const pinkNeedsInput = clothType === "pink" && isClothEffectTurn(turnCount) && !currentTurnEvent?.cellKeys?.length;

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
      heldPower,
      powerQueue,
      bastingCells,
      tolerance,
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
    heldPower,
    powerQueue,
    bastingCells,
    tolerance,
  ]);

  useEffect(() => {
    setPreviewCandidate(globalCandidates[0] ?? null);
  }, [globalCandidates]);

  useEffect(() => {
    if (!craftTypes.length) return;

    const exists = craftTypes.some((type) => type.key === activeCraftType);

    if (!exists) {
      setActiveCraftType(craftTypes[0].key);
    }
  }, [craftTypes, activeCraftType]);

  useEffect(() => {
    if (!selectedId) return;

    const existsInFiltered = validEquipments.some(
      (equipment) => String(equipment.id) === selectedId
    );

    if (existsInFiltered) return;

    setSelectedId("");
    setValues({});
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setPowerModalOpen(false);
  }, [validEquipments, selectedId]);

  function rememberAction(label) {
    setHistory((prev) => [...prev.slice(-49), {
      label, values: { ...values }, currentPower, nextPower, mentalPower,
      turnCount, clothType, clothEvents, focusTurns, bastingCells, tolerance, powerQueue, heldPower,
    }]);
  }

  function undoAction() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setValues(previous.values);
    setCurrentPower(previous.currentPower);
    setNextPower(previous.nextPower);
    setPowerQueue(previous.powerQueue ?? []);
    setMentalPower(previous.mentalPower);
    setTurnCount(previous.turnCount);
    setClothType(previous.clothType);
    setClothEvents(previous.clothEvents);
    setFocusTurns(previous.focusTurns);
    setHeldPower(previous.heldPower ?? "");
    setBastingCells(previous.bastingCells);
    setTolerance(previous.tolerance);
    setHistory((prev) => prev.slice(0, -1));
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setPowerModalOpen(false);
    setClothEffectModalOpen(false);
    setActionCurrentValues({});
    setRegenCurrentValues({});
    setResultError("");
  }

  function handleCraftTypeChange(craftTypeKey) {
    setHistory([]);
    setActiveCraftType(craftTypeKey);
    setSearchWord("");
    setSelectedId("");
    setValues({});
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setPowerModalOpen(false);
  }

  function handleEquipmentSelect(equipment) {
    setHistory([]);
    setMentalPower(252);
    const nextGrid = normalizeSlotGrid(equipment.slotGridJson);

    setTolerance(getEquipmentTolerance(equipment));
    setEquipmentOpen(false);
    setSelectedId(String(equipment.id));
    setValues(createInitialValues(nextGrid));
    setTurnCount(1);
    setClothEvents({});
    setFocusTurns(0);
    setHeldPower("");
    setBastingCells({});
    setCurrentPower("unknown");
    setNextPower("unknown");
    setPowerQueue([]);
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setPowerModalMode("initial");
    setModalCurrentPower("weak");
    setModalNextPower("unknown");
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
    setHistory([]);
    setMentalPower(252);
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
    setHeldPower("");
    setBastingCells({});
    setCurrentPower("unknown");
    setNextPower("unknown");
    setPowerQueue([]);
    setSelectedCandidate(null);
    setPreviewCandidate(null);
    setPowerModalMode("initial");
    setModalCurrentPower("weak");
    setModalNextPower("unknown");
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
    return clothType !== "rainbow" && isClothEffectTurn(nextTurn);
  }

  function openManualPowerModal() {
    setPowerModalMode("initial");
    setModalCurrentPower(currentPower === "unknown" ? "weak" : currentPower);
    setModalNextPower(nextPower || "unknown");
    setPowerModalOpen(true);
  }

  function openAfterActionPowerModal(forceUnknown = false) {
    const advanced = advancePowerState({ currentPower, nextPower, focusTurns, powerQueue, heldPower }, forceUnknown);
    setFocusTurns(advanced.focusTurns);
    setHeldPower(advanced.heldPower ?? "");
    setPowerQueue(advanced.powerQueue);
    if (advanced.focusTurns > 0 && !forceUnknown) {
      advanceTurnWithResolvedPower(advanced.currentPower, advanced.nextPower);
      return;
    }
    // Commit the next turn only once, after the power has been confirmed.
    setPowerModalMode(advanced.currentPower === "unknown" ? "afterUnknown" : "afterKnown");
    setModalCurrentPower(advanced.currentPower);
    setModalNextPower(advanced.nextPower);
    setPowerModalOpen(true);
  }

  function advanceTurnWithResolvedPower(resolvedCurrentPower, resolvedNextPower) {
    setCurrentPower(resolvedCurrentPower);
    setNextPower(resolvedNextPower);

    const nextTurn = Number(turnCount || 1) + 1;
    setTurnCount(nextTurn);
    if (shouldOpenClothEffectModal(nextTurn)) {
      setRegenCurrentValues({});
      setClothEffectModalOpen(true);
    }
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

  function selectCandidatePreview(candidate) {
    setPreviewCandidate(candidate);
  }

  function openCandidateModal(candidate = previewCandidate) {
    if (!candidate) return;

    const initialValues = {};
    if (candidate.skillKey === "randomSew") {
      grid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell && Number.isFinite(cell.target)) {
          initialValues[getCellKey(r, c)] = getCurrentNumber(values[getCellKey(r, c)]);
        }
      }));
    } else {
      candidate.affectedPreview.forEach((item) => {
        initialValues[item.cellKey] = item.current;
      });
    }
    setResultError("");

    setPreviewCandidate(candidate);
    setActionCurrentValues(initialValues);
    setSelectedCandidate(candidate);
  }

  function applyCandidateResult() {
    if (!selectedCandidate) return;

    let applied;
    try {
      applied = applySewingResult({ values, bastingCells, candidate: selectedCandidate, results: actionCurrentValues });
    } catch (error) {
      setResultError(error.message);
      return;
    }
    rememberAction(getCandidateTitle(selectedCandidate));
    setResultError("");
    setValues(applied.values);
    setBastingCells(applied.bastingCells);

    setMentalPower((prev) =>
      Math.max(
        0,
        Number(prev || 0) - Number(selectedCandidate.effectiveCost || 0)
      )
    );

    if (selectedCandidate.skillKey === "focus") {
      setFocusTurns(3);
      setHeldPower(currentPower);
      // Keep the next underlying power for when the fixed power expires.
      setSelectedCandidate(null);
      setPreviewCandidate(null);

      const nextTurn = Number(turnCount || 1) + 1;
      setTurnCount(nextTurn);
      if (shouldOpenClothEffectModal(nextTurn)) {
        setRegenCurrentValues({});
        setClothEffectModalOpen(true);
      }

      return;
    }

    setSelectedCandidate(null);
    setPreviewCandidate(null);
    openAfterActionPowerModal(selectedCandidate.skillKey === "powerShift");
  }

  function openRegenModal() {
    setResultError("");
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
    if (Object.values(regenCurrentValues).some(value => String(value).trim() === "" || !Number.isSafeInteger(Number(value)) || Number(value) < 0)) {
      setResultError("再生後の現在値は0以上の整数で入力してください。");
      return;
    }
    setResultError("");
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
          <small>{candidate.strategy}</small>
          <small>{candidate.reason}</small>
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
      <div className={styles.guideBar}>
        <span className={styles.strategyBadge}>基本方針</span>
        <p>序盤は手順を準備 <span aria-hidden="true">→</span> パワーと布効果を活用 <span aria-hidden="true">→</span> 許容誤差へ調整</p>
      </div>
      <details className={`${styles.panel} ${styles.equipmentPanel}`} open={equipmentOpen}
        onToggle={(event) => setEquipmentOpen(event.currentTarget.open)}>
        <summary className={styles.equipmentSummary}>
          <span><small>縫う装備</small><strong>{selectedEquipment?.itemName ?? "装備を選んではじめる"}</strong></span>
          <span className={styles.equipmentSummaryMeta}>{CLOTH_TYPES.find((cloth) => cloth.key === clothType)?.label} · 装備を変更</span>
        </summary>
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
          <input onFocus={selectInputValue} onClick={selectInputValue}
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
      </details>


      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionLabel}>Target Grid</p>
            <h2>{selectedEquipment?.itemName ?? "裁縫盤面"}</h2>
          </div>

          <button type="button" onClick={fillZero} className={styles.subButton}>
            盤面を0にする
          </button>
        </div>

        {!selectedEquipment ? (
          <div className={styles.emptySelectionBox}>
            <h3>装備を選択してください</h3>
            <p>
              上の検索から縫いたい装備を選ぶと、数値グリッドと次の一手が表示されます。
            </p>
          </div>
        ) : (
          <div className={styles.workbenchGrid}>
            <div className={styles.gridColumnPanel}>
      <section className={styles.stickyPowerPanel} aria-label="ぬいパワー">
        <span className={styles.smallTurn}>ターン {turnCount}</span>
        <div className={styles.powerTrack} aria-live="polite">
          <div key={`current-${turnCount}`} className={`${styles.powerToken} ${styles.currentPowerToken}`} data-power={currentPower}>
            <span>現在</span><strong>{POWER_LABELS[currentPower]}</strong>
            {currentPower === "unknown" && <select aria-label="現在のぬいパワーを入力" value="unknown" onChange={e => { setCurrentPower(e.target.value); setPreviewCandidate(null); }}>
              <option value="unknown">ゲームを見て選択</option>{POWER_ORDER.map(p => <option key={p} value={p}>{POWER_LABELS[p]}</option>)}
            </select>}
          </div>
          <span className={styles.powerArrow} aria-hidden="true">←</span>
          <div className={styles.powerToken} data-power={focusTurns > 1 ? heldPower || currentPower : nextPower}>
            <span>つぎ</span>{focusTurns > 1 && <strong>{POWER_LABELS[heldPower || currentPower]}</strong>}
            {focusTurns <= 1 && <select aria-label="次のぬいパワー" value={nextPower} onChange={e => { setNextPower(e.target.value); setPreviewCandidate(null); }}>
              {[...POWER_ORDER, "unknown"].map(p => <option key={p} value={p}>{POWER_LABELS[p]}</option>)}
            </select>}
          </div>
          <div className={styles.powerUpcoming}>
            <span>{focusTurns > 0 ? `精神統一 あと${focusTurns}回` : "そのあと"}</span>
            <div>{(focusTurns > 1 ? [...Array(Math.max(0, focusTurns - 2)).fill(heldPower || currentPower), nextPower, ...powerQueue] : powerQueue).slice(0, 4).map((p, i) => <span key={i} data-power={p}>{POWER_LABELS[p]}</span>)}</div>
          </div>
        </div>
      </section>

            <aside className={styles.candidateColumnPanel}>
              <div className={styles.globalCandidateBox}>

                <div className={styles.globalCandidateHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Best Actions</p>
                    <h3>次の一手</h3>
                  </div>
                  <div className={styles.actionMental}>
            <label htmlFor="mental-power">残り集中力</label>
            <input onFocus={selectInputValue} onClick={selectInputValue} id="mental-power" type="number" min="0" step="1"
              className={styles.mentalInput} value={mentalPower}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isSafeInteger(value) && value >= 0) {
                  setMentalPower(value);
                  setPreviewCandidate(null);
                }
              }} />

                  </div>
                </div>

                {regenNeedsInput ? (
                  <div><p>再生後の数値を確認すると次の候補を計算します。</p><button type="button" className={styles.primaryButton} onClick={openRegenModal}>再生結果を入力</button></div>
                ) : boardSummary.withinTolerance ? (
                  <p className={styles.completedMessage} role="status">完成 · 大成功圏内（合計誤差 {boardSummary.totalError} / 許容 {tolerance}）</p>
                ) : pinkNeedsInput ? (
                  <div><p>光っているマスを指定すると候補を計算します。</p><button type="button" className={styles.primaryButton} onClick={() => setClothEffectModalOpen(true)}>光るマスを指定</button></div>
                ) : currentPower === "unknown" ? (
                  <p className={styles.noResult}>
                    盤面の上で、ゲームに表示された現在のぬいパワーを選んでください。
                  </p>
                ) : globalCandidates.length === 0 ? (
                  <p className={styles.noResult} role="status">
                    {summary.perfectCount === summary.cellCount
                      ? "すべてのマスが目標値ぴったりです。ゲーム内で仕上がりを確認してください。"
                      : boardSummary.totalError <= tolerance + 6
                        ? `最低目標内です（合計誤差${boardSummary.totalError} / 目標${tolerance + 6}以下）。改善できる手が見つからないため、ここで仕上げる判断をおすすめします。`
                        : `最低目標の合計誤差${tolerance + 6}以下へ進める手が見つかりません。集中力・現在値・ぬいパワーを確認してください。`}
                  </p>
                ) : (
                  <>
                    <div className={styles.quickAction}>
                      <div><strong>{getCandidateTitle(previewCandidate ?? globalCandidates[0])}</strong>
                        {(previewCandidate ?? globalCandidates[0]).finishingPlan && <small style={{display:"block",fontSize:".65rem"}}>{(previewCandidate ?? globalCandidates[0]).finishingPlan.assessment} · 最低目標 誤差{tolerance + 6}以下</small>}
                      </div>
                      <button type="button" className={styles.primaryButton} onClick={() => openCandidateModal(previewCandidate ?? globalCandidates[0])}>ゲームで縫った結果を入力</button>
                    </div>
                  </>
                )}

              </div>
            </aside>
              <h3 className={styles.boardItemName}>{selectedEquipment?.itemName}</h3>
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
                          className={`${styles.cell} ${status.className} ${cell.target === currentNumber ? styles.completedCell : ""} ${
                            isClothCell ? styles.clothActiveCell : ""
                          } ${isPreviewAffected ? styles.previewAffectedCell : ""}`}
                        >
                          <input onFocus={selectInputValue} onClick={selectInputValue}
                            id={`cell-${key}`}
                            aria-label={`${getCellName(rowIndex, colIndex)}の現在値（目標${cell.target}${bastingCells[key] ? "、しつけ済み" : ""}）`}
                            title={`目標 ${cell.target}${bastingCells[key] ? " · しつけ済み" : ""}`}
                            type="text" inputMode="numeric" pattern="[0-9]*"
                            value={values[key] ?? ""}
                            onChange={(e) => { if (/^\d*$/.test(e.target.value)) handleValueChange(key, e.target.value); }}
                            className={styles.input}
                          />
                          <span className={styles.remainingValue} aria-label={`誤差${cell.target - currentNumber}`}>
                            誤差 {cell.target - currentNumber}
                          </span>
                          {cell.target === currentNumber && <span className={styles.completedOverlay} aria-hidden="true">誤差 0</span>}

                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <details className={styles.workbenchDetails}>
                <summary>候補の理由・他の手・詳細設定</summary>
                <button type="button" className={styles.subButton} onClick={openManualPowerModal}>ぬいパワーを修正</button>
                <div className={styles.moreCandidateList}>
                  {globalCandidates.map((candidate, index) => renderCandidateButton(candidate, index, true))}
                </div>
        <details className={styles.powerQueueEditor}>
          <summary>ぬいパワーの順番を登録（残り{powerQueue.length}手）</summary>
          <p>「つぎ」の後に続く順番を、ゲームの表示に合わせて追加します。精神統一中は順番を保持します。</p>
          <div>{[...POWER_ORDER, "unknown"].map(p => <button type="button" key={p} className={styles.subButton} onClick={() => setPowerQueue(q => [...q, p])}>＋{POWER_LABELS[p]}</button>)}</div>
          <p>{powerQueue.map(p => POWER_LABELS[p]).join(" → ") || "未登録"}</p>
          <button type="button" className={styles.subButton} disabled={!powerQueue.length} onClick={() => setPowerQueue(q => q.slice(0, -1))}>末尾を削除</button>
        </details>
              <div className={styles.planningStatus} aria-live="polite">
                <strong>合計誤差 {boardSummary.totalError}</strong>
                <label>許容誤差 <input onFocus={selectInputValue} onClick={selectInputValue} type="number" min="0" max="20" value={tolerance}
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 20) setTolerance(n); }} /></label>
                <small>装備ごとの基準を確認してください。不明な部位は0から設定できます。</small>
              </div>
              {clothType === "regen" && regenTargets.length > 0 && (
                <p className={styles.calculationNote}>今の盤面で再生する候補：{regenTargets.map(c => c.name).join(" / ")}。次の行動や会心で対象は変わります。</p>
              )}
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

              </details>


            </div>


          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className={styles.panel}>
          <h2>操作履歴</h2>
          <ol className={styles.actionHistory}>
            {history.map((entry, index) => (
              <li key={index}>{entry.turnCount}ターン目：{entry.label}（実行前の集中力 {entry.mentalPower}）</li>
            ))}
          </ol>
          <button type="button" onClick={undoAction} className={styles.subButton}>最後の一手を取り消す</button>
        </section>
      )}
      <details className={`${styles.panel} ${styles.referencePanel}`}>
        <summary>特技の効果と消費集中力</summary>

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
      </details>

      <details className={`${styles.panel} ${styles.referencePanel}`}>
        <summary>ぬいパワー別の数値表</summary>

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
      </details>

      {powerModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.smallModal} role="dialog" aria-modal="true" aria-label="ぬいパワーの設定">
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

              {powerModalMode === "initial" && currentPower !== "unknown" && (
                <button
                  type="button"
                  onClick={() => setPowerModalOpen(false)}
                  aria-label="閉じる"
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

            {!(focusTurns > 0 && powerModalMode === "afterUnknown") && <div className={styles.initialPowerBlock}>
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
            </div>}

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={applyPowerModal}
                disabled={modalCurrentPower === "unknown"}
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
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="ゲームの結果を入力">
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
                aria-label="閉じる"
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
                対象マスにしつけがけを行ってください。反映すると、次にそのマスを縫うまで効果を保持し、数値の計算に反映します。
              </p>
            ) : (
              <>
                <p className={styles.modalLead}>
                  縫った後の数値を入力してください。
                </p>

                <div
                  className={styles.resultGrid}
                  style={{
                    gridTemplateColumns: `repeat(${maxCols}, minmax(64px, 1fr))`,
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

                      const editable = isAffectedCell(cellKey);
                      const current = getCurrentNumber(values[cellKey]);

                      return (
                        <label
                          key={cellKey}
                          className={`${styles.resultGridCell} ${
                            editable
                              ? styles.resultGridEditable
                              : styles.resultGridReadonly
                          }`}
                        >
                          <input onFocus={selectInputValue} onClick={selectInputValue}
                            aria-label={`${getCellName(rowIndex, colIndex)}の縫った後の数値`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
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

            {resultError && <p role="alert" className={styles.resultError}>{resultError}</p>}
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
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label="ゲームの結果を入力">
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.sectionLabel}>Cloth Effect</p>
                <h2>{turnCount}ターン目の布効果</h2>
                {resultError && <p role="alert" className={styles.resultError}>{resultError}</p>}
              </div>

              <button
                type="button"
                onClick={() => setClothEffectModalOpen(false)}
                aria-label="閉じる"
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
                    gridTemplateColumns: `repeat(${maxCols}, minmax(64px, 1fr))`,
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

                          <input onFocus={selectInputValue} onClick={selectInputValue}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
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
                    gridTemplateColumns: `repeat(${maxCols}, minmax(64px, 1fr))`,
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
