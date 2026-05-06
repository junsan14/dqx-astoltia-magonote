"use client";

export default function PageHeroTitle({
  kicker,
  title,
  maxWidth = "1100px",
  margin = "0 auto 22px",
  padding = "24px 4px 8px",
}) {
  const styles = getStyles(maxWidth, margin, padding);

  return (
    <section style={styles.hero}>
      <div style={styles.heroGlow} />
      {kicker ? <p style={styles.kicker}>{kicker}</p> : null}
      <h1 style={styles.title}>{title}</h1>
    </section>
  );
}

function getStyles(maxWidth, margin, padding) {
  return {
    hero: {
      maxWidth,
      margin,
      position: "relative",
      padding,
    },
    heroGlow: {
      position: "absolute",
      top: "-40px",
      right: "10%",
      width: "220px",
      height: "220px",
      background:
        "radial-gradient(circle, color-mix(in srgb, var(--selected-border) 24%, transparent), transparent 70%)",
      filter: "blur(10px)",
      pointerEvents: "none",
    },
    kicker: {
      margin: "0 0 10px",
      fontSize: "12px",
      letterSpacing: "0.18em",
      color: "var(--selected-border)",
      fontWeight: 800,
    },
    title: {
      margin: "0 0 10px",
      fontSize: "clamp(34px, 6vw, 58px)",
      lineHeight: 1.02,
      fontWeight: 900,
      letterSpacing: "-0.04em",
      color: "var(--text-title)",
    },
  };
}