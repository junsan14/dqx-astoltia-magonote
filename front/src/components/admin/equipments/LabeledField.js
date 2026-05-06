"use client";

export default function LabeledField({ label, children }) {
  return (
    <label style={styles.wrap}>
      <span style={styles.label}>{label}</span>
      <div style={styles.control}>{children}</div>
    </label>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },

  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },

  control: {
    minWidth: 0,
  },
};