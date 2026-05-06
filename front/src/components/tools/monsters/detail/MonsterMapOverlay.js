"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getMonsterAssetUrl } from "@/lib/monsters";

const GRID_SIZE = 8;
const ORIGINAL_IMAGE_WIDTH = 490;
const ORIGINAL_IMAGE_HEIGHT = 565;
const CROP_TOP_PX = ORIGINAL_IMAGE_HEIGHT - ORIGINAL_IMAGE_WIDTH;
const TOP_AXIS_PX = 13;
const LEFT_AXIS_PX = 3.3;
const RIGHT_TRIM_PX = 0;
const BOTTOM_TRIM_PX = 0;

/**
 * 位置微調整
 */
const BUBBLE_OFFSET_X_PERCENT = 3;
const BUBBLE_OFFSET_Y_PERCENT = 3;

/**
 * 長方形サイズ調整
 * 1.0 だとほぼセルいっぱい
 * 0.88〜0.94 くらいが見やすい
 */
const BUBBLE_WIDTH_SCALE = 1;
const BUBBLE_HEIGHT_SCALE = 1;

/**
 * 長方形の角丸
 */
const BUBBLE_BORDER_RADIUS_PX = 5;

/**
 * 長方形の内側余白
 */
const BUBBLE_INNER_PADDING_CELLS = 0.08;

const GRID_SOURCE_X = LEFT_AXIS_PX;
const GRID_SOURCE_Y = CROP_TOP_PX + TOP_AXIS_PX;

const GRID_SOURCE_SIZE = Math.min(
  ORIGINAL_IMAGE_WIDTH - LEFT_AXIS_PX - RIGHT_TRIM_PX,
  ORIGINAL_IMAGE_HEIGHT - GRID_SOURCE_Y - BOTTOM_TRIM_PX
);

const MAP_CROP = {
  sourceX: GRID_SOURCE_X,
  sourceY: GRID_SOURCE_Y,
  sourceSize: GRID_SOURCE_SIZE,
  widthPercent: (ORIGINAL_IMAGE_WIDTH / GRID_SOURCE_SIZE) * 100,
  heightPercent: (ORIGINAL_IMAGE_HEIGHT / GRID_SOURCE_SIZE) * 100,
  offsetXPercent: (GRID_SOURCE_X / ORIGINAL_IMAGE_WIDTH) * 100,
  offsetYPercent: (GRID_SOURCE_Y / ORIGINAL_IMAGE_HEIGHT) * 100,
};

function useIsMobile(breakpoint = 920) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [breakpoint]);

  return isMobile;
}

