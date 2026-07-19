"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Image from "next/image";
import { getMonsterAssetUrl } from "@/lib/monsters";

const GRID_SIZE = 8;
const ORIGINAL_IMAGE_WIDTH = 490;
const ORIGINAL_IMAGE_HEIGHT = 565;
const CROP_TOP_PX = ORIGINAL_IMAGE_HEIGHT - ORIGINAL_IMAGE_WIDTH;
const TOP_AXIS_PX = 13;
const LEFT_AXIS_PX = 3.3;
const RIGHT_TRIM_PX = 0;
const BOTTOM_TRIM_PX = 0;

const BUBBLE_OFFSET_X_PERCENT = 3;
const BUBBLE_OFFSET_Y_PERCENT = 3;
const BUBBLE_WIDTH_SCALE = 1;
const BUBBLE_HEIGHT_SCALE = 1;
const BUBBLE_BORDER_RADIUS_PX = 5;
const BUBBLE_INNER_PADDING_CELLS = 0.08;

const DESKTOP_BREAKPOINT = 920;
const LABEL_GAP_PX = 12;
const CONNECTOR_LENGTH_PX = 14;
const LABEL_LANE_STEP_PX = 34;

const GRID_SOURCE_X = LEFT_AXIS_PX;
const GRID_SOURCE_Y = CROP_TOP_PX + TOP_AXIS_PX;

const GRID_SOURCE_SIZE = Math.min(
  ORIGINAL_IMAGE_WIDTH - LEFT_AXIS_PX - RIGHT_TRIM_PX,
  ORIGINAL_IMAGE_HEIGHT - GRID_SOURCE_Y - BOTTOM_TRIM_PX
);

const MAP_CROP = {
  widthPercent: (ORIGINAL_IMAGE_WIDTH / GRID_SOURCE_SIZE) * 100,
  heightPercent: (ORIGINAL_IMAGE_HEIGHT / GRID_SOURCE_SIZE) * 100,
  offsetXPercent: (GRID_SOURCE_X / ORIGINAL_IMAGE_WIDTH) * 100,
  offsetYPercent: (GRID_SOURCE_Y / ORIGINAL_IMAGE_HEIGHT) * 100,
};

function useIsMobile(breakpoint = DESKTOP_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
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
    const minCol = Math.min(...normalizedCells.map((cell) => cell.col));
    const maxCol = Math.max(...normalizedCells.map((cell) => cell.col));
    const minRow = Math.min(...normalizedCells.map((cell) => cell.row));
    const maxRow = Math.max(...normalizedCells.map((cell) => cell.row));
    const widthCells = maxCol - minCol + 1;
    const heightCells = maxRow - minRow + 1;
    const cellCount = normalizedCells.length;

    groups.push({
      cells: normalizedCells,
      minCol,
      maxCol,
      minRow,
      maxRow,
      label: buildRectLabel(normalizedCells),
      isMerged: normalizedCells.length > 1,
      widthCells,
      heightCells,
      cellCount,
      isBigBubble:
        widthCells >= 4 || heightCells >= 4 || cellCount >= 10,
      isFullArea:
        (widthCells >= 7 && heightCells >= 7) ||
        cellCount >= 32 ||
        (widthCells === 8 && heightCells >= 6) ||
        (heightCells === 8 && widthCells >= 6),
    });
  }

  return groups;
}

function normalizeMetaValue(value) {
  if (value == null) return "";
  const text = String(value).trim();
  if (!text || text === "[]" || text === "null" || text === "undefined") return "";
  return text;
}

function joinUniqueMonsterNames(spawns = [], monstersById = {}) {
  const result = [];
  const seen = new Set();

  for (const spawn of spawns) {
    const name = normalizeMetaValue(monstersById?.[spawn?.monster_id]?.name);
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }

  return result;
}

