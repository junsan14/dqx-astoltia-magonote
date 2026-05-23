"use client";

export default function EquipmentTypeForm({
  equipmentType,
  onChange,
  craftTypes = [],
  isMobile,
}) {
  function updateField(name, value) {
    onChange({
      ...equipmentType,
      [name]: value,
    });
  }

  function updateCraftTypeId(value) {
    onChange({
      ...equipmentType,
      craftTypeId: value === "" ? null : Number(value),
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
              value={equipmentType.name ?? ""}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="例：片手剣 / 両手剣 / 盾 / からだ上"
              style={styles.input}
            />
          </Field>

          <Field label="key">
            <input
              value={equipmentType.key ?? ""}
              onChange={(e) => updateField("key", e.target.value)}
              placeholder="例：one_hand_sword"
              style={styles.input}
            />
          </Field>

          <Field label="種類">
            <select
              value={equipmentType.kind ?? ""}
              onChange={(e) => updateField("kind", e.target.value)}
              style={styles.input}
            >
              <option value="">選択してください</option>
              <option value="weapon">武器</option>
              <option value="armor">防具</option>
            </select>
          </Field>

          <Field label="職人">
            <select
              value={equipmentType.craftTypeId ?? ""}
              onChange={(e) => updateCraftTypeId(e.target.value)}
              style={styles.input}
            >
              <option value="">未設定</option>

              {craftTypes.map((craftType) => (
                <option key={craftType.id} value={craftType.id}>
                  {craftType.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>登録プレビュー</h2>

        <div style={styles.previewCard}>
          <div style={styles.previewTop}>
            <strong>{equipmentType.name || "名称未設定"}</strong>
            <span style={styles.previewBadge}>
              {getKindLabel(equipmentType.kind)}
            </span>
          </div>

          <div style={styles.previewMeta}>key: {equipmentType.key || "-"}</div>

          <div style={styles.previewMeta}>
            職人: {getCraftTypeName(craftTypes, equipmentType.craftTypeId)}
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>注意</h2>

        <p style={styles.note}>
          この画面は <code>equipment_types</code> の追加・編集用だ。
          装備そのものの追加・編集は <code>equipments</code> 側で別画面にするのが安全。
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

function getKindLabel(kind) {
  if (kind === "weapon") return "武器";
  if (kind === "armor") return "防具";
  return "未設定";
}

function getCraftTypeName(craftTypes, craftTypeId) {
  if (!craftTypeId) return "未設定";

  const found = craftTypes.find(
    (item) => Number(item.id) === Number(craftTypeId)
  );

  return found?.name || `ID: ${craftTypeId}`;
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

  previewBadge: {
    padding: "4px 9px",
    borderRadius: 999,
    background: "rgba(34, 197, 94, 0.12)",
    color: "#22c55e",
    fontSize: 12,
    fontWeight: 900,
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