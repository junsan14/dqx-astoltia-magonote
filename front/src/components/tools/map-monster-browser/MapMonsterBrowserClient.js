"use client";

import ProgressIntlLink from "@/components/common/ProgressIntlLink";
import SearchableSelect from "@/components/common/SearchableSelect";
import DropdownSelect from "@/components/common/DropdownSelect";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { fetchMaps, fetchMapOptions } from "@/lib/maps";
import { fetchMonsterMapSpawns } from "@/lib/monsterMapSpawns";
import { fetchMonsterDetail } from "@/lib/monsters";
import MonsterMapOverlay from "./MonsterMapOverlay";
import styles from "./MapMonsterBrowser.module.css";
import PageHeroTitle from "@/components/PageHeroTitle";
import MapMonsterBrowserSkeleton from "@/components/ui/MapMonsterBrowserSkeleton";
import {
  MdOutlineSwipe,
  MdOutlineSwipeLeft,
  MdOutlineSwipeRight,
} from "react-icons/md";

function uniqBy(array, keyGetter) {
  const map = new Map();

  for (const item of array) {
    const key = keyGetter(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

function normalizeText(value) {
  return String(value ?? "").trim();
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

function sortJa(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "ja");
}

function useIsMobile(breakpoint = 1200) {
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

function isBrowsableMapType(mapType) {
  const value = normalizeText(mapType).toLowerCase();

  return (
    value === "field" ||
    value === "dungeon" ||
    value === "フィールド" ||
    value === "ダンジョン"
  );
}

function getRelatedMonsterIds(targetMonsterId, monsters = {}) {
  const ids = new Set();

  if (!targetMonsterId) return ids;

  const selected = monsters[targetMonsterId];
  const selectedId = Number(targetMonsterId);

  ids.add(selectedId);

  if (selected?.reincarnation_parent_id) {
    ids.add(Number(selected.reincarnation_parent_id));
  }

  for (const monster of Object.values(monsters)) {
    if (!monster?.id) continue;

    const monsterId = Number(monster.id);
    const parentId = Number(monster.reincarnation_parent_id);

    if (parentId && parentId === selectedId) {
      ids.add(monsterId);
    }

    if (
      selected?.reincarnation_parent_id &&
      parentId === Number(selected.reincarnation_parent_id)
    ) {
      ids.add(monsterId);
    }
  }

  return ids;
}

function getDisplayValue(row, keys = [], fallback = "") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = normalizeText(row?.[key]);
    if (value) return value;
  }

  return fallback;
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function MonsterChip({
  active = false,
  onClick,
  children,
  variant = "default",
  emphasized = false,
  className = "",
}) {
  const stateClass =
    variant === "subtle"
      ? active
        ? styles.chipSubtleActive
        : emphasized
          ? styles.chipSubtleEmphasized
          : styles.chipSubtleIdle
      : active
        ? styles.chipDefaultActive
        : emphasized
          ? styles.chipDefaultEmphasized
          : styles.chipDefaultIdle;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(styles.chip, active && styles.chipActive, stateClass, className)}
    >
      {children}
    </button>
  );
}

function StatBox({ label, value }) {
  if (!normalizeText(value)) return null;

  return (
    <div className={styles.statBox}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}

function AreaBadgeList({ area, initialLimit = 4, t }) {
  const [expanded, setExpanded] = useState(false);

  const cells = parseAreaList(area)
    .map((cell) => String(cell ?? "").trim().toUpperCase())
    .filter(Boolean);

  if (cells.length === 0) {
    return (
      <div className={cn("rounded-2xl px-3 py-3", styles.areaWrap)}>
        <div className={cn("text-sm", styles.areaEmpty)}>
          {t("noAreaInfo")}
        </div>
      </div>
    );
  }

  const visibleCells = expanded ? cells : cells.slice(0, initialLimit);

  return (
    <div className={cn("rounded-2xl px-3 py-3", styles.areaWrap)}>
      <div className={cn("mb-2 text-xs font-semibold", styles.areaTitle)}>
        {t("habitatArea")}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleCells.map((cell, index) => (
          <span
            key={`${cell}-${index}`}
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              styles.areaBadge
            )}
          >
            {cell}
          </span>
        ))}

        {cells.length > initialLimit && !expanded ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              styles.areaMoreButton
            )}
            onClick={() => setExpanded(true)}
          >
            {t("showAll")}
          </button>
        ) : null}

        {expanded && cells.length > initialLimit ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              styles.areaMoreButton
            )}
            onClick={() => setExpanded(false)}
          >
            {t("close")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MonsterSpawnCard({
  spawn,
  monster,
  emphasized = false,
  mobile = false,
  backHref = "/tools/map-monster-browser",
  t,
}) {
  const monsterName = getDisplayValue(
    monster,
    ["monster_name", "name"],
    getDisplayValue(spawn, ["monster_name"], t("unknownMonster"))
  );

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl",
        mobile ? styles.spawnCardMobile : styles.spawnCardDesktop
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-base font-bold", styles.monsterName)}>
              <span className={styles.monsterNameLine}>{monsterName}</span>
            </h3>

            {monster?.system_type ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  emphasized ? styles.badgeSystemActive : styles.badgeSystemIdle
                )}
              >
                {monster.system_type}
              </span>
            ) : null}

            {monster?.is_reincarnated ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  styles.badgeReincarnated
                )}
              >
                {t("reincarnated")}
              </span>
            ) : null}
          </div>
        </div>

        {monster?.id ? (
          <ProgressIntlLink
            href={`/tools/monster-search/${monster.id}?back=${encodeURIComponent(backHref)}`}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              styles.detailLink
            )}
          >
            {t("detail")}
          </ProgressIntlLink>
        ) : null}
      </div>

      <div className="px-4">
        <div className={styles.statGrid}>
          <StatBox label={t("spawnCount")} value={spawn?.spawn_count} />
          <StatBox label={t("symbolCount")} value={spawn?.symbol_count} />
          <StatBox label={t("spawnTime")} value={spawn?.spawn_time} />
        </div>
      </div>

      <div className="px-4 pt-3">
        <StatBox label={t("memo")} value={spawn?.note} />
      </div>

      <div className="px-4 pb-4 pt-3">
        <AreaBadgeList area={spawn?.area} t={t} />
      </div>
    </article>
  );
}

