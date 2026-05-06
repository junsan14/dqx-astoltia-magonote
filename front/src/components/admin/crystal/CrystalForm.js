function Field({ label, value, onChange }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

export default function CrystalForm({
  form,
  isPending,
  message,
  error,
  onChange,
  onReset,
  isMobile = false,
  submitLabel = "追加",
  resetLabel = "リセット",
  hideSubmitButton = false,
}) {
  return (
    <section style={panelStyle(isMobile)}>
      {message ? <div style={messageStyle}>{message}</div> : null}
      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={formStyle}>
        <div style={gridStyle(isMobile)}>
          <Field
            label="最小レベル"
            value={form.min_level}
            onChange={(v) => onChange("min_level", v)}
          />
          <Field
            label="最大レベル"
            value={form.max_level}
            onChange={(v) => onChange("max_level", v)}
          />
          <Field
            label="plus0"
            value={form.plus0}
            onChange={(v) => onChange("plus0", v)}
          />
          <Field
            label="plus1"
            value={form.plus1}
            onChange={(v) => onChange("plus1", v)}
          />
          <Field
            label="plus2"
            value={form.plus2}
            onChange={(v) => onChange("plus2", v)}
          />
          <Field
            label="plus3"
            value={form.plus3}
            onChange={(v) => onChange("plus3", v)}
          />
        </div>

        <div style={buttonRowStyle(isMobile)}>
          {!hideSubmitButton ? (
            <button
              type="button"
              disabled={isPending}
              style={{
                ...primaryBtnStyle(isMobile),
                opacity: isPending ? 0.7 : 1,
                cursor: isPending ? "wait" : "pointer",
              }}
            >
              {isPending ? "保存中..." : submitLabel}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onReset}
            disabled={isPending}
            style={{
              ...secondaryBtnStyle(isMobile),
              opacity: isPending ? 0.7 : 1,
              cursor: isPending ? "wait" : "pointer",
            }}
          >
            {resetLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

const panelStyle = (isMobile) => ({
  background: "var(--panel-bg)",
  borderRadius: 16,
  padding: isMobile ? 16 : 24,
  boxSizing: "border-box",
});



const formStyle = {
  display: "grid",
  gap: 20,
};

const gridStyle = (isMobile) => ({
  display: "grid",
  gridTemplateColumns: isMobile
    ? "minmax(0, 1fr)"
    : "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
});

const fieldStyle = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const labelStyle = {
  color: "var(--text-sub)",
  fontWeight: 700,
  fontSize: 13,
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--input-text)",
  outline: "none",
  fontSize: 14,
};

const buttonRowStyle = (isMobile) => ({
  display: "flex",
  flexDirection: isMobile ? "column" : "row",
  gap: 12,
  flexWrap: "wrap",
});

const primaryBtnStyle = (isMobile) => ({
  width: isMobile ? "100%" : "auto",
  border: "1px solid var(--primary-border)",
  borderRadius: 12,
  padding: "12px 18px",
  fontWeight: 700,
  background: "var(--primary-bg)",
  color: "var(--primary-text)",
  whiteSpace: "nowrap",
});

const secondaryBtnStyle = (isMobile) => ({
  width: isMobile ? "100%" : "auto",
  borderRadius: 12,
  padding: "12px 18px",
  fontWeight: 700,
  background: "var(--secondary-bg)",
  color: "var(--secondary-text)",
  border: "1px solid var(--secondary-border)",
  whiteSpace: "nowrap",
});

const messageStyle = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--soft-bg)",
  color: "var(--text-main)",
  border: "1px solid var(--soft-border)",
};

const errorStyle = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  border: "1px solid var(--danger-border)",
};