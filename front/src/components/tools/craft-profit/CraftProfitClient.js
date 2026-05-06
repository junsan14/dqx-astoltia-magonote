"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { clamp0 } from "@/lib/money";
import { fetchItemsByIds } from "@/lib/items";
import { fetchCraftTools, fetchEquipments } from "@/lib/equipments";
import { fetchCrystalRules } from "@/lib/crystalRules";
import CraftProfitHeaderCard from "./CraftProfitHeaderCard";
import CraftProfitMaterialsCard from "./CraftProfitMaterialsCard";
import CraftProfitSkeleton from "@/components/ui/CraftProfitSkeleton";
import EquipmentInfoCard from "./EquipmentInfoCard";
import SalePriceCard from "./SalePriceCard";
import PageHeroTitle from "@/components/PageHeroTitle";
import {
  DEFAULT_FEE_RATE,
  buildInitialUnitCostMap,
  buildMatrix,
  buildSetsFromEquipments,
  calcMaterialCost,
  calcMinRatesToBreakEven,
  calcSlotTotals,
  defaultStarPrices,
  getCrystalInfo,
  getDisplayJobs,
  recommendFromP3,
} from "./craftProfitHelpers";

const TOOL_USES = 30;

function extractEquipmentRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function extractMaterialIds(rows) {
  return Array.from(
    new Set(
      (Array.isArray(rows) ? rows : []).flatMap((row) => {
        let materials = [];

        try {
          const value =
            row?.materialsJson ??
            row?.materials_json ??
            row?.materials ??
            [];

          if (Array.isArray(value)) {
            materials = value;
          } else if (typeof value === "string" && value.trim()) {
            materials = JSON.parse(value);
          }
        } catch (error) {
          console.error("materials parse error", row, error);
          materials = [];
        }

        return materials
          .map((m) =>
            Number(m?.item_id ?? m?.itemId ?? m?.material_id ?? m?.id ?? 0)
          )
          .filter((id) => Number.isInteger(id) && id > 0);
      })
    )
  );
}

function localizeEquipmentRows(rows, locale) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const englishName = String(row?.itemNameEn ?? row?.item_name_en ?? "").trim();
    const japaneseName = row?.itemName ?? row?.item_name ?? row?.name ?? "";

    const englishGroupName = String(
      row?.groupNameEn ?? row?.group_name_en ?? ""
    ).trim();

    const japaneseGroupName =
      row?.groupName ?? row?.group_name ?? "";

    const localizedName = locale === "en" ? englishName : japaneseName;
    const localizedGroupName =
      locale === "en" ? englishGroupName : japaneseGroupName;

    return {
      ...row,
      itemName: localizedName,
      item_name: localizedName,
      name: localizedName,
      groupName: localizedGroupName,
      group_name: localizedGroupName,
    };
  });
}

function katakanaToHiragana(value) {
  return String(value).replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60)
  );
}

