"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ensureGridSize,
  denormalizeGrid,
  getGridPreset,
  isDisabledCell,
  normalizeGrid,
  safeJsonParse,
  toJsonString,
  str,
} from "./equipmentFormHelpers";
import LabeledField from "./LabeledField";
export default function SlotGridEditor({ row, onPatch }) {
  const [gridRows, setGridRows] = useState(1);
  const [gridCols, setGridCols] = useState(1);
  const [grid2d, setGrid2d] = useState([[""]]);

  const parsed = useMemo(() => {
    if (!row) {
      return {
        nextRows: 1,
        nextCols: 1,
        nextGrid: [[""]],
      };
    }

    const preset = getGridPreset(row.slotGridType);
    const colsHint = preset?.cols ?? Number(row.slotGridCols ?? 0) ?? 0;
    const gridLike = safeJsonParse(row.slotGridJson, null);
    const norm = normalizeGrid(gridLike, colsHint);

    const nextRows = preset?.rows ?? (norm.rows > 0 ? norm.rows : 1);
    const nextCols = preset?.cols ?? (norm.cols > 0 ? norm.cols : 1);
    const nextGrid = ensureGridSize(norm.grid, nextRows, nextCols);

    return {
      nextRows,
      nextCols,
      nextGrid,
    };
  }, [row?.__key, row?.slotGridType, row?.slotGridJson, row?.slotGridCols]);

  useEffect(() => {
    setGridRows(parsed.nextRows);
    setGridCols(parsed.nextCols);
    setGrid2d(parsed.nextGrid);
  }, [parsed]);

  if (!row) return null;

  function patchGrid(data) {
    onPatch?.(data);
  }


  function updateGridCell(r, c, value) {
    const next = ensureGridSize(grid2d, gridRows, gridCols).map((rowArr) => [
      ...rowArr,
    ]);

    next[r][c] = value;
    setGrid2d(next);

    const den = denormalizeGrid(next);

    patchGrid({
      slotGridJson: den == null ? "" : toJsonString(den, "[]"),
    });
  }

  function handleGridPaste(startR, startC, text) {
    const raw = str(text).replace(/\r\n?/g, "\n");
    if (!raw) return;

    const lines = raw.split("\n").filter((x) => x.length > 0);
    if (!lines.length) return;

    const pasted = lines.map((line) => line.split("\t"));
    const pasteRows = pasted.length;
    const pasteCols = Math.max(...pasted.map((r) => r.length), 0);

    const nextRows = Math.max(gridRows, startR + pasteRows);
    const nextCols = Math.max(gridCols, startC + pasteCols);
    const nextGrid = ensureGridSize(grid2d, nextRows, nextCols).map((rowArr) => [
      ...rowArr,
    ]);

    for (let r = 0; r < pasteRows; r++) {
      for (let c = 0; c < pasted[r].length; c++) {
        nextGrid[startR + r][startC + c] = pasted[r][c];
      }
    }

    setGridRows(nextRows);
    setGridCols(nextCols);
    setGrid2d(nextGrid);

    const den = denormalizeGrid(nextGrid);

    patchGrid({
      slotGridCols: nextCols ? String(nextCols) : "",
      slotGridJson: den == null ? "" : toJsonString(den, "[]"),
    });
  }

  return (
  <LabeledField label="大成功数値">
    <div style={styles.slotGridBox}>
      <div style={styles.gridOuter}>
        <div
          style={{
            ...styles.gridPlain,
            gridTemplateColumns: `repeat(${Math.max(gridCols, 1)}, 78px)`,
          }}
        >
          {Array.from({ length: gridRows }).flatMap((_, r) =>
            Array.from({ length: gridCols }).map((__, c) => {
              const disabled = isDisabledCell(row.slotGridType, r, c);

              return (
                <input
                  key={`${r}-${c}`}
                  style={gridCellStyle(disabled)}
                  value={grid2d?.[r]?.[c] ?? ""}
                  disabled={disabled}
                  onChange={(e) => updateGridCell(r, c, e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData?.getData("text") ?? "";
                    if (!text) return;
                    e.preventDefault();
                    handleGridPaste(r, c, text);
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  </LabeledField>
);
}

const styles = {
  slotGridBox: {

    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },

  gridOuter: {
     overflowX: "auto",
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },

  gridPlain: {
    display: "grid",
    gap: 8,
  },
};

const gridCellStyle = (disabled) => ({
  width: 78,
  height: 44,
  border: "1px solid var(--input-border)",
  borderRadius: 10,
  background: disabled ? "var(--input-disabled-bg)" : "var(--input-bg)",
  color: disabled ? "var(--text-muted)" : "var(--input-text)",
  padding: "8px 10px",
  boxSizing: "border-box",
});