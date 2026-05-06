export function MonstersSearchPageLoading() {
  return (
    <div style={loadingStyles.pageWrap}>
      <section style={loadingStyles.searchCard}>
        <div style={loadingStyles.segmentRow}>
          <div style={{ ...loadingStyles.pill, width: 92 }} />
          <div style={{ ...loadingStyles.pill, width: 86 }} />
          <div style={{ ...loadingStyles.pill, width: 86 }} />
          <div style={{ ...loadingStyles.pill, width: 86 }} />
        </div>

        <div style={loadingStyles.searchInputWrap}>
          <div style={loadingStyles.searchIcon}>⌕</div>
          <div style={loadingStyles.searchInputSkeleton} />
        </div>

        <div style={loadingStyles.statusRow}>
          <div style={{ ...loadingStyles.line, width: 72, height: 12 }} />
        </div>
      </section>

      <section style={loadingStyles.list}>
        {Array.from({ length: 6 }).map((_, index) => (
          <article key={index} style={loadingStyles.card}>
            <div style={loadingStyles.cardInner}>
              <div style={loadingStyles.thumb} />

              <div style={loadingStyles.content}>
                <div style={{ ...loadingStyles.line, width: "38%", height: 20 }} />
                <div style={{ ...loadingStyles.line, width: "24%", height: 13, marginTop: 10 }} />
                <div style={{ ...loadingStyles.line, width: "72%", height: 13, marginTop: 14 }} />

                <div style={loadingStyles.metaRow}>
                  <div style={{ ...loadingStyles.badge, width: 84 }} />
                  <div style={{ ...loadingStyles.badge, width: 68 }} />
                  <div style={{ ...loadingStyles.badge, width: 94 }} />
                </div>
              </div>

              <div style={loadingStyles.chevron} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function MonsterDetailLoading() {
  return (
    <div style={loadingStyles.detailCard}>
      <div style={loadingStyles.detailHero}>
        <div style={loadingStyles.detailHeroThumb} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...loadingStyles.line, width: "42%", height: 22 }} />
          <div style={{ ...loadingStyles.line, width: "20%", height: 13, marginTop: 10 }} />
          <div style={{ ...loadingStyles.line, width: "64%", height: 13, marginTop: 14 }} />
        </div>
      </div>

      <div style={loadingStyles.detailSection}>
        <div style={{ ...loadingStyles.line, width: 120, height: 16 }} />
        <div style={loadingStyles.detailList}>
          <div style={{ ...loadingStyles.line, width: "100%", height: 14 }} />
          <div style={{ ...loadingStyles.line, width: "88%", height: 14 }} />
          <div style={{ ...loadingStyles.line, width: "76%", height: 14 }} />
        </div>
      </div>

      <div style={loadingStyles.detailSection}>
        <div style={{ ...loadingStyles.line, width: 140, height: 16 }} />
        <div style={loadingStyles.mapGrid}>
          <div style={loadingStyles.mapBox} />
          <div style={loadingStyles.mapBox} />
        </div>
      </div>
    </div>
  );
}

const shimmer = {
  background:
    "linear-gradient(90deg, rgba(226,232,240,0.9) 0%, rgba(241,245,249,1) 50%, rgba(226,232,240,0.9) 100%)",
  backgroundSize: "200% 100%",
  animation: "monsterSearchShimmer 1.4s ease-in-out infinite",
};

const loadingStyles = {
  pageWrap: {
    width: "100%",
    maxWidth: "1100px",
    margin: "0 auto",
    minWidth: 0,
    boxSizing: "border-box",
  },
  searchCard: {
    position: "relative",
    border: "1px solid rgba(255,255,255,0.75)",
    background: "rgba(255,255,255,0.82)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: "24px",
    padding: "18px",
    boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "28px",
  },
  segmentRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "14px",
  },
  pill: {
    height: "40px",
    borderRadius: "999px",
    ...shimmer,
  },
  searchInputWrap: {
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    fontSize: "18px",
    zIndex: 2,
  },
  searchInputSkeleton: {
    width: "100%",
    height: "58px",
    borderRadius: "18px",
    ...shimmer,
  },
  statusRow: {
    marginTop: "12px",
    display: "flex",
    justifyContent: "flex-end",
  },
  list: {
    display: "grid",
    gap: "16px",
    width: "100%",
  },
  card: {
    borderRadius: "24px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(255,255,255,0.75)",
    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
    overflow: "hidden",
  },
  cardInner: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0,1fr) 24px",
    gap: "16px",
    alignItems: "center",
    padding: "18px",
  },
  thumb: {
    width: "72px",
    height: "72px",
    borderRadius: "20px",
    ...shimmer,
  },
  content: {
    minWidth: 0,
  },
  line: {
    borderRadius: "999px",
    ...shimmer,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "16px",
  },
  badge: {
    height: "28px",
    borderRadius: "999px",
    ...shimmer,
  },
  chevron: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    ...shimmer,
    justifySelf: "end",
  },
  detailCard: {
    borderRadius: "0 0 24px 24px",
    padding: "18px",
    background: "rgba(255,255,255,0.96)",
    border: "1px solid #c7d2fe",
    borderTop: "1px solid rgba(199,210,254,0.55)",
    boxShadow: "0 14px 34px rgba(79,70,229,0.08)",
    width: "100%",
    boxSizing: "border-box",
  },
  detailHero: {
    display: "grid",
    gridTemplateColumns: "88px minmax(0,1fr)",
    gap: "16px",
    alignItems: "center",
  },
  detailHeroThumb: {
    width: "88px",
    height: "88px",
    borderRadius: "24px",
    ...shimmer,
  },
  detailSection: {
    marginTop: "22px",
  },
  detailList: {
    display: "grid",
    gap: "10px",
    marginTop: "12px",
  },
  mapGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    gap: "12px",
    marginTop: "12px",
  },
  mapBox: {
    height: "96px",
    borderRadius: "18px",
    ...shimmer,
  },
};