function parseAreaList(area) {
  if (!area) return [];

  if (Array.isArray(area)) return area;

  if (typeof area === "string") {
    try {
      const parsed = JSON.parse(area);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      return area
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeAreaCell(value) {
  if (!value) return null;

  const raw = String(value).trim().toUpperCase().replace(/[^A-H1-8]/g, "");
  const match = raw.match(/^([A-H])([1-8])$/);
  if (!match) return null;

  return `${match[1]}${match[2]}`;
}

function parseCell(cell) {
  const normalized = normalizeAreaCell(cell);
  if (!normalized) return null;

  const col = normalized.charCodeAt(0) - "A".charCodeAt(0);
  const row = Number(normalized.slice(1)) - 1;

  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;

  return {
    col,
    row,
    key: normalized,
    label: normalized,
  };
}

function collectUniqueCells(spawns = []) {
  const seen = new Set();
  const result = [];

  spawns.forEach((spawn) => {
    const cells = parseAreaList(spawn?.area ?? spawn?.coords)
      .map(normalizeAreaCell)
      .filter(Boolean);

    for (const cell of cells) {
      if (seen.has(cell)) continue;
      seen.add(cell);

      const parsed = parseCell(cell);
      if (parsed) result.push(parsed);
    }
  });

  return result;
}

function compareCells(a, b) {
  if (a.row !== b.row) return a.row - b.row;
  return a.col - b.col;
}

function buildRectLabel(cells = []) {
  return cells
    .map((cell) => cell.label)
    .sort((a, b) => a.localeCompare(b, "ja"))
    .join(", ");
}

function buildShortLabel(cells = []) {
  if (!cells.length) return "";

  const sorted = [...cells].sort(compareCells);

  if (sorted.length === 1) return sorted[0].label;
  if (sorted.length === 2) return `${sorted[0].label}, ${sorted[1].label}`;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return `${first.label}〜${last.label}`;
}

function areCellsOrthogonallyAdjacent(a, b) {
  const colDiff = Math.abs(a.col - b.col);
  const rowDiff = Math.abs(a.row - b.row);

  return colDiff + rowDiff === 1;
}

function buildMergedGroups(cells = []) {
  if (!cells.length) return [];

  const sortedCells = [...cells].sort(compareCells);
  const visited = new Set();
  const groups = [];

  for (let i = 0; i < sortedCells.length; i += 1) {
    if (visited.has(i)) continue;

    const stack = [i];
    visited.add(i);

    const groupCells = [];

    while (stack.length) {
      const currentIndex = stack.pop();
      const current = sortedCells[currentIndex];
      groupCells.push(current);

      for (let j = 0; j < sortedCells.length; j += 1) {
        if (visited.has(j)) continue;

        const target = sortedCells[j];

        if (areCellsOrthogonallyAdjacent(current, target)) {
          visited.add(j);
          stack.push(j);
        }
      }
    }

    const normalizedCells = groupCells.sort(compareCells);

    groups.push({
      cells: normalizedCells,
      minCol: Math.min(...normalizedCells.map((cell) => cell.col)),
      maxCol: Math.max(...normalizedCells.map((cell) => cell.col)),
      minRow: Math.min(...normalizedCells.map((cell) => cell.row)),
      maxRow: Math.max(...normalizedCells.map((cell) => cell.row)),
      label: buildRectLabel(normalizedCells),
      shortLabel: buildShortLabel(normalizedCells),
      isMerged: normalizedCells.length > 1,
    });
  }

  return groups;
}

function normalizeMetaValue(value) {
  if (value == null) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (text === "[]" || text === "null" || text === "undefined") return "";
  return text;
}

function joinUniqueValues(values = []) {
  const uniq = [];
  const seen = new Set();

  for (const value of values) {
    const normalized = normalizeMetaValue(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    uniq.push(normalized);
  }

  return uniq.join(" / ");
}

function getPreferredNote(spawn) {
  const note = normalizeMetaValue(spawn?.note);
  if (note) return note;

  return normalizeMetaValue(spawn?.imported_note);
}

function bubbleContainsSpawn(group, spawn) {
  const bubbleCellSet = new Set(group.cells.map((cell) => cell.label));
  const spawnCells = parseAreaList(spawn?.area ?? spawn?.coords)
    .map(normalizeAreaCell)
    .filter(Boolean);

  return spawnCells.some((cell) => bubbleCellSet.has(cell));
}

function getBubblePosition(group, spawns = []) {
  const cellPercent = 100 / GRID_SIZE;
  const paddingPercent = cellPercent * BUBBLE_INNER_PADDING_CELLS;

  const widthCells = group.maxCol - group.minCol + 1;
  const heightCells = group.maxRow - group.minRow + 1;

  const left =
    group.minCol * cellPercent +
    (widthCells * cellPercent) / 2 +
    BUBBLE_OFFSET_X_PERCENT;

  const top =
    group.minRow * cellPercent +
    (heightCells * cellPercent) / 2 +
    BUBBLE_OFFSET_Y_PERCENT;

  const width = Math.max(
    cellPercent * BUBBLE_WIDTH_SCALE,
    widthCells * cellPercent * BUBBLE_WIDTH_SCALE - paddingPercent
  );

  const height = Math.max(
    cellPercent * BUBBLE_HEIGHT_SCALE,
    heightCells * cellPercent * BUBBLE_HEIGHT_SCALE - paddingPercent
  );

  const relatedSpawns = (spawns ?? []).filter((spawn) =>
    bubbleContainsSpawn(group, spawn)
  );

  const symbolCount = joinUniqueValues(
    relatedSpawns.map((spawn) => spawn?.symbol_count)
  );

  const spawnCount = joinUniqueValues(
    relatedSpawns.map((spawn) => spawn?.spawn_count)
  );

  const spawnTimes = joinUniqueValues(
    relatedSpawns
      .map((spawn) => spawn?.spawn_time)
      .filter(Boolean)
  );

  const notes = joinUniqueValues(relatedSpawns.map(getPreferredNote));
  const isHuntingGround = relatedSpawns.some(
    (spawn) => Boolean(spawn?.is_hunting_ground)
  );

  return {
    key: group.label,
    label: group.label,
    shortLabel: group.shortLabel,
    left,
    top,
    width,
    height,
    isMerged: group.isMerged,
    isWideArea: widthCells >= 4 || heightCells >= 4,
    symbolCount,
    spawnCount,
    spawnTimes,
    notes,
    isHuntingGround,
    relatedSpawns,
  };
}

function StatBlock({ label, value, styles }) {
  if (!value) return null;

  return (
    <div style={styles.summaryStat}>
      <span style={styles.summaryStatLabel}>{label}</span>
      <span style={styles.summaryStatValue}>{value}</span>
    </div>
  );
}

function BubbleInfoContent({ bubble, styles, t }) {
  if (!bubble) return null;

  return (
    <div style={styles.infoCardContent}>
      <div style={styles.infoRows}>
        {bubble.isHuntingGround ? (
          <div style={styles.huntingBadgeRow}>
            <span style={styles.huntingBadge}>{t("huntingGround")}</span>
          </div>
        ) : null}

        {bubble.symbolCount || bubble.spawnCount || bubble.spawnTimes ? (
          <div style={styles.summaryRow}>
            <StatBlock
              label={t("symbolCount")}
              value={bubble.symbolCount}
              styles={styles}
            />
            <StatBlock
              label={t("spawnCount")}
              value={bubble.spawnCount}
              styles={styles}
            />
            <StatBlock
              label={t("timeZone")}
              value={bubble.spawnTimes}
              styles={styles}
            />
          </div>
        ) : null}

        {bubble.notes ? (
          <div style={styles.infoBlock}>
            <span style={styles.infoLabel}>{t("memo")}</span>
            <span style={styles.infoValue}>{bubble.notes}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getStyles() {
  return {
    mapCard: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      height: "100%",
      overflow: "visible",
    },
    mapImageFrame: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      overflow: "visible",
    },
    linkWrap: {
      display: "block",
      textDecoration: "none",
      height: "100%",
      overflow: "visible",
    },
    mapImageBox: {
      position: "relative",
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: "18px",
      overflow: "hidden",
      background: "var(--page-bg)",
      border: `1px solid var(--panel-border)`,
      flexShrink: 0,
    },
    loadingOverlay: {
      position: "absolute",
      inset: 0,
      zIndex: 3,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      background: "color-mix(in srgb, var(--page-bg) 92%, transparent)",
    },
    loadingShimmer: {
      width: "100%",
      height: "100%",
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(90deg, color-mix(in srgb, var(--soft-border) 88%, transparent) 0%, color-mix(in srgb, var(--soft-bg) 100%, white 0%) 50%, color-mix(in srgb, var(--soft-border) 88%, transparent) 100%)",
      backgroundSize: "200% 100%",
      animation: "monsterMapShimmer 1.2s ease-in-out infinite",
    },
    loadingText: {
      position: "relative",
      zIndex: 1,
      fontSize: "13px",
      fontWeight: 700,
      color: "var(--text-sub)",
      background: "var(--panel-bg)",
      borderRadius: "999px",
      padding: "6px 10px",
      border: `1px solid var(--input-border)`,
    },
    imageInner: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      transition: "opacity 0.18s ease",
      zIndex: 1,
    },
    imageCropInner: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    mapImage: {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "fill",
    },
    bubbleLayer: {
      position: "absolute",
      inset: 0,
      zIndex: 2,
    },
    spawnBubble: {
      position: "absolute",
      transform: "translate(-50%, -50%)",
      borderRadius: `${BUBBLE_BORDER_RADIUS_PX}px`,
      border: "1px solid color-mix(in srgb, var(--page-text) 56%, transparent)",
      background: "color-mix(in srgb, var(--panel-bg) 24%, transparent)",
      backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      transition: "all 0.16s ease",
    },
    spawnBubbleSelected: {
      background: "color-mix(in srgb, var(--selected-border) 26%, transparent)",
      border: "2px solid var(--selected-border)",
      boxShadow:
        "0 0 0 3px color-mix(in srgb, var(--selected-border) 18%, transparent)",
    },
    bubbleInner: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      pointerEvents: "none",
    },
    bubbleText: {
      fontSize: "11px",
      fontWeight: 800,
      color: "var(--text-main)",
      background: "color-mix(in srgb, var(--panel-bg) 90%, transparent)",
      borderRadius: "999px",
      padding: "3px 7px",
      lineHeight: 1.1,
      boxShadow:
        "0 2px 8px color-mix(in srgb, var(--page-text) 10%, transparent)",
      whiteSpace: "nowrap",
      border: "1px solid color-mix(in srgb, var(--soft-border) 80%, transparent)",
    },
    bubbleHintIcon: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "18px",
      height: "18px",
      borderRadius: "999px",
      fontSize: "11px",
      lineHeight: 1,
      background: "var(--selected-border)",
      color: "#ffffff",
      boxShadow:
        "0 3px 10px color-mix(in srgb, var(--selected-border) 28%, transparent)",
      transform: "translateY(-1px)",
    },
    centerTooltip: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 5,
      pointerEvents: "none",
      width: "min(420px, calc(100% - 24px), 78vw)",
    },
    infoCardContent: {
      background: "color-mix(in srgb, var(--panel-bg) 96%, transparent)",
      border: `1px solid var(--panel-border)`,
      borderRadius: "16px",
      boxShadow:
        "0 18px 40px color-mix(in srgb, var(--page-text) 12%, transparent)",
      padding: "12px",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    },
    infoRows: {
      display: "grid",
      gap: "10px",
    },
    huntingBadgeRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      marginBottom: "2px",
    },
    huntingBadge: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "24px",
      padding: "4px 10px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--selected-border) 16%, transparent)",
      color: "var(--selected-text)",
      border:
        "1px solid color-mix(in srgb, var(--selected-border) 40%, transparent)",
      fontSize: "12px",
      fontWeight: 900,
      lineHeight: 1.1,
      whiteSpace: "nowrap",
    },
    summaryRow: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "10px",
      alignItems: "center",
    },
    summaryStat: {
      minWidth: 0,
      display: "grid",
      gap: "4px",
      justifyItems: "center",
      textAlign: "center",
    },
    summaryStatLabel: {
      fontSize: "12px",
      fontWeight: 900,
      color: "var(--text-muted)",
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      textAlign: "center",
    },
    summaryStatValue: {
      fontSize: "13px",
      fontWeight: 700,
      color: "var(--text-main)",
      lineHeight: 1.45,
      paddingLeft: 0,
      wordBreak: "break-word",
      whiteSpace: "pre-wrap",
      textAlign: "center",
    },
    infoBlock: {
      display: "grid",
      gap: "4px",
    },
    infoLabel: {
      fontSize: "12px",
      fontWeight: 900,
      color: "var(--text-muted)",
      lineHeight: 1.2,
    },
    infoValue: {
      fontSize: "13px",
      fontWeight: 700,
      color: "var(--text-main)",
      lineHeight: 1.5,
      paddingLeft: "6px",
      wordBreak: "break-word",
      whiteSpace: "pre-wrap",
    },
    mobileInfoCard: {
      position: "relative",
    },
    mobileInfoClose: {
      position: "absolute",
      top: "8px",
      right: "8px",
      width: "28px",
      height: "28px",
      borderRadius: "999px",
      border: `1px solid var(--input-border)`,
      background: "var(--input-bg)",
      color: "var(--input-text)",
      fontSize: "16px",
      fontWeight: 900,
      cursor: "pointer",
      zIndex: 2,
    },
    mobileInfoTop: {
      display: "block",
    },
    mobileInfoBody: {
      paddingTop: "6px",
    },
    noImageBox: {
      width: "100%",
      aspectRatio: "1 / 1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "18px",
      background: "var(--soft-bg)",
      border: `1px dashed var(--soft-border)`,
      color: "var(--text-muted)",
      fontWeight: 700,
    },
  };
}

