"use client";

import { useEffect, useMemo, useState } from "react";
import { FaMoon } from "react-icons/fa6";
import { IoSunnyOutline } from "react-icons/io5";
import MonsterMapOverlay from "./MonsterMapOverlay";





function normalizeSpawnTime(value) {
  const v = String(value ?? "").trim().toLowerCase();

  if (v.includes("night") || v.includes("夜")) return "夜";
  if (v.includes("day") || v.includes("昼") || v.includes("日中")) return "日中";
  if (v.includes("normal") || v.includes("always") || v.includes("いつでも")) {
    return "いつでも";
  }

  return String(value ?? "").trim();
}

function normalizeLayerName(value) {
  return String(value ?? "").trim();
}



function getSpawnLayerName(spawn = {}) {
  return normalizeLayerName(spawn?.map_layer_name ?? spawn?.layer_name ?? "");
}

function getSpawnImagePath(spawn = {}, mapItem = {}) {
  return (
    spawn?.map_image_path ??
    spawn?.map_image_url ??
    mapItem?.image_path ??
    mapItem?.image_url ??
    ""
  );
}

function buildLayerGroups(mapItem) {
  const spawns = Array.isArray(mapItem?.spawns) ? mapItem.spawns : [];
  const groups = new Map();

  for (const spawn of spawns) {
    const layerName = getSpawnLayerName(spawn);

    if (!layerName || layerName === "地上") {
      continue;
    }

    if (!groups.has(layerName)) {
      groups.set(layerName, {
        layerName,
        imagePath: getSpawnImagePath(spawn, mapItem),
        spawns: [],
      });
    }

    const current = groups.get(layerName);
    current.spawns.push(spawn);

    if (!current.imagePath) {
      current.imagePath = getSpawnImagePath(spawn, mapItem);
    }
  }

  return Array.from(groups.values());
}



function useIsMobile(breakpoint = 920) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
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

function getContinentName(mapItem = {}) {
  return String(
    mapItem?.continent_name ??
      mapItem?.continent ??
      mapItem?.continentLabel ??
      ""
  ).trim();
}

function hasHuntingGround(mapItem = {}, spawns = []) {
  if (mapItem?.is_hunting_ground) return true;

  const list = Array.isArray(spawns) ? spawns : [];
  return list.some((spawn) => spawn?.is_hunting_ground);
}

function getSpawnTimeFlags(spawns = []) {
  const list = Array.isArray(spawns) ? spawns : [];

  let hasDay = false;
  let hasNight = false;

  for (const spawn of list) {
    const normalized = normalizeSpawnTime(spawn?.spawn_time);

    if (normalized === "日中") hasDay = true;
    if (normalized === "夜") hasNight = true;

    if (hasDay && hasNight) break;
  }

  return { hasDay, hasNight };
}

function getStyles() {
  return {
    card: {
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      boxSizing: "border-box",
      overflow: "hidden",
      background: "var(--soft-bg)",
      borderRadius: "5px",
      padding: "16px",
      height: "100%",
      minHeight: "100%",
      border: `1px solid var(--card-border)`,
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    },
    topRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "14px",
    },
    topRowMobile: {
      flexDirection: "column",
      alignItems: "stretch",
    },
    titleWrap: {
      minWidth: 0,
      flex: 1,
    },
    titleLine: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px 10px",
    },
    mapTitle: {
      margin: 0,
      fontSize: "18px",
      lineHeight: 1.35,
      fontWeight: 900,
      color: "var(--text-title)",
      wordBreak: "break-word",
    },
    titleMetaRow: {
      display: "inline-flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8px",
      minWidth: 0,
    },
    continentText: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "28px",
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 800,
      background: "var(--badge-bg)",
      color: "var(--badge-text)",
      border: `1px solid var(--tag-border)`,
    },
    huntingBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "28px",
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 900,
      lineHeight: 1,
      color: "var(--selected-text)",
      background:
        "color-mix(in srgb, var(--selected-border) 16%, transparent)",
      border:
        "1px solid color-mix(in srgb, var(--selected-border) 38%, transparent)",
      whiteSpace: "nowrap",
    },
    timeIconGroup: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "0 2px",
    },
    timeIcon: {
      width: "18px",
      height: "18px",
      display: "block",
      flexShrink: 0,
      color: "var(--text-main)",
    },
    layerSwitchRow: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: "8px",
      flexShrink: 0,
    },
    layerSwitchRowMobile: {
      justifyContent: "flex-start",
    },
    layerSwitchButton: {
      appearance: "none",
      border: `1px solid var(--panel-border)`,
      background: "var(--secondary-bg)",
      color: "var(--secondary-text)",
      borderRadius: "999px",
      padding: "8px 12px",
      fontSize: "12px",
      fontWeight: 800,
      cursor: "pointer",
    },
    layerSwitchButtonActive: {
      background: "var(--primary-bg)",
      color: "var(--primary-text)",
      border: `1px solid var(--primary-border)`,
      boxShadow:
        "0 10px 22px color-mix(in srgb, var(--primary-border) 16%, transparent)",
    },
    spawnInfoSection: {
      display: "grid",
      gap: "12px",
      padding: "14px",
      borderRadius: "16px",
      background: "var(--panel-bg)",
      border: `1px solid var(--panel-border)`,
      boxShadow:
        "0 14px 30px color-mix(in srgb, var(--page-text) 8%, transparent)",
    },
    spawnInfoRow: {
      display: "flex",
      justifyContent: "space-between",
      gap: "12px",
    },
    spawnInfoLabel: {
      minWidth: "42px",
      paddingTop: "6px",
      fontSize: "12px",
      fontWeight: 900,
      letterSpacing: "0.04em",
      color: "var(--text-muted)",
    },
    spawnInfoLabelSub: {
      minWidth: "42px",
      paddingTop: "4px",
      fontSize: "12px",
      fontWeight: 900,
      letterSpacing: "0.04em",
      color: "var(--text-muted)",
    },
    spawnMetaWrap: {
      minWidth: 0,
      flex: 1,
      display: "grid",
      gap: "8px",
    },
    spawnMetaWrapTag: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
    },
    timeTagWrap: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
    },
    tag: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "28px",
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 800,
      lineHeight: 1.2,
      border: `1px solid var(--tag-border)`,
    },
    tagArea: {
      background: "var(--tag-bg)",
      color: "var(--tag-text)",
    },
    tagNight: {
      background: "var(--badge-bg)",
      color: "var(--badge-text)",
    },
    tagDay: {
      background: "var(--selected-bg)",
      color: "var(--secondary-text)",
      border: `1px solid var(--selected-border)`,
    },
    tagAnytime: {
      background: "var(--warning-bg)",
      color: "var(--warning-text)",
      border: `1px solid var(--warning-border)`,
    },
    coordsToggleButton: {
      appearance: "none",
      border: `1px solid var(--input-border)`,
      background: "var(--input-bg)",
      color: "var(--input-text)",
      borderRadius: "999px",
      minHeight: "28px",
      padding: "4px 10px",
      fontSize: "12px",
      fontWeight: 900,
      cursor: "pointer",
    },
    coordsAccordion: {
      display: "grid",
      gap: "10px",
      paddingTop: "4px",
      borderTop: `1px dashed var(--soft-border)`,
    },
    coordsCloseButton: {
      appearance: "none",
      alignSelf: "flex-start",
      border: `1px solid var(--panel-border)`,
      background: "var(--panel-bg)",
      color: "var(--text-sub)",
      borderRadius: "999px",
      padding: "7px 12px",
      fontSize: "12px",
      fontWeight: 800,
      cursor: "pointer",
    },
    mapWrap: {
      minWidth: 0,
    },
  };
}