function normalizeSearchText(value) {
  return katakanaToHiragana(String(value ?? ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default function CraftProfitClient() {
  const locale = useLocale();

  const [sets, setSets] = useState([]);
  const [craftTools, setCraftTools] = useState([]);
  const [crystalRules, setCrystalRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [setId, setSetId] = useState("");
  const [setQuery, setSetQuery] = useState("");
  const [openSetList, setOpenSetList] = useState(false);

  const [feeRatePct, setFeeRatePct] = useState(DEFAULT_FEE_RATE);
  const [starPrice, setStarPrice] = useState(defaultStarPrices(null));

  const [toolId, setToolId] = useState("none");
  const [toolPriceOverride, setToolPriceOverride] = useState(null);
  const [unitCostMap, setUnitCostMap] = useState({});
  const [activeSlot, setActiveSlot] = useState("その他");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setLoadError("");

        const [equipments, tools, crystalRulesRes] = await Promise.all([
          fetchEquipments(),
          fetchCraftTools(),
          fetchCrystalRules(),
        ]);

        const equipmentRows = localizeEquipmentRows(
          extractEquipmentRows(equipments),
          locale
        );

        const toolRows = localizeEquipmentRows(
          extractEquipmentRows(tools).filter(
            (row) =>
              String(row?.groupKind ?? row?.group_kind ?? "") === "craft_tool_set"
          ),
          locale
        );

        const materialIds = extractMaterialIds(equipmentRows);

        const items = materialIds.length
          ? await fetchItemsByIds(materialIds, locale)
          : [];
        const itemMap = new Map(
          (Array.isArray(items) ? items : []).map((item) => [
            Number(item.id),
            item,
          ])
        );
        
        const nextSets = buildSetsFromEquipments(equipmentRows, itemMap, locale);
        

        if (cancelled) return;

        setSets(Array.isArray(nextSets) ? nextSets : []);
        setCraftTools(Array.isArray(toolRows) ? toolRows : []);
        setCrystalRules(Array.isArray(crystalRulesRes) ? crystalRulesRes : []);
      } catch (error) {
        if (cancelled) return;
        console.error("CraftProfit load error:", error);
        setLoadError("装備データの取得に失敗した");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const selectedSet = useMemo(
    () => sets.find((s) => String(s.id) === String(setId)) || null,
    [sets, setId]
  );

  useEffect(() => {
    if (selectedSet?.name) {
      setSetQuery(selectedSet.name);
      setUnitCostMap(buildInitialUnitCostMap(selectedSet, locale));
      setStarPrice(defaultStarPrices(selectedSet));
    } else {
      setUnitCostMap({});
      setStarPrice(defaultStarPrices(null));
    }
  }, [selectedSet, locale]);

  const filteredSets = useMemo(() => {
    const q = normalizeSearchText(setQuery);
    if (!q) return sets;

    const groupedMatches = [];
    const singleMatches = [];

    for (const s of sets) {
      const top = normalizeSearchText(s.name || "");
      const itemNames = Array.isArray(s.items)
        ? normalizeSearchText(
            s.items.map((it) => String(it.name || "")).join(" ")
          )
        : "";
      const equipLevelText = normalizeSearchText(s.equipLevel ?? "");
      const itemEquipLevels = Array.isArray(s.items)
        ? normalizeSearchText(
            s.items.map((it) => String(it.equipLevel ?? "")).join(" ")
          )
        : "";

      const matched =
        top.includes(q) ||
        itemNames.includes(q) ||
        equipLevelText.includes(q) ||
        itemEquipLevels.includes(q);

      if (!matched) continue;

      if (Array.isArray(s.items) && s.items.length > 1) {
        groupedMatches.push(s);
      } else {
        singleMatches.push(s);
      }
    }

    return [...groupedMatches, ...singleMatches];
  }, [setQuery, sets]);

  const craftType = selectedSet?.craftType;
  const feeRate = useMemo(() => clamp0(feeRatePct) / 100, [feeRatePct]);

  const toolOptions = useMemo(() => {
    const base = [
      {
        id: "none",
        name: locale === "en" ? "None" : "選択なし",
        defaultPrice: 0,
      },
    ];
    if (!craftType) return base;

    const matchersByCraftType = {
      武器鍛冶: ["道具ハンマー", "ハンマー"],
      防具鍛冶: ["道具ハンマー", "ハンマー"],
      道具鍛冶: ["道具ハンマー", "ハンマー"],
      木工: ["道具木工刀", "木工刀"],
      裁縫: ["道具さいほう針", "さいほう針"],
      調理: ["道具フライパン", "フライパン"],
      ランプ錬金: ["道具錬金ランプ", "錬金ランプ"],
      ツボ錬金: ["道具錬金ツボ", "錬金ツボ"],
    };

    const keywords = matchersByCraftType[String(craftType)] ?? [];

    const rows = craftTools.filter((row) => {
      const slotGridType = String(row?.slotGridType ?? row?.slot_grid_type ?? "");
      const itemName = String(row?.itemName ?? row?.item_name ?? row?.name ?? "");
      return keywords.some(
        (keyword) => slotGridType.includes(keyword) || itemName.includes(keyword)
      );
    });

    const mapped = rows
      .map((row) => ({
        id: String(row?.itemId ?? row?.item_id ?? row?.id),
        name: row?.itemName ?? row?.item_name ?? row?.name ?? "名称未設定",
        defaultPrice: Number(
          row?.defaultPrice ??
            row?.default_price ??
            row?.price ??
            row?.buy_price ??
            0
        ),
        craftLevel: Number(row?.craftLevel ?? row?.craft_level ?? 0) || 0,
      }))
      .sort((a, b) => {
        if (a.craftLevel !== b.craftLevel) return a.craftLevel - b.craftLevel;
        return a.name.localeCompare(b.name, locale);
      });

    return [...base, ...mapped];
  }, [craftTools, craftType, locale]);

  useEffect(() => {
    setToolId("none");
    setToolPriceOverride(null);
  }, [craftType]);

  const selectedTool = useMemo(() => {
    return toolOptions.find((t) => t.id === toolId) ?? toolOptions[0];
  }, [toolOptions, toolId]);

  const toolPrice = useMemo(() => {
    return toolPriceOverride == null
      ? selectedTool?.defaultPrice ?? 0
      : Number(toolPriceOverride);
  }, [selectedTool, toolPriceOverride]);

  const toolCostPerCraft = useMemo(() => {
    return clamp0(toolPrice) / TOOL_USES;
  }, [toolPrice]);

  const toolEnabled = useMemo(() => {
    return toolOptions.length > 1 && selectedTool?.id !== "none";
  }, [toolOptions, selectedTool]);

  const mobileToolRow = useMemo(() => {
    if (toolOptions.length <= 1) return null;
    if (!selectedTool || selectedTool.id === "none") return null;

    return {
      name: locale === "en" ? `[Tool] ${selectedTool.name}` : `【道具】${selectedTool.name}`,
      toolPrice,
      toolCostPerCraft,
      onChangeToolPrice: (v) => setToolPriceOverride(v),
    };
  }, [toolOptions, selectedTool, toolPrice, toolCostPerCraft, locale]);

  const matrix = useMemo(() => buildMatrix(selectedSet, locale), [selectedSet, locale]);

  const slots = Array.isArray(matrix?.slots) ? matrix.slots : [];
  const rows = Array.isArray(matrix?.rows) ? matrix.rows : [];
  const slotGrids = matrix?.slotGrids ?? {};
  const slotGridMeta = matrix?.slotGridMeta ?? {};

  useEffect(() => {
    if (slots.length && !slots.includes(activeSlot)) {
      setActiveSlot(slots[0]);
    }
  }, [slots, activeSlot]);

  const onChangeSet = (nextId) => {
    setSetId(nextId);

    const nextSet = sets.find((s) => String(s.id) === String(nextId)) || null;
    if (!nextSet) {
      setSetQuery("");
      return;
    }

    setSetQuery(nextSet.name);
  };

  const updateUnitCost = (materialKey, value) => {
    setUnitCostMap((prev) => ({
      ...prev,
      [materialKey]: Number(value),
    }));
  };

  const materialCost = useMemo(() => {
    return calcMaterialCost(rows, unitCostMap);
  }, [rows, unitCostMap]);

  const slotTotals = useMemo(() => {
    return calcSlotTotals(rows, slots, unitCostMap);
  }, [rows, slots, unitCostMap]);

  const slotTotalsWithTool = useMemo(() => {
    const amount = { ...(slotTotals?.amount ?? {}) };

    if (toolEnabled) {
      for (const slot of slots) {
        amount[slot] = (amount[slot] || 0) + toolCostPerCraft;
      }
    }

    const total = slots.reduce((sum, slot) => sum + (amount[slot] || 0), 0);

    return {
      qty: slotTotals?.qty ?? {},
      amount,
      total,
    };
  }, [slotTotals, toolEnabled, toolCostPerCraft, slots]);

  const partCount = useMemo(() => Math.max(1, slots.length || 0), [slots]);

  const avgMaterialCostPerPart = useMemo(() => {
    return materialCost / partCount;
  }, [materialCost, partCount]);

  const costPerItem = useMemo(() => {
    return avgMaterialCostPerPart + (toolEnabled ? toolCostPerCraft : 0);
  }, [avgMaterialCostPerPart, toolEnabled, toolCostPerCraft]);

  const minRates = useMemo(() => {
    return calcMinRatesToBreakEven({
      feeRate,
      costPerItem,
      starPrice,
      stepPercent: 1,
      locale,
    });
  }, [feeRate, costPerItem, starPrice, locale]);

  const recommend = useMemo(() => {
    if (minRates?.impossible) {
      return {
        label: locale === "en" ? "★☆☆☆☆ (Not recommended)" : "★☆☆☆☆（非推奨）",
        tone: "var(--danger-text)",
        sub:
          locale === "en"
            ? "Even 100% 3★ won't make profit"
            : "100%★3でも黒字にならない",
      };
    }

    return minRates?.ok
      ? recommendFromP3(minRates.p3, locale)
      : recommendFromP3(null, locale);
  }, [minRates, locale]);

  const recommendRate = useMemo(() => {
    if (!minRates?.ok) return 0;
    return Math.max(0, 100 - (Number(minRates.p3) || 0));
  }, [minRates]);

  const displayJobs = useMemo(() => {
    return getDisplayJobs(selectedSet);
  }, [selectedSet]);

  const crystalByEquipLevel = useMemo(() => {
    return getCrystalInfo(selectedSet, crystalRules);
  }, [selectedSet, crystalRules]);

  const pageStyle = {
    backgroundColor: "var(--page-bg)",
    color: "var(--page-text)",
  };

  return (
    <main className="space-y-5 sm:space-y-6 min-h-screen" style={pageStyle}>
      <PageHeroTitle
        kicker="DQX CRAFT TOOL"
        title={locale === "en" ? "Craft Tool" : "職人ツール"}
      />

      {loading ? (
        <div className="space-y-5">
          <CraftProfitSkeleton />
        </div>
      ) : loadError ? (
        <div>{loadError}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-5 items-start">
            <CraftProfitHeaderCard
              setQuery={setQuery}
              setSetQuery={setSetQuery}
              openSetList={openSetList}
              setOpenSetList={setOpenSetList}
              filteredSets={filteredSets}
              onChangeSet={onChangeSet}
              craftType={craftType}
              selectedSet={selectedSet}
              toolId={toolId}
              setToolId={setToolId}
              toolOptions={toolOptions}
              toolPrice={toolPrice}
              setToolPriceOverride={setToolPriceOverride}
            />

            <div className="space-y-5">
              <EquipmentInfoCard
                selectedSet={selectedSet}
                displayJobs={displayJobs}
                crystalByEquipLevel={crystalByEquipLevel}
              />
            </div>
          </div>

          <CraftProfitMaterialsCard
            slots={slots}
            rows={rows}
            slotGrids={slotGrids}
            slotGridMeta={slotGridMeta}
            selectedSet={selectedSet}
            activeSlot={activeSlot}
            setActiveSlot={setActiveSlot}
            unitCostMap={unitCostMap}
            updateUnitCost={updateUnitCost}
            mobileToolRow={mobileToolRow}
            toolEnabled={toolEnabled}
            selectedTool={selectedTool}
            toolPrice={toolPrice}
            setToolPriceOverride={setToolPriceOverride}
            toolCostPerCraft={toolCostPerCraft}
            slotTotalsWithTool={slotTotalsWithTool}
            avgMaterialCostPerPart={avgMaterialCostPerPart}
            costPerItem={costPerItem}
          />

          <SalePriceCard
            feeRatePct={feeRatePct}
            setFeeRatePct={setFeeRatePct}
            starPrice={starPrice}
            setStarPrice={setStarPrice}
            minRates={minRates}
            recommend={recommend}
            recommendRate={recommendRate}
          />
        </>
      )}
    </main>
  );
}