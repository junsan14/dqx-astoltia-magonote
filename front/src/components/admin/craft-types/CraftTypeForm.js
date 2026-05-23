"use client";

export default function CraftTypeForm({ craftType, onChange, isMobile }) {
  function updateField(name, value) {
    onChange({
      ...craftType,
      [name]: value,
    });
  }

  return (
    <div style={styles.form}>
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>基本情報</h2>

        <div
          style={{
            ...styles.grid,
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          }}
        >
          <Field label="表示名">
            <input
              value={craftType.name ?? ""}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="例：武器鍛冶 / 防具鍛冶 / 裁縫"
              style={styles.input}
            />
          </Field>

          <Field label="key">
            <input
              value={craftType.key ?? ""}
              onChange={(e) => updateField("key", e.target.value)}
              placeholder="例：weapon_smith"
              style={styles.input}
            />
          </Field>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>登録プレビュー</h2>

        <div style={styles.previewCard}>
          <div style={styles.previewTop}>
            <strong>{craftType.name || "名称未設定"}</strong>
          </div>

          <div style={styles.previewMeta}>key: {craftType.key || "-"}</div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>注意</h2>

        <p style={styles.note}>
          この画面は <code>craft_types</code> の追加・編集用だ。
          装備種別側では、この職人種別を選択して紐づける。
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: 18,
  },

  section: {
    display: "grid",
    gap: 12,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    color: "var(--page-text)",
  },

  grid: {
    display: "grid",
    gap: 12,
  },

  field: {
    display: "grid",
    gap: 6,
  },

  label: {
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text-sub)",
  },

  input: {
    width: "100%",
    minHeight: 42,
    borderRadius: 10,
    border: "1px solid var(--soft-border)",
    background: "var(--input-bg, var(--panel-bg))",
    color: "var(--page-text)",
    padding: "9px 11px",
    boxSizing: "border-box",
    outline: "none",
  },

  previewCard: {
    border: "1px solid var(--soft-border)",
    background: "var(--soft-bg)",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 8,
  },

  previewTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },

  previewMeta: {
    fontSize: 13,
    color: "var(--text-sub)",
    wordBreak: "break-all",
  },

  note: {
    margin: 0,
    color: "var(--text-sub)",
    fontSize: 13,
    lineHeight: 1.7,
  },
};