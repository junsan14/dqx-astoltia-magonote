"use client";

import { useMemo } from "react";

export default function MonsterTriviaEditor({
  trivia1 = "",
  trivia2 = "",
  onChange,
  disabled = false,
}) {
  const styles = useMemo(() => getStyles(), []);

  function updateField(key, value) {
    if (typeof onChange !== "function") return;

    onChange((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.title}>豆知識</h2>
        <p style={styles.desc}>モンスターの補足情報を登録できる</p>
      </div>

      <div style={styles.grid}>
        <label style={styles.field}>
          <span style={styles.label}>豆知識1</span>
          <textarea
            value={trivia1 ?? ""}
            onChange={(e) => updateField("trivia_1", e.target.value)}
            placeholder="豆知識1を入力"
            disabled={disabled}
            style={{
              ...styles.textarea,
              ...(disabled ? styles.textareaDisabled : {}),
            }}
            rows={4}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>豆知識2</span>
          <textarea
            value={trivia2 ?? ""}
            onChange={(e) => updateField("trivia_2", e.target.value)}
            placeholder="豆知識2を入力"
            disabled={disabled}
            style={{
              ...styles.textarea,
              ...(disabled ? styles.textareaDisabled : {}),
            }}
            rows={4}
          />
        </label>
      </div>
    </section>
  );
}

function getStyles() {
  return {
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

    header: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },

    title: {
      margin: 0,
      fontSize: 18,
      color: "var(--text-title)",
    },

    desc: {
      margin: 0,
      fontSize: 13,
      color: "var(--text-muted)",
    },

    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 14,
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

    textarea: {
      width: "100%",
      minHeight: 110,
      borderRadius: 10,
      border: "1px solid var(--card-border)",
      background: "var(--input-bg, #fff)",
      color: "var(--text-main)",
      padding: "12px 14px",
      resize: "vertical",
      fontSize: 14,
      lineHeight: 1.6,
      boxSizing: "border-box",
      outline: "none",
    },

    textareaDisabled: {
      opacity: 0.7,
      cursor: "not-allowed",
      background: "var(--soft-bg)",
    },
  };
}