function bubbleContainsSpawn(group, spawn) {
  const bubbleCellSet = new Set(group.cells.map((cell) => cell.label));
  const spawnCells = parseAreaList(spawn?.area ?? spawn?.coords)
    .map(normalizeAreaCell)
    .filter(Boolean);

  return spawnCells.some((cell) => bubbleCellSet.has(cell));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getEdgePlacement(leftPercent, topPercent) {
  if (topPercent <= 26) return "top";
  if (leftPercent >= 74) return "right";
  if (leftPercent <= 26) return "left";
  if (topPercent >= 74) return "bottom";
  return "bottom";
}

function getLabelPlacementForBubble(bubbleLike) {
  if (bubbleLike.isFullArea || bubbleLike.isBigBubble) return "center";

  const edge = getEdgePlacement(bubbleLike.left, bubbleLike.top);

  if (edge === "top") return "bottom";
  if (edge === "right") return "left";
  if (edge === "left") return "right";
  if (edge === "bottom") return "top";

  return "bottom";
}

function getBubblePosition(
  group,
  spawns = [],
  monstersById = {},
  showMonsterNameInBubble = false
) {
  const cellPercent = 100 / GRID_SIZE;
  const paddingPercent = cellPercent * BUBBLE_INNER_PADDING_CELLS;

  const widthCells = group.maxCol - group.minCol + 1;
  const heightCells = group.maxRow - group.minRow + 1;

  let left =
    group.minCol * cellPercent +
    (widthCells * cellPercent) / 2 +
    BUBBLE_OFFSET_X_PERCENT;

  let top =
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

  const halfW = width / 2;
  const halfH = height / 2;

  left = clamp(left, halfW + 1, 100 - halfW - 1);
  top = clamp(top, halfH + 1, 100 - halfH - 1);

  const relatedSpawns = (spawns ?? []).filter((spawn) =>
    bubbleContainsSpawn(group, spawn)
  );

  const monsterNames = joinUniqueMonsterNames(relatedSpawns, monstersById);

  const base = {
    key: group.label,
    label: group.label,
    monsterLabel: showMonsterNameInBubble ? monsterNames.join(" / ") : "",
    monsterNames,
    left,
    top,
    width,
    height,
    isFullArea: group.isFullArea,
    isBigBubble: group.isBigBubble,
  };

  return {
    ...base,
    labelPlacement: getLabelPlacementForBubble(base),
  };
}

function withTooltipLanes(bubbles = []) {
  const grouped = { top: [], bottom: [], left: [], right: [] };

  bubbles.forEach((bubble, index) => {
    if (bubble.labelPlacement === "center") return;
    grouped[bubble.labelPlacement]?.push({ bubble, index });
  });

  const result = bubbles.map((bubble) =>
    bubble.labelPlacement === "center" ? { ...bubble, lane: 0 } : null
  );

  Object.entries(grouped).forEach(([placement, items]) => {
    const sorted = [...items].sort((a, b) => {
      if (placement === "left" || placement === "right") {
        return a.bubble.top - b.bubble.top;
      }
      return a.bubble.left - b.bubble.left;
    });

    let lane = 0;
    let prevAnchor = null;

    sorted.forEach(({ bubble, index }) => {
      const anchor =
        placement === "left" || placement === "right" ? bubble.top : bubble.left;
      const threshold = placement === "left" || placement === "right" ? 10 : 12;

      if (prevAnchor == null || Math.abs(anchor - prevAnchor) > threshold) {
        lane = 0;
      } else {
        lane += 1;
      }

      prevAnchor = anchor;
      result[index] = { ...bubble, lane };
    });
  });

  return result.filter(Boolean);
}

function getExternalPositionStyle(placement, lane = 0) {
  const laneOffset = lane * LABEL_LANE_STEP_PX;

  switch (placement) {
    case "top":
      return {
        bottom: `calc(100% + ${LABEL_GAP_PX + laneOffset}px)`,
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        right: `calc(100% + ${LABEL_GAP_PX + laneOffset}px)`,
        top: "50%",
        transform: "translateY(-50%)",
      };
    case "right":
      return {
        left: `calc(100% + ${LABEL_GAP_PX + laneOffset}px)`,
        top: "50%",
        transform: "translateY(-50%)",
      };
    case "bottom":
      return {
        top: `calc(100% + ${LABEL_GAP_PX + laneOffset}px)`,
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "center":
    default:
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
  }
}

function getConnectorStyle(placement, lane = 0) {
  const length = CONNECTOR_LENGTH_PX + lane * LABEL_LANE_STEP_PX;

  switch (placement) {
    case "top":
      return {
        bottom: "100%",
        left: "50%",
        width: "2px",
        height: `${length}px`,
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        right: "100%",
        top: "50%",
        width: `${length}px`,
        height: "2px",
        transform: "translateY(-50%)",
      };
    case "right":
      return {
        left: "100%",
        top: "50%",
        width: `${length}px`,
        height: "2px",
        transform: "translateY(-50%)",
      };
    case "bottom":
      return {
        top: "100%",
        left: "50%",
        width: "2px",
        height: `${length}px`,
        transform: "translateX(-50%)",
      };
    default:
      return null;
  }
}

function BubbleNameLabel({ bubble, styles }) {
  if (!bubble?.monsterLabel) return null;

  return <span style={styles.externalLabelMonster}>{bubble.monsterLabel}</span>;
}

export function getStyles() {
  return {
    mapCard: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      overflow: "visible",
      height: "100%",
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
      overflow: "visible",
    },
    mapImageBox: {
      position: "relative",
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: "18px",
      overflow: "visible",
      background: "transparent",
      flexShrink: 0,
    },
    mapImageViewport: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      borderRadius: "18px",
      background: "var(--page-bg)",
      border: "1px solid var(--panel-border)",
      zIndex: 1,
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
      border: "1px solid var(--input-border)",
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
      zIndex: 4,
      overflow: "visible",
      pointerEvents: "none",
    },
    bubbleWrap: {
      position: "absolute",
      transform: "translate(-50%, -50%)",
      pointerEvents: "auto",
      overflow: "visible",
    },
    spawnBubble: {
      position: "relative",
      borderRadius: `${BUBBLE_BORDER_RADIUS_PX}px`,
      border: "1px solid color-mix(in srgb, var(--page-text) 62%, transparent)",
      background: "color-mix(in srgb, var(--panel-bg) 26%, transparent)",
      backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      transition: "all 0.16s ease",
      pointerEvents: "auto",
      boxShadow:
        "0 0 0 1px color-mix(in srgb, var(--page-bg) 16%, transparent), 0 4px 14px color-mix(in srgb, var(--page-text) 10%, transparent)",
    },
    bubbleInner: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      pointerEvents: "none",
      minWidth: 0,
      maxWidth: "100%",
      paddingInline: "4px",
    },
    bubbleHintIcon: {
      display: "none",
    },
    externalConnector: {
      position: "absolute",
      background:
        "color-mix(in srgb, var(--page-text) 72%, color-mix(in srgb, var(--panel-bg) 18%, transparent))",
      pointerEvents: "none",
      zIndex: 1,
      borderRadius: "999px",
      boxShadow:
        "0 0 0 1px color-mix(in srgb, var(--page-bg) 10%, transparent), 0 0 10px color-mix(in srgb, var(--page-text) 10%, transparent)",
      opacity: 0.92,
    },
    externalLabel: {
      position: "absolute",
      zIndex: 2,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "max-content",
      maxWidth: "170px",
      minHeight: "26px",
      padding: "5px 9px",
      borderRadius: "10px",
      background: "color-mix(in srgb, var(--panel-bg) 97%, transparent)",
      border: "1px solid color-mix(in srgb, var(--soft-border) 82%, transparent)",
      boxShadow:
        "0 8px 20px color-mix(in srgb, var(--page-text) 10%, transparent)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      pointerEvents: "none",
      whiteSpace: "normal",
    },
    externalLabelMonster: {
      display: "block",
      width: "100%",
      textAlign: "center",
      fontSize: "11px",
      fontWeight: 800,
      lineHeight: 1.25,
      color: "var(--text-main)",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      wordBreak: "break-word",
    },
    noImageBox: {
      width: "100%",
      aspectRatio: "1 / 1",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "18px",
      background: "var(--soft-bg)",
      border: "1px dashed var(--soft-border)",
      color: "var(--text-muted)",
      fontWeight: 700,
    },
  };
}

