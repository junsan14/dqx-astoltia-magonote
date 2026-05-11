"use client";

import { useMemo, useState } from "react";
import styles from "./craft-calculator.module.css";

const POWER_TABLES = {
  normal: {
    label: "通常縫い",
    weak: [6, 7, 8, 9],
    normal: [12, 13, 14, 15, 16, 17, 18],
    strong: [18, 20, 21, 23, 24, 26, 27],
    super: [24, 26, 28, 30, 32, 34, 36],
  },
  double: {
    label: "2倍縫い",
    weak: [12, 13, 14, 15, 16, 17, 18],
    normal: [24, 26, 28, 30, 32, 34, 36],
    strong: [36, 39, 42, 45, 48, 51, 54],
    super: [48, 52, 56, 60, 64, 68, 72],
  },
  triple: {
    label: "3倍縫い",
    weak: [18, 20, 21, 23, 24, 26, 27],
    normal: [36, 39, 42, 45, 48, 51, 54],
    strong: [54, 59, 63, 68, 72, 77, 81],
    super: [72, 78, 84, 90, 96, 102, 108],
  },
  adjust: {
    label: "かげん縫い",
    weak: [3, 4, 5],
    normal: [6, 7, 8, 9],
    strong: [9, 11, 12, 14],
    super: [12, 14, 16, 18],
  },
  loosen: {
    label: "糸ほぐし",
    weak: [-3, -4],
    normal: [-6, -7, -8, -9],
    strong: [-9, -10, -12, -13],
    super: [-12, -14, -16, -18],
  },
};

const POWER_LABELS = {
  weak: "弱い",
  normal: "普通",
  strong: "強い",
  super: "最強",
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

function normalizeCell(cell) {
  if (cell === null || cell === undefined || cell === "") {
    return null;
  }

  if (typeof cell === "number") {
    return {
      target: cell,
      label: "",
    };
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
      if (Array.isArray(row)) {
        return row.map((cell) => normalizeCell(cell));
      }

      return [normalizeCell(row)];
    });
  }

  if (Array.isArray(parsed.rows)) {
    return parsed.rows.map((row) => {
      if (Array.isArray(row)) {
        return row.map((cell) => normalizeCell(cell));
      }

      return [normalizeCell(row)];
    });
  }

  if (Array.isArray(parsed.grid)) {
    return parsed.grid.map((row) => {
      if (Array.isArray(row)) {
        return row.map((cell) => normalizeCell(cell));
      }

      return [normalizeCell(row)];
    });
  }

  if (Array.isArray(parsed.cells)) {
    const cols = Number(parsed.cols ?? parsed.columns ?? 3) || 3;
    const rows = [];

    parsed.cells.forEach((cell, index) => {
      const rowIndex = Math.floor(index / cols);

      if (!rows[rowIndex]) {
        rows[rowIndex] = [];
      }

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

export default function CraftCalculatorClient({ equipments = [] }) {
  const validEquipments = useMemo(() => {
    return equipments.filter((equipment) => {
      const grid = normalizeSlotGrid(equipment.slotGridJson);
      return grid.length > 0;
    });
  }, [equipments]);

  const [selectedId, setSelectedId] = useState(
    validEquipments[0]?.id ? String(validEquipments[0].id) : ""
  );

  const selectedEquipment = useMemo(() => {
    return validEquipments.find((item) => String(item.id) === selectedId);
  }, [validEquipments, selectedId]);

  const grid = useMemo(() => {
    return normalizeSlotGrid(selectedEquipment?.slotGridJson);
  }, [selectedEquipment]);

  const [values, setValues] = useState(() => createInitialValues(grid));

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

  function handleEquipmentChange(e) {
    const nextId = e.target.value;
    const nextEquipment = validEquipments.find(
      (item) => String(item.id) === nextId
    );
    const nextGrid = normalizeSlotGrid(nextEquipment?.slotGridJson);

    setSelectedId(nextId);
    setValues(createInitialValues(nextGrid));
  }

  function handleValueChange(key, value) {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetValues() {
    setValues(createInitialValues(grid));
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

  if (validEquipments.length === 0) {
    return (
      <section className={styles.emptyState}>
        <h2>slot_grid_json がある装備が見つかりませんでした</h2>
        <p>
          API側で <code>slot_grid_json</code> が入っている装備を返しているか確認してください。
        </p>
      </section>
    );
  }

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionLabel}>Equipment</p>
            <h2>装備を選択</h2>
          </div>

          <button type="button" onClick={resetValues} className={styles.subButton}>
            入力リセット
          </button>
        </div>

        <select
          value={selectedId}
          onChange={handleEquipmentChange}
          className={styles.select}
        >
          {validEquipments.map((equipment) => (
            <option key={equipment.id} value={equipment.id}>
              {equipment.itemName}
            </option>
          ))}
        </select>

        {selectedEquipment && (
          <div className={styles.equipmentInfo}>
            <h3>{selectedEquipment.itemName}</h3>

            <dl>
              <div>
                <dt>装備レベル</dt>
                <dd>{selectedEquipment.equipLevel || "-"}</dd>
              </div>

              <div>
                <dt>職人レベル</dt>
                <dd>{selectedEquipment.craftLevel || "-"}</dd>
              </div>

              <div>
                <dt>基準価格</dt>
                <dd>
                  {selectedEquipment.defaultPrice
                    ? `${Number(selectedEquipment.defaultPrice).toLocaleString()} G`
                    : "-"}
                </dd>
              </div>
            </dl>
          </div>
        )}
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
              gridTemplateColumns: `repeat(${getMaxCols(
                grid
              )}, minmax(96px, 1fr))`,
            }}
          >
            {grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const key = `${rowIndex}-${colIndex}`;

                if (!cell || cell.target === null || Number.isNaN(cell.target)) {
                  return <div key={key} className={styles.disabledCell} />;
                }

                const status = getCellStatus(cell.target, values[key]);

                return (
                  <div key={key} className={`${styles.cell} ${status.className}`}>
                    <div className={styles.cellTop}>
                      <span>目標</span>
                      <strong>{cell.target}</strong>
                    </div>

                    {cell.label && <p className={styles.cellLabel}>{cell.label}</p>}

                    <input
                      type="number"
                      inputMode="numeric"
                      value={values[key] ?? ""}
                      onChange={(e) => handleValueChange(key, e.target.value)}
                      placeholder="今の数値"
                      className={styles.input}
                    />

                    <p className={styles.status}>{status.label}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.tips}>
          <h3>使い方</h3>
          <p>
            各マスに現在の縫い数値を入力すると、大成功に必要な目標数値との差分が出ます。
            「あと◯」ならまだ縫える状態、「ぴったり」は目標到達、「オーバー」は縫いすぎです。
          </p>
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
          {Object.entries(POWER_TABLES).map(([tableKey, table]) => (
            <div key={tableKey} className={styles.numberCard}>
              <h3>{table.label}</h3>

              {Object.entries(POWER_LABELS).map(([powerKey, powerLabel]) => (
                <div key={powerKey} className={styles.numberRow}>
                  <span>{powerLabel}</span>
                  <p>{table[powerKey].join(" / ")}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}