export default function MonsterMapOverlay({
  spawns = [],
  imagePath,
  href,
}) {
  const t = useTranslations("MonsterMapOverlay");
  const isMobile = useIsMobile();
  const styles = useMemo(() => getStyles(), []);

  const resolvedImageUrl = useMemo(
    () => getMonsterAssetUrl(imagePath),
    [imagePath]
  );

  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredBubbleKey, setHoveredBubbleKey] = useState("");
  const [selectedBubbleKey, setSelectedBubbleKey] = useState("");

  useEffect(() => {
    setImageLoaded(false);
    setHoveredBubbleKey("");
    setSelectedBubbleKey("");
  }, [resolvedImageUrl, spawns]);

  const cells = useMemo(() => collectUniqueCells(spawns), [spawns]);

  const bubbles = useMemo(() => {
    return buildMergedGroups(cells)
      .map((group) => getBubblePosition(group, spawns))
      .filter(Boolean);
  }, [cells, spawns]);

  const activeDesktopBubble = useMemo(() => {
    if (selectedBubbleKey) {
      return bubbles.find((bubble) => bubble.key === selectedBubbleKey) ?? null;
    }

    if (!hoveredBubbleKey) return null;
    return bubbles.find((bubble) => bubble.key === hoveredBubbleKey) ?? null;
  }, [bubbles, hoveredBubbleKey, selectedBubbleKey]);

  const activeMobileBubble = useMemo(() => {
    if (!bubbles.length) return null;

    if (!selectedBubbleKey) {
      return bubbles[0];
    }

    return (
      bubbles.find((bubble) => bubble.key === selectedBubbleKey) ?? bubbles[0]
    );
  }, [bubbles, selectedBubbleKey]);

  function handleBubbleClick(bubbleKey) {
    if (!isMobile) return;
    setSelectedBubbleKey((prev) => (prev === bubbleKey ? "" : bubbleKey));
  }

  if (!resolvedImageUrl) {
    return (
      <div style={styles.mapCard}>
        <div style={styles.noImageBox}>{t("noImage")}</div>
      </div>
    );
  }

  const content = (
    <div style={styles.mapCard}>
      <div style={styles.mapImageFrame}>
        <div
          style={styles.mapImageBox}
          onClick={() => {
            if (isMobile) {
              setSelectedBubbleKey("");
            }
          }}
        >
          {!imageLoaded ? (
            <div style={styles.loadingOverlay}>
              <div style={styles.loadingShimmer} />
              <span style={styles.loadingText}>{t("loading")}</span>
            </div>
          ) : null}

          <div
            style={{
              ...styles.imageInner,
              opacity: imageLoaded ? 1 : 0,
            }}
          >
            <div
              style={{
                ...styles.imageCropInner,
                width: `${MAP_CROP.widthPercent}%`,
                height: `${MAP_CROP.heightPercent}%`,
                left: `-${MAP_CROP.offsetXPercent}%`,
                top: `-${MAP_CROP.offsetYPercent}%`,
              }}
            >
              <Image
                src={resolvedImageUrl}
                alt={t("mapAlt")}
                fill
                sizes="(max-width: 920px) 100vw, 50vw"
                style={styles.mapImage}
                onLoad={() => setImageLoaded(true)}
                unoptimized
              />
            </div>
          </div>

          <div style={styles.bubbleLayer}>
            {bubbles.map((bubble) => {
              const bubbleStyle = {
                ...styles.spawnBubble,
                ...(selectedBubbleKey === bubble.key
                  ? styles.spawnBubbleSelected
                  : {}),
                ...(bubble.isWideArea
                  ? {
                      backdropFilter: "none",
                      WebkitBackdropFilter: "none",
                    }
                  : {}),
                left: `${bubble.left}%`,
                top: `${bubble.top}%`,
                width: `${bubble.width}%`,
                height: `${bubble.height}%`,
              };

              return (
                <button
                  key={bubble.key}
                  type="button"
                  style={bubbleStyle}
                  aria-label={t("bubbleAriaLabel", { area: bubble.shortLabel })}
                  onMouseEnter={() => {
                    if (!isMobile) setHoveredBubbleKey(bubble.key);
                  }}
                  onMouseLeave={() => {
                    if (!isMobile && !selectedBubbleKey) {
                      setHoveredBubbleKey("");
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBubbleClick(bubble.key);
                  }}
                >
                  <span style={styles.bubbleInner}>
                    <span style={styles.bubbleText}>{bubble.shortLabel}</span>
                    {isMobile ? (
                      <span style={styles.bubbleHintIcon}>i</span>
                    ) : null}
                  </span>
                </button>
              );
            })}

            {!isMobile && activeDesktopBubble ? (
              <div style={styles.centerTooltip}>
                <BubbleInfoContent
                  bubble={activeDesktopBubble}
                  styles={styles}
                  t={t}
                />
              </div>
            ) : null}
          </div>
        </div>

        {isMobile && activeMobileBubble ? (
          <div style={styles.mobileInfoCard}>
            <button
              type="button"
              style={styles.mobileInfoClose}
              aria-label={t("close")}
              onClick={() => setSelectedBubbleKey("")}
            >
              ×
            </button>

            <div style={styles.mobileInfoTop}>
              <div style={styles.mobileInfoBody}>
                <BubbleInfoContent
                  bubble={activeMobileBubble}
                  styles={styles}
                  t={t}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes monsterMapShimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={styles.linkWrap}>
        {content}
      </Link>
    );
  }

  return content;
}