export default function MonsterMapOverlay({
  spawns = [],
  imagePath,
  href,
  monstersById = {},
  showMonsterNameInBubble = false,
}) {
  const isMobile = useIsMobile();
  const styles = useMemo(() => getStyles(), []);

  const resolvedImageUrl = useMemo(
    () => getMonsterAssetUrl(imagePath),
    [imagePath]
  );

  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [resolvedImageUrl]);

  const cells = useMemo(() => collectUniqueCells(spawns), [spawns]);

  const bubbles = useMemo(() => {
    const base = buildMergedGroups(cells)
      .map((group) =>
        getBubblePosition(group, spawns, monstersById, showMonsterNameInBubble)
      )
      .filter(Boolean);

    return withTooltipLanes(base);
  }, [cells, spawns, monstersById, showMonsterNameInBubble]);

  if (!resolvedImageUrl) {
    return (
      <div style={styles.mapCard}>
        <div style={styles.noImageBox}>画像なし</div>
      </div>
    );
  }

  const content = (
    <div style={styles.mapCard}>
      <div style={styles.mapImageFrame}>
        <div style={styles.mapImageBox}>
          <div style={styles.mapImageViewport}>
            {!imageLoaded ? (
              <div style={styles.loadingOverlay}>
                <div style={styles.loadingShimmer} />
                <span style={styles.loadingText}>読み込み中...</span>
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
                  alt="map"
                  fill
                  sizes="(max-width: 920px) 100vw, 430px"
                  style={styles.mapImage}
                  onLoad={() => setImageLoaded(true)}
                  unoptimized
                />
              </div>
            </div>
          </div>

          <div style={styles.bubbleLayer}>
            {bubbles.map((bubble) => {
              const wrapperStyle = {
                ...styles.bubbleWrap,
                left: `${bubble.left}%`,
                top: `${bubble.top}%`,
                width: `${bubble.width}%`,
                height: `${bubble.height}%`,
              };

              const bubbleStyle = {
                ...styles.spawnBubble,
                width: "100%",
                height: "100%",
              };

              const labelStyle = {
                ...styles.externalLabel,
                ...getExternalPositionStyle(bubble.labelPlacement, bubble.lane),
              };

              const connectorStyle =
                bubble.labelPlacement === "center"
                  ? null
                  : {
                      ...styles.externalConnector,
                      ...getConnectorStyle(bubble.labelPlacement, bubble.lane),
                    };

              return (
                <div key={bubble.key} style={wrapperStyle}>
                  <div style={bubbleStyle}>
                    <span style={styles.bubbleInner}>
                      {isMobile ? <span style={styles.bubbleHintIcon}>i</span> : null}
                    </span>
                  </div>

                  {connectorStyle ? <span style={connectorStyle} /> : null}

                  {bubble.monsterLabel ? (
                    <span style={labelStyle}>
                      <BubbleNameLabel bubble={bubble} styles={styles} />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes monsterMapShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
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