export default function MonsterMapCard({ mapItem }) {
  const isMobile = useIsMobile();
  const styles = useMemo(() => getStyles(), []);

  
  const layerGroups = useMemo(() => buildLayerGroups(mapItem), [mapItem]);

  const hasLayerSwitch = layerGroups.length > 0;

  const [activeLayerName, setActiveLayerName] = useState(
    layerGroups[0]?.layerName ?? ""
  );

  useEffect(() => {
    if (!hasLayerSwitch) {
      setActiveLayerName("");
      return;
    }

    const exists = layerGroups.some(
      (group) => group.layerName === activeLayerName
    );
    if (!exists) {
      setActiveLayerName(layerGroups[0]?.layerName ?? "");
    }
  }, [activeLayerName, hasLayerSwitch, layerGroups]);

  const activeLayerGroup = useMemo(() => {
    if (!hasLayerSwitch) return null;
    return (
      layerGroups.find((group) => group.layerName === activeLayerName) ??
      layerGroups[0] ??
      null
    );
  }, [activeLayerName, hasLayerSwitch, layerGroups]);

  const displaySpawns = hasLayerSwitch
    ? activeLayerGroup?.spawns ?? []
    : mapItem?.spawns ?? [];

  const displayImagePath = hasLayerSwitch
    ? activeLayerGroup?.imagePath ?? mapItem?.image_path ?? ""
    : mapItem?.image_path ?? mapItem?.image_url ?? "";

  const continentName = getContinentName(mapItem);
  const isHuntingGround = useMemo(
    () => hasHuntingGround(mapItem, displaySpawns),
    [mapItem, displaySpawns]
  );
  const { hasDay, hasNight } = useMemo(
    () => getSpawnTimeFlags(displaySpawns),
    [displaySpawns]
  );

  return (
    <article style={styles.card}>
      <div
        style={{
          ...styles.topRow,
          ...(isMobile ? styles.topRowMobile : {}),
        }}
      >
        <div style={styles.titleWrap}>
          <div style={styles.titleLine}>
            <h3 style={styles.mapTitle}>{mapItem?.name || "マップ"}</h3>

            <div style={styles.titleMetaRow}>
              {continentName ? (
                <span style={styles.continentText}>{continentName}</span>
              ) : null}

              {isHuntingGround ? (
                <span style={styles.huntingBadge}>狩場</span>
              ) : null}

              {hasDay || hasNight ? (
                <span style={styles.timeIconGroup}>
                  {hasDay ? <IoSunnyOutline style={styles.timeIcon} /> : null}
                  {hasNight ? <FaMoon style={styles.timeIcon} /> : null}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {hasLayerSwitch ? (
          <div
            style={{
              ...styles.layerSwitchRow,
              ...(isMobile ? styles.layerSwitchRowMobile : {}),
            }}
          >
            {layerGroups.map((group) => {
              const active = group.layerName === activeLayerName;

              return (
                <button
                  key={group.layerName}
                  type="button"
                  onClick={() => setActiveLayerName(group.layerName)}
                  style={{
                    ...styles.layerSwitchButton,
                    ...(active ? styles.layerSwitchButtonActive : {}),
                  }}
                >
                  {group.layerName}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div style={styles.mapWrap}>
        <MonsterMapOverlay
          spawns={displaySpawns}
          imagePath={displayImagePath}
          href={mapItem?.url}
        />
      </div>
    </article>
  );
}