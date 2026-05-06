"use client";

import { useEffect, useMemo, useState } from "react";

export default function EditableSelectField({
  label,
  value = "",
  options = [],
  onChange,
  placeholder = "選択してください",
  allowCustom = true,
}) {
  const normalizedOptions = useMemo(() => {
    const base = Array.isArray(options) ? options : [];
    const mapped = base
      .map((item) => {
        if (typeof item === "string") {
          return { label: item, value: item, raw: item };
        }

        return {
          label: String(item?.label ?? item?.value ?? "").trim(),
          value: String(item?.value ?? item?.label ?? "").trim(),
          raw: item,
        };
      })
      .filter((item) => item.value);

    const uniqueMap = new Map();
    mapped.forEach((item) => {
      if (!uniqueMap.has(item.value)) {
        uniqueMap.set(item.value, item);
      }
    });

    if (value && !uniqueMap.has(value)) {
      uniqueMap.set(value, {
        label: value,
        value,
        raw: { label: value, value },
      });
    }

    return [...uniqueMap.values()];
  }, [options, value]);

  const [mode, setMode] = useState("select");
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    const included = value
      ? normalizedOptions.some((item) => item.value === value)
      : false;

    if (!value) {
      setMode("select");
      setCustomValue("");
      return;
    }

    if (included) {
      setCustomValue(value);
      return;
    }

    setMode("custom");
    setCustomValue(value);
  }, [value, normalizedOptions]);

  const selectedOption =
    normalizedOptions.find((item) => item.value === value)?.raw ?? null;

  return (
    <label style={styles.field}>
      <div style={styles.labelRow}>
        <span style={styles.label}>{label}</span>
        {allowCustom ? (
          <button
            type="button"
            onClick={() => {
              if (mode === "select") {
                setMode("custom");
                setCustomValue(value || "");
              } else {
                setMode("select");
                if (!normalizedOptions.some((item) => item.value === value)) {
                  onChange?.("", null);
                }
              }
            }}
            style={styles.switchButton}
          >
            {mode === "select" ? "新規作成" : "候補から選ぶ"}
          </button>
        ) : null}
      </div>

      {mode === "select" ? (
        <select
          value={normalizedOptions.some((item) => item.value === value) ? value : ""}
          onChange={(e) => {
            const nextValue = e.target.value;
            const option =
              normalizedOptions.find((item) => item.value === nextValue)?.raw ??
              null;
            onChange?.(nextValue, option);
          }}
          style={styles.input}
        >
          <option value="">{placeholder}</option>
          {normalizedOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={customValue}
          onChange={(e) => {
            const next = e.target.value;
            setCustomValue(next);
            onChange?.(next, null);
          }}
          style={styles.input}
          placeholder="新しい値を入力"
        />
      )}

      {selectedOption && selectedOption.folder ? (
        <div style={styles.meta}>folder: {selectedOption.folder}</div>
      ) : null}

      {selectedOption && selectedOption.fileName ? (
        <div style={styles.meta}>file: {selectedOption.fileName}</div>
      ) : null}
    </label>
  );
}

const styles = {
  field: {
    display: "grid",
    gap: "8px",
    minWidth: 0,
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-sub, #334155)",
  },
  switchButton: {
    border: "1px solid var(--card-border, #cbd5e1)",
    background: "var(--card-bg, #ffffff)",
    color: "var(--text-sub, #334155)",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    minWidth: 0,
    border: "1px solid var(--input-border, #cbd5e1)",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    background: "var(--input-bg, #ffffff)",
    outline: "none",
    boxSizing: "border-box",
    color: "var(--input-text, #111827)",
  },
  meta: {
    fontSize: "12px",
    color: "var(--text-muted, #64748b)",
  },
};