function MonsterSpawnCarousel({
  spawns,
  monstersById,
  selectedSystemType,
  mobile = false,
  backHref = "/tools/map-monster-browser",
  t,
}) {
  const scrollerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    function updateScrollState() {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      const currentLeft = element.scrollLeft;

      setCanScrollLeft(currentLeft > 4);
      setCanScrollRight(currentLeft < maxScrollLeft - 4);
    }

    updateScrollState();

    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [spawns, mobile]);

  if (!spawns.length) return null;

  const showSwipeHint = spawns.length > 1;

  let HintIcon = MdOutlineSwipe;

  if (canScrollLeft && canScrollRight) {
    HintIcon = MdOutlineSwipe;
  } else if (canScrollRight) {
    HintIcon = MdOutlineSwipeRight;
  } else if (canScrollLeft) {
    HintIcon = MdOutlineSwipeLeft;
  }

  const scroller = (
    <div
      ref={scrollerRef}
      className={
        mobile ? styles.cardsMobileScroller : styles.cardsDesktopScroller
      }
    >
      {spawns.map((spawn, index) => {
        const monster = monstersById[spawn.monster_id];
        const emphasized =
          normalizeText(selectedSystemType) &&
          normalizeText(monster?.system_type) === normalizeText(selectedSystemType);

        return (
          <MonsterSpawnCard
            key={spawn.__key || `${spawn.monster_id}-${index}`}
            spawn={spawn}
            monster={monster}
            emphasized={Boolean(emphasized)}
            mobile={mobile}
            backHref={backHref}
            t={t}
          />
        );
      })}
    </div>
  );

  const hint = showSwipeHint ? (
    <div className={styles.swipeHintWrap}>
      <div className={styles.swipeHint}>
        <span className={styles.swipeHintIcon}>
          <HintIcon />
        </span>
      </div>
    </div>
  ) : null;

  if (mobile) {
    return (
      <div className={styles.cardsMobileScrollerOuter}>
        {hint}
        {scroller}
      </div>
    );
  }

  return (
    <div className={styles.cardsDesktopScrollerWrap}>
      {hint}
      {scroller}
    </div>
  );
}

function MapWithCards({
  layer,
  spawns,
  monstersById,
  selectedSystemType,
  isMobile,
  backHref,
  t,
}) {
  if (isMobile) {
    return (
      <div className="grid gap-4">
        <div className={styles.mapMobileBox}>
          <MonsterMapOverlay
            imagePath={layer?.image_path || layer?.image_url || ""}
            spawns={spawns}
            monstersById={monstersById}
            showMonsterNameInBubble
          />
        </div>

        <MonsterSpawnCarousel
          spawns={spawns}
          monstersById={monstersById}
          selectedSystemType={selectedSystemType}
          mobile
          backHref={backHref}
          t={t}
        />
      </div>
    );
  }

  return (
    <div className={styles.mapAndCardsDesktop}>
      <div className={styles.mapDesktopBox}>
        <MonsterMapOverlay
          imagePath={layer?.image_path || layer?.image_url || ""}
          spawns={spawns}
          monstersById={monstersById}
          showMonsterNameInBubble
        />
      </div>

      <MonsterSpawnCarousel
        spawns={spawns}
        monstersById={monstersById}
        selectedSystemType={selectedSystemType}
        backHref={backHref}
        t={t}
      />
    </div>
  );
}

function LayerSection({
  layer,
  spawns,
  monstersById,
  selectedMonsterId,
  selectedSystemType,
  relatedSelectedMonsterIds,
  isMobile,
  backHref,
  t,
}) {
  const filteredLayerSpawns = useMemo(() => {
    return spawns.filter((spawn) => {
      const monster = monstersById[spawn.monster_id];

      if (
        selectedMonsterId &&
        !relatedSelectedMonsterIds.has(Number(spawn.monster_id))
      ) {
        return false;
      }

      if (
        selectedSystemType &&
        normalizeText(monster?.system_type) !== normalizeText(selectedSystemType)
      ) {
        return false;
      }

      return true;
    });
  }, [
    spawns,
    monstersById,
    selectedMonsterId,
    selectedSystemType,
    relatedSelectedMonsterIds,
  ]);

  if (filteredLayerSpawns.length === 0) return null;

  const layerTitle =
    getDisplayValue(layer, ["map_layer_name", "layer_name"]) ||
    t("floorLabel", { floor: layer?.floor_no ?? "" });

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl",
        styles.layerSection,
        isMobile ? styles.layerSectionMobile : styles.layerSectionDesktop
      )}
    >
      <div className={cn("px-4 py-3", styles.cardHeader)}>
        <div className={cn("text-sm font-semibold", styles.cardHeaderTitle)}>
          {layerTitle}
        </div>
      </div>

      <div className={cn("p-4", !isMobile && styles.layerBodyDesktop)}>
        <MapWithCards
          layer={layer}
          spawns={filteredLayerSpawns}
          monstersById={monstersById}
          selectedSystemType={selectedSystemType}
          isMobile={isMobile}
          backHref={backHref}
          t={t}
        />
      </div>
    </section>
  );
}

function LayerCarousel({
  sections,
  monstersById,
  selectedSystemType,
  isMobile,
  backHref,
  t,
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [sections]);

  if (sections.length === 0) return null;

  const current = sections[activeIndex] ?? null;
  if (!current) return null;

  if (isMobile) {
    return (
      <section className={cn("overflow-hidden rounded-2xl", styles.card)}>
        <div className={cn("px-4 py-3", styles.cardHeader)}>
          <div className={styles.mobileLayerHeader}>
            <div className={cn("text-xs", styles.cardHeaderSub)}>
              {activeIndex + 1} / {sections.length}
            </div>

            <div className={styles.mobileLayerTabs}>
              {sections.map((section, index) => {
                const active = index === activeIndex;
                const layerTitle =
                  getDisplayValue(section.layer, ["map_layer_name", "layer_name"]) ||
                  t("floorLabel", { floor: section.layer?.floor_no ?? "" });

                return (
                  <button
                    key={section.layer.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "shrink-0",
                      styles.layerTab,
                      active ? styles.layerTabActive : styles.layerTabIdle
                    )}
                  >
                    {layerTitle}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4">
          <MapWithCards
            layer={current.layer}
            spawns={current.spawns}
            monstersById={monstersById}
            selectedSystemType={selectedSystemType}
            isMobile
            backHref={backHref}
            t={t}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl",
        styles.card,
        styles.layerSectionDesktop
      )}
    >
      <div className={cn("px-4 py-3", styles.cardHeader)}>
        <div className="flex flex-wrap items-center gap-2">
          {sections.map((section, index) => {
            const active = index === activeIndex;
            const layerTitle =
              getDisplayValue(section.layer, ["map_layer_name", "layer_name"]) ||
              t("floorLabel", { floor: section.layer?.floor_no ?? "" });

            return (
              <button
                key={section.layer.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  styles.layerTab,
                  active ? styles.layerTabActive : styles.layerTabIdle
                )}
              >
                {layerTitle}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("p-4", styles.layerBodyDesktop)}>
        <MapWithCards
          layer={current.layer}
          spawns={current.spawns}
          monstersById={monstersById}
          selectedSystemType={selectedSystemType}
          isMobile={false}
          backHref={backHref}
          t={t}
        />
      </div>
    </section>
  );
}

async function fetchMonsterDetailsInBatches(ids, locale, batchSize = 12) {
  const results = [];

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const rows = await Promise.all(
      batch.map(async (id) => {
        try {
          return await fetchMonsterDetail(id, locale);
        } catch (error) {
          console.error(`Failed to load monster ${id}`, error);
          return null;
        }
      })
    );

    results.push(...rows.filter(Boolean));
  }

  return results;
}

export default function MapMonsterBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("MapMonsterBrowser");
  const isMobile = useIsMobile();

  const labels = useMemo(() => {
    const isJapanese = String(locale).toLowerCase().startsWith("ja");

    return isJapanese
      ? {
          searchMethod: "検索方法",
          searchByMap: "地名で探す",
          searchBySystem: "モンスター系統で探す",
          systemSearch: "モンスター系統",
          selectSystem: "系統を選択してください",
          loadingSystems: "系統データを読み込み中...",
          noSystems: "この大陸には系統データがありません",
          filteredMapSearch: "該当する地名",
          selectSystemFirst: "先にモンスター系統を選択してください",
          matchedMaps: (count) => `該当する地名 ${count}件`,
          selectedSystem: (systemType) => `「${systemType}」が出現する地名だけを表示中`,
        }
      : {
          searchMethod: "Search method",
          searchByMap: "Search by map",
          searchBySystem: "Search by monster family",
          systemSearch: "Monster family",
          selectSystem: "Select a monster family",
          loadingSystems: "Loading monster families...",
          noSystems: "No monster family data is available for this continent",
          filteredMapSearch: "Matching maps",
          selectSystemFirst: "Select a monster family first",
          matchedMaps: (count) => `${count} matching maps`,
          selectedSystem: (systemType) =>
            `Showing only maps where “${systemType}” appears`,
        };
  }, [locale]);

  const [continents, setContinents] = useState([]);
  const [maps, setMaps] = useState([]);
  const [allSpawns, setAllSpawns] = useState([]);
  const [monsterMaster, setMonsterMaster] = useState({});
  const [monsterMasterLocale, setMonsterMasterLocale] = useState(locale);
  const [resolvedMonsterIds, setResolvedMonsterIds] = useState(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [loadingMonsterMaster, setLoadingMonsterMaster] = useState(false);
  const [error, setError] = useState("");

  const [selectedContinentId, setSelectedContinentId] = useState("");
  const [searchMode, setSearchMode] = useState("map");
  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState("all");
  const [selectedMonsterId, setSelectedMonsterId] = useState("");
  const [selectedSystemType, setSelectedSystemType] = useState("");

  function syncUrl({
    continentId = selectedContinentId,
    mapId = selectedMapId,
    layerId = selectedLayerId,
    mode = searchMode,
    systemType = selectedSystemType,
  } = {}) {
    const params = new URLSearchParams(searchParams?.toString() || "");

    if (continentId) params.set("continentId", String(continentId));
    else params.delete("continentId");

    if (mapId) params.set("mapId", String(mapId));
    else params.delete("mapId");

    if (layerId && layerId !== "all") params.set("layerId", String(layerId));
    else params.delete("layerId");

    if (mode === "system") params.set("searchMode", "system");
    else params.delete("searchMode");

    if (systemType) params.set("systemType", systemType);
    else params.delete("systemType");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const nextContinentId = searchParams?.get("continentId") ?? "";
    const nextMapId = searchParams?.get("mapId") ?? "";
    const nextLayerId = searchParams?.get("layerId") ?? "all";
    const nextSearchMode =
      searchParams?.get("searchMode") === "system" ? "system" : "map";
    const nextSystemType = searchParams?.get("systemType") ?? "";

    setSelectedContinentId((previous) =>
      previous === nextContinentId ? previous : nextContinentId
    );
    setSelectedMapId((previous) =>
      previous === nextMapId ? previous : nextMapId
    );
    setSelectedLayerId((previous) =>
      previous === nextLayerId ? previous : nextLayerId
    );
    setSearchMode((previous) =>
      previous === nextSearchMode ? previous : nextSearchMode
    );
    setSelectedSystemType((previous) =>
      previous === nextSystemType ? previous : nextSystemType
    );
  }, [searchParams]);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      setLoading(true);
      setError("");

      try {
        const [mapOptions, mapRows, spawnRows] = await Promise.all([
          fetchMapOptions(locale),
          fetchMaps("", locale),
          fetchMonsterMapSpawns(undefined, locale),
        ]);

        if (ignore) return;

        const nextContinents = Array.isArray(mapOptions?.continents)
          ? [...mapOptions.continents]
              .filter((row) => row && row.id != null)
              .sort((a, b) => {
                const aOrder = Number(a?.display_id ?? 0);
                const bOrder = Number(b?.display_id ?? 0);
                if (aOrder !== bOrder) return aOrder - bOrder;

                return sortJa(
                  getDisplayValue(a, ["continent_name", "name"]),
                  getDisplayValue(b, ["continent_name", "name"])
                );
              })
          : [];

        const nextMaps = Array.isArray(mapRows)
          ? mapRows.filter((row) => isBrowsableMapType(row?.map_type))
          : [];

        setMaps(nextMaps);
        setAllSpawns(Array.isArray(spawnRows) ? spawnRows : []);
        setContinents(nextContinents);
      } catch (bootstrapError) {
        console.error(bootstrapError);
        if (!ignore) setError(bootstrapError?.message || t("loadFailed"));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [locale, t]);

  const selectedContinent = useMemo(() => {
    return (
      continents.find(
        (continent) => Number(continent.id) === Number(selectedContinentId)
      ) ?? null
    );
  }, [continents, selectedContinentId]);

  const mapsInContinent = useMemo(() => {
    const rows = selectedContinentId
      ? maps.filter(
          (row) => Number(row.continent_id) === Number(selectedContinentId)
        )
      : [];

    return [...rows].sort((a, b) =>
      sortJa(
        getDisplayValue(a, ["map_name", "name"]),
        getDisplayValue(b, ["map_name", "name"])
      )
    );
  }, [maps, selectedContinentId]);

  const mapIdsInContinent = useMemo(() => {
    return new Set(mapsInContinent.map((map) => Number(map.id)));
  }, [mapsInContinent]);

  const spawnsInContinent = useMemo(() => {
    if (!selectedContinentId || mapIdsInContinent.size === 0) return [];

    return allSpawns.filter((spawn) =>
      mapIdsInContinent.has(Number(spawn.map_id))
    );
  }, [allSpawns, mapIdsInContinent, selectedContinentId]);

  const selectedMap = useMemo(() => {
    return maps.find((row) => Number(row.id) === Number(selectedMapId)) ?? null;
  }, [maps, selectedMapId]);

  const mapLayers = useMemo(() => {
    return Array.isArray(selectedMap?.layers) ? selectedMap.layers : [];
  }, [selectedMap]);

  const spawnsForSelectedMap = useMemo(() => {
    if (!selectedMapId) return [];

    return allSpawns.filter(
      (row) => Number(row.map_id) === Number(selectedMapId)
    );
  }, [allSpawns, selectedMapId]);

  const monsterIdsToLoad = useMemo(() => {
    const source = searchMode === "system" ? spawnsInContinent : spawnsForSelectedMap;

    return Array.from(
      new Set(source.map((spawn) => Number(spawn.monster_id)).filter(Boolean))
    );
  }, [searchMode, spawnsInContinent, spawnsForSelectedMap]);

  useEffect(() => {
    let ignore = false;
    const localeChanged = monsterMasterLocale !== locale;

    if (monsterIdsToLoad.length === 0) {
      setLoadingMonsterMaster(false);

      if (localeChanged) {
        setMonsterMaster({});
        setResolvedMonsterIds(new Set());
        setMonsterMasterLocale(locale);
      }

      return undefined;
    }

    const resolvedIds = localeChanged ? new Set() : resolvedMonsterIds;
    const missingIds = monsterIdsToLoad.filter(
      (id) => !resolvedIds.has(Number(id))
    );

    if (missingIds.length === 0) {
      setLoadingMonsterMaster(false);
      return undefined;
    }

    async function fillMonsterDetails() {
      setLoadingMonsterMaster(true);

      try {
        const results = await fetchMonsterDetailsInBatches(missingIds, locale);
        if (ignore) return;

        setMonsterMaster((previous) => {
          const next = localeChanged ? {} : { ...previous };

          for (const row of results) {
            if (row?.id) next[row.id] = row;
          }

          return next;
        });
        setResolvedMonsterIds((previous) => {
          const next = localeChanged ? new Set() : new Set(previous);
          for (const id of missingIds) next.add(Number(id));
          return next;
        });
        setMonsterMasterLocale(locale);
      } finally {
        if (!ignore) setLoadingMonsterMaster(false);
      }
    }

    fillMonsterDetails();

    return () => {
      ignore = true;
    };
  }, [
    locale,
    monsterIdsToLoad,
    monsterMasterLocale,
    resolvedMonsterIds,
  ]);

  const monsterDetailsReady = useMemo(() => {
    if (monsterMasterLocale !== locale) return false;

    return monsterIdsToLoad.every((id) =>
      resolvedMonsterIds.has(Number(id))
    );
  }, [
    locale,
    monsterIdsToLoad,
    monsterMasterLocale,
    resolvedMonsterIds,
  ]);

  const systemTypesInContinent = useMemo(() => {
    return Array.from(
      new Set(
        spawnsInContinent
          .map((spawn) => monsterMaster[spawn.monster_id]?.system_type)
          .map(normalizeText)
          .filter(Boolean)
      )
    ).sort((a, b) => sortJa(a, b));
  }, [spawnsInContinent, monsterMaster]);

  const mapIdsForSelectedSystem = useMemo(() => {
    if (!selectedSystemType) return new Set();

    const target = normalizeText(selectedSystemType);
    const ids = new Set();

    for (const spawn of spawnsInContinent) {
      const monster = monsterMaster[spawn.monster_id];
      if (normalizeText(monster?.system_type) === target) {
        ids.add(Number(spawn.map_id));
      }
    }

    return ids;
  }, [spawnsInContinent, monsterMaster, selectedSystemType]);

  const mapsForSearch = useMemo(() => {
    if (searchMode !== "system") return mapsInContinent;
    if (!selectedSystemType) return [];

    return mapsInContinent.filter((map) =>
      mapIdsForSelectedSystem.has(Number(map.id))
    );
  }, [
    searchMode,
    mapsInContinent,
    selectedSystemType,
    mapIdsForSelectedSystem,
  ]);

  useEffect(() => {
    if (!selectedContinentId || continents.length === 0) return;

    const exists = continents.some(
      (continent) => Number(continent.id) === Number(selectedContinentId)
    );

    if (!exists) {
      setSelectedContinentId("");
      setSelectedMapId("");
      setSelectedLayerId("all");
      setSelectedMonsterId("");
      setSelectedSystemType("");
      syncUrl({
        continentId: "",
        mapId: "",
        layerId: "all",
        systemType: "",
      });
    }
  }, [continents, selectedContinentId]);

  useEffect(() => {
    if (!selectedMapId) return;
    if (searchMode === "system" && !monsterDetailsReady) return;
    if (searchMode === "system" && !selectedSystemType) return;

    const exists = mapsForSearch.some(
      (row) => Number(row.id) === Number(selectedMapId)
    );

    if (!exists) {
      setSelectedMapId("");
      setSelectedLayerId("all");
      setSelectedMonsterId("");
      syncUrl({ mapId: "", layerId: "all" });
    }
  }, [
    mapsForSearch,
    selectedMapId,
    searchMode,
    selectedSystemType,
    monsterDetailsReady,
  ]);

  useEffect(() => {
    if (!selectedLayerId || selectedLayerId === "all") return;

    const exists = mapLayers.some(
      (layer) => Number(layer.id) === Number(selectedLayerId)
    );

    if (!exists) {
      setSelectedLayerId("all");
      setSelectedMonsterId("");
      syncUrl({ layerId: "all" });
    }
  }, [mapLayers, selectedLayerId]);

  const candidateSpawns = useMemo(() => {
    if (!selectedMapId) return [];
    if (selectedLayerId === "all") return spawnsForSelectedMap;

    return spawnsForSelectedMap.filter(
      (spawn) => Number(spawn.map_layer_id) === Number(selectedLayerId)
    );
  }, [selectedMapId, spawnsForSelectedMap, selectedLayerId]);

  const monstersOnCurrentScope = useMemo(() => {
    const rows = candidateSpawns
      .map((spawn) => monsterMaster[spawn.monster_id])
      .filter(Boolean);

    return uniqBy(rows, (row) => row.id).sort((a, b) => {
      const aOrder = Number(a?.display_order ?? 999999);
      const bOrder = Number(b?.display_order ?? 999999);
      if (aOrder !== bOrder) return aOrder - bOrder;

      return sortJa(
        getDisplayValue(a, ["monster_name", "name"]),
        getDisplayValue(b, ["monster_name", "name"])
      );
    });
  }, [candidateSpawns, monsterMaster]);

  const monstersVisibleInAside = useMemo(() => {
    if (!selectedSystemType) return monstersOnCurrentScope;

    const target = normalizeText(selectedSystemType);
    return monstersOnCurrentScope.filter(
      (monster) => normalizeText(monster?.system_type) === target
    );
  }, [monstersOnCurrentScope, selectedSystemType]);

  const relatedSelectedMonsterIds = useMemo(() => {
    if (!selectedMonsterId) return new Set();
    return getRelatedMonsterIds(selectedMonsterId, monsterMaster);
  }, [selectedMonsterId, monsterMaster]);

  const systemTypesOnCurrentScope = useMemo(() => {
    return Array.from(
      new Set(
        monstersOnCurrentScope
          .map((row) => normalizeText(row.system_type))
          .filter(Boolean)
      )
    ).sort((a, b) => sortJa(a, b));
  }, [monstersOnCurrentScope]);

  const filteredSpawns = useMemo(() => {
    return candidateSpawns.filter((spawn) => {
      const monster = monsterMaster[spawn.monster_id];

      if (
        selectedMonsterId &&
        !relatedSelectedMonsterIds.has(Number(spawn.monster_id))
      ) {
        return false;
      }

      if (
        selectedSystemType &&
        normalizeText(monster?.system_type) !== normalizeText(selectedSystemType)
      ) {
        return false;
      }

      return true;
    });
  }, [
    candidateSpawns,
    monsterMaster,
    selectedMonsterId,
    selectedSystemType,
    relatedSelectedMonsterIds,
  ]);

  const layerSections = useMemo(() => {
    if (!selectedMap) return [];

    const layers = Array.isArray(selectedMap.layers) ? selectedMap.layers : [];

    return layers
      .map((layer) => {
        const layerSpawns = filteredSpawns.filter(
          (spawn) => Number(spawn.map_layer_id) === Number(layer.id)
        );

        return {
          layer,
          spawns: layerSpawns.map((spawn, index) => ({
            ...spawn,
            __key: `${layer.id}-${spawn.monster_id}-${index}`,
          })),
        };
      })
      .filter((section) => section.spawns.length > 0);
  }, [selectedMap, filteredSpawns]);

  useEffect(() => {
    if (!selectedMonsterId) return;

    const exists = candidateSpawns.some(
      (spawn) =>
        relatedSelectedMonsterIds.has(Number(spawn.monster_id)) ||
        Number(spawn.monster_id) === Number(selectedMonsterId)
    );

    if (!exists) setSelectedMonsterId("");
  }, [candidateSpawns, selectedMonsterId, relatedSelectedMonsterIds]);

  useEffect(() => {
    if (!selectedSystemType || searchMode === "system" || loadingMonsterMaster) {
      return;
    }

    const exists = systemTypesOnCurrentScope.some(
      (systemType) =>
        normalizeText(systemType) === normalizeText(selectedSystemType)
    );

    if (!exists) {
      setSelectedSystemType("");
      syncUrl({ systemType: "" });
    }
  }, [
    systemTypesOnCurrentScope,
    selectedSystemType,
    searchMode,
    loadingMonsterMaster,
  ]);

  function handleContinentChange(value) {
    setSelectedContinentId(value);
    setSelectedMapId("");
    setSelectedLayerId("all");
    setSelectedMonsterId("");
    setSelectedSystemType("");

    syncUrl({
      continentId: value,
      mapId: "",
      layerId: "all",
      systemType: "",
    });
  }

  function handleSearchModeChange(nextMode) {
    const normalizedMode = nextMode === "system" ? "system" : "map";

    setSearchMode(normalizedMode);
    setSelectedMapId("");
    setSelectedLayerId("all");
    setSelectedMonsterId("");
    setSelectedSystemType("");

    syncUrl({
      mode: normalizedMode,
      mapId: "",
      layerId: "all",
      systemType: "",
    });
  }

  function handleSearchSystemChange(systemType) {
    setSelectedSystemType(systemType);
    setSelectedMapId("");
    setSelectedLayerId("all");
    setSelectedMonsterId("");

    syncUrl({
      mapId: "",
      layerId: "all",
      mode: "system",
      systemType,
    });
  }

  function handleMapChange(value) {
    const nextSystemType = searchMode === "system" ? selectedSystemType : "";

    setSelectedMapId(value);
    setSelectedLayerId("all");
    setSelectedMonsterId("");
    setSelectedSystemType(nextSystemType);

    syncUrl({
      mapId: value,
      layerId: "all",
      systemType: nextSystemType,
    });
  }

  function handleLayerChange(nextLayerId) {
    setSelectedLayerId(nextLayerId);
    setSelectedMonsterId("");
    syncUrl({ layerId: nextLayerId });
  }

  function handleMonsterToggle(monsterId) {
    if (Number(selectedMonsterId) === Number(monsterId)) {
      setSelectedMonsterId("");
      return;
    }

    setSelectedMonsterId(monsterId);

    if (searchMode !== "system") {
      setSelectedSystemType("");
      syncUrl({ systemType: "" });
    }
  }

  function handleSystemTypeToggle(systemType) {
    const isActive =
      normalizeText(selectedSystemType) === normalizeText(systemType);

    if (isActive && searchMode === "system") return;

    const nextSystemType = isActive ? "" : systemType;
    setSelectedSystemType(nextSystemType);
    setSelectedMonsterId("");
    syncUrl({ systemType: nextSystemType });
  }

  const shouldUseCarousel =
    selectedLayerId === "all" && layerSections.length > 1;

  const backHref = useMemo(() => {
    const query = searchParams?.toString?.() || "";
    return query
      ? `/tools/map-monster-browser?${query}`
      : "/tools/map-monster-browser";
  }, [searchParams]);

  const continentLabel = getDisplayValue(
    selectedMap,
    ["continent_name", "continent"],
    getDisplayValue(selectedContinent, ["continent_name", "name"], "")
  );

  const mapLabel = getDisplayValue(selectedMap, ["map_name", "name"], "");

  const mapSearchDisabled =
    !selectedContinentId ||
    (searchMode === "system" &&
      (!selectedSystemType || !monsterDetailsReady));

  const mapPlaceholder = !selectedContinentId
    ? t("selectContinentFirst")
    : searchMode === "system" && !monsterDetailsReady
      ? labels.loadingSystems
      : searchMode === "system" && !selectedSystemType
        ? labels.selectSystemFirst
        : t("mapPlaceholder");

  return (
    <main className={styles.page}>
      <PageHeroTitle kicker="DQX MAP DATABASE" title={t("title")} />

      <div className={styles.filterPanel}>
        <div className={styles.filterField}>
          <span className={styles.labelText}>{t("continent")}</span>
          <SearchableSelect
            disabled={loading}
            value={loading ? "" : selectedContinentId}
            onChange={handleContinentChange}
            options={continents}
            selectOnFocus
            placeholder={
              loading ? t("loadingContinentData") : t("continentPlaceholder")
            }
            emptyText={t("noCandidates")}
            ariaLabel={t("continent")}
            getOptionValue={(option) => option?.id}
            getOptionLabel={(option) =>
              getDisplayValue(option, ["continent_name", "name"], "")
            }
            getOptionSearchText={(option) =>
              [
                getDisplayValue(option, ["continent_name", "name"], ""),
                normalizeText(option?.continent_name_en ?? option?.name_en),
              ]
                .filter(Boolean)
                .join(" ")
            }
            sortOptions={(a, b) => {
              const aOrder = Number(a?.display_order ?? 0);
              const bOrder = Number(b?.display_order ?? 0);

              if (aOrder !== bOrder) return aOrder - bOrder;

              return sortJa(
                getDisplayValue(a, ["continent_name", "name"]),
                getDisplayValue(b, ["continent_name", "name"])
              );
            }}
          />
        </div>

        <div className={styles.filterField}>
          <span className={styles.labelText}>{labels.searchMethod}</span>
          <DropdownSelect
            value={searchMode}
            onChange={handleSearchModeChange}
            ariaLabel={labels.searchMethod}
            options={[
              { value: "map", label: labels.searchByMap },
              { value: "system", label: labels.searchBySystem },
            ]}
          />
        </div>

        {searchMode === "system" ? (
          <div className={styles.filterField}>
            <span className={styles.labelText}>{labels.systemSearch}</span>
            <DropdownSelect
              value={selectedSystemType}
              onChange={handleSearchSystemChange}
              disabled={!selectedContinentId || !monsterDetailsReady}
              ariaLabel={labels.systemSearch}
              options={[
                {
                  value: "",
                  label: !selectedContinentId
                    ? labels.selectSystem
                    : !monsterDetailsReady
                      ? labels.loadingSystems
                      : systemTypesInContinent.length === 0
                        ? labels.noSystems
                        : labels.selectSystem,
                },
                ...systemTypesInContinent.map((systemType) => ({
                  value: systemType,
                  label: systemType,
                })),
              ]}
            />
          </div>
        ) : null}

        <div
          className={cn(
            styles.filterField,
            styles.mapField,
            searchMode === "map" && styles.mapFieldWide
          )}
        >
          <span className={styles.labelText}>
            {searchMode === "system" ? labels.filteredMapSearch : t("mapSearch")}
          </span>
          <SearchableSelect
            disabled={mapSearchDisabled}
            value={selectedMapId}
            onChange={handleMapChange}
            options={mapsForSearch}
            placeholder={mapPlaceholder}
            selectOnFocus
            emptyText={t("noCandidates")}
            ariaLabel={
              searchMode === "system" ? labels.filteredMapSearch : t("mapSearch")
            }
            getOptionValue={(option) => option?.id}
            getOptionLabel={(option) =>
              getDisplayValue(option, ["map_name", "name"], "")
            }
            getOptionSearchText={(option) =>
              [
                getDisplayValue(option, ["map_name", "name"], ""),
                normalizeText(option?.map_name_en ?? option?.name_en),
              ]
                .filter(Boolean)
                .join(" ")
            }
            sortOptions={(a, b) =>
              sortJa(
                getDisplayValue(a, ["map_name", "name"]),
                getDisplayValue(b, ["map_name", "name"])
              )
            }
          />
          {searchMode === "system" && selectedSystemType && monsterDetailsReady ? (
            <div className={styles.searchInfo}>
              {labels.matchedMaps(mapsForSearch.length)}
            </div>
          ) : null}
        </div>

        <div className={styles.filterField}>
          <span className={styles.labelText}>{t("displayLayer")}</span>
          <DropdownSelect
            value={selectedLayerId}
            onChange={handleLayerChange}
            disabled={!selectedMap}
            ariaLabel={t("displayLayer")}
            options={[
              { value: "all", label: t("all") },
              ...mapLayers.map((layer) => ({
                value: String(layer.id),
                label:
                  getDisplayValue(layer, ["map_layer_name", "layer_name"]) ||
                  t("floorLabel", { floor: layer.floor_no ?? "" }),
              })),
            ]}
          />
        </div>
      </div>

      {searchMode === "system" && selectedSystemType ? (
        <div className={styles.searchInfo}>
          {labels.selectedSystem(selectedSystemType)}
        </div>
      ) : null}

      {loading ? (
        <>
          <div className={cn("mt-6 p-4", styles.loadingBox)}>
            {t("loadingContinentData")}
          </div>
          <MapMonsterBrowserSkeleton />
        </>
      ) : null}

      {error ? (
        <div className={cn("mt-6 p-4", styles.errorBox)}>{error}</div>
      ) : null}

      {!loading && !error ? (
        <div
          className={cn(
            "mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]",
            styles.pageColumnsDesktop
          )}
        >
          <aside className={cn("rounded-2xl p-4", styles.asideCard)}>
            {selectedMap ? (
              <>
                <div className={cn("text-sm", styles.continentText)}>
                  {continentLabel}
                </div>

                <h2 className={cn("mt-1 text-xl font-bold", styles.mapTitle)}>
                  {mapLabel}
                </h2>

                <div className={cn("mt-2 text-sm", styles.countText)}>
                  {t("countShown", { count: filteredSpawns.length })}
                </div>

                <div className="mt-6">
                  <div
                    className={cn(
                      "mb-2 text-sm font-semibold",
                      styles.sectionTitle
                    )}
                  >
                    {t("systemType")}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {systemTypesOnCurrentScope.length === 0 ? (
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm",
                          styles.emptyDashed
                        )}
                      >
                        {t("noSystemType")}
                      </div>
                    ) : (
                      systemTypesOnCurrentScope.map((systemType) => (
                        <MonsterChip
                          key={systemType}
                          active={
                            normalizeText(systemType) ===
                            normalizeText(selectedSystemType)
                          }
                          onClick={() => handleSystemTypeToggle(systemType)}
                        >
                          {systemType}
                        </MonsterChip>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div
                    className={cn(
                      "mb-2 text-sm font-semibold",
                      styles.sectionTitle
                    )}
                  >
                    {t("monster")}
                  </div>

                  <div className={styles.monsterGrid}>
                    {monstersVisibleInAside.length === 0 ? (
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm",
                          styles.emptyDashed,
                          styles.monsterGridEmpty
                        )}
                      >
                        {t("noMonster")}
                      </div>
                    ) : (
                      monstersVisibleInAside.map((monster) => {
                        const emphasized =
                          selectedMonsterId &&
                          relatedSelectedMonsterIds.has(Number(monster.id));

                        const monsterLabel = getDisplayValue(
                          monster,
                          ["monster_name", "name"],
                          t("unknownMonster")
                        );

                        return (
                          <MonsterChip
                            key={monster.id}
                            active={
                              Number(selectedMonsterId) === Number(monster.id)
                            }
                            emphasized={Boolean(emphasized)}
                            onClick={() => handleMonsterToggle(monster.id)}
                            className={styles.monsterGridChip}
                          >
                            <span className={styles.monsterGridChipContent}>
                              <span className={styles.monsterGridChipName}>
                                {monsterLabel}
                              </span>
                              {monster.is_reincarnated ? (
                                <span
                                  className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                    styles.reincarnationMiniBadge,
                                    styles.monsterGridReincarnationBadge
                                  )}
                                >
                                  {t("reincarnated")}
                                </span>
                              ) : null}
                            </span>
                          </MonsterChip>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div
                className={cn(
                  "rounded-2xl px-4 py-5 text-sm",
                  styles.emptyDashed
                )}
              >
                {t("emptyGuide")}
              </div>
            )}
          </aside>

          <div className={styles.rightColumnDesktop}>
            {!selectedMap ? (
              <div
                className={cn(
                  "rounded-2xl px-4 py-5 text-sm",
                  styles.emptyDashed
                )}
              >
                {t("selectMap")}
              </div>
            ) : selectedLayerId !== "all" ? (
              <LayerSection
                layer={
                  mapLayers.find(
                    (layer) => Number(layer.id) === Number(selectedLayerId)
                  ) ?? null
                }
                spawns={filteredSpawns}
                monstersById={monsterMaster}
                selectedMonsterId={selectedMonsterId}
                selectedSystemType={selectedSystemType}
                relatedSelectedMonsterIds={relatedSelectedMonsterIds}
                isMobile={isMobile}
                backHref={backHref}
                t={t}
              />
            ) : shouldUseCarousel ? (
              <LayerCarousel
                sections={layerSections}
                monstersById={monsterMaster}
                selectedSystemType={selectedSystemType}
                isMobile={isMobile}
                backHref={backHref}
                t={t}
              />
            ) : layerSections.length > 0 ? (
              <div className="grid gap-4">
                {layerSections.map((section) => (
                  <LayerSection
                    key={section.layer.id}
                    layer={section.layer}
                    spawns={section.spawns}
                    monstersById={monsterMaster}
                    selectedMonsterId={selectedMonsterId}
                    selectedSystemType={selectedSystemType}
                    relatedSelectedMonsterIds={relatedSelectedMonsterIds}
                    isMobile={isMobile}
                    backHref={backHref}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-2xl px-4 py-5 text-sm",
                  styles.emptyDashed
                )}
              >
                {t("noMatchedMonster")}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
