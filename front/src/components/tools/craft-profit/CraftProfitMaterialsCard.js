"use client";

import { useEffect, useMemo, useRef } from "react";
import { clamp0, yen } from "@/lib/money";
import {
  getSlotItemName,
  sortSlots,
  normalizeSlotKey,
} from "./craftProfitHelpers";
import { useLocale, useTranslations } from "next-intl";

function SlotGridView({ grid }) {
  if (!grid) return null;

  const is2DArray =
    Array.isArray(grid) && grid.every((row) => Array.isArray(row));

  if (!is2DArray) return null;

  const rows = grid.length;
  const cols = Math.max(...grid.map((row) => row.length), 0);

  const normalized = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => grid?.[r]?.[c] ?? null)
  );

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <div
        className="grid gap-2 w-full min-w-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {normalized.flat().map((value, i) => {
          const disabled = value == null || value === "";
          return (
            <div
              key={i}
              className="min-h-[48px] rounded-xl border px-2 py-2 flex items-center justify-center text-center"
              style={{
                border: `1px solid ${
                  disabled ? "var(--soft-border)" : "var(--card-border)"
                }`,
                backgroundColor: disabled
                  ? "var(--soft-bg)"
                  : "var(--card-bg)",
                color: disabled ? "var(--text-muted)" : "var(--text-main)",
              }}
            >
              <div className="text-sm font-semibold leading-tight tabular-nums break-words">
                {disabled ? "" : value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getAxisLabel(slot, slotGridMeta, slotItemMap) {
  return (
    slotGridMeta?.[slot]?.label ||
    slotGridMeta?.[slot]?.itemName ||
    slotItemMap?.[slot] ||
    slot
  );
}

function getMobileAxisTitle(slot, slotGridMeta, slotItemMap) {
  return (
    slotGridMeta?.[slot]?.itemName ||
    slotItemMap?.[slot] ||
    slotGridMeta?.[slot]?.label ||
    slot
  );
}

function getAxisItemName(slot, slotGridMeta, selectedSet) {
  return slotGridMeta?.[slot]?.itemName || getSlotItemName(selectedSet, slot);
}

function MobileSlotTabs({
  slots,
  activeSlot,
  onChange,
  slotGridMeta,
  slotItemMap,
}) {
  const safeSlots = Array.isArray(slots) ? slots : [];

  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
      <div className="flex gap-2 py-1">
        {safeSlots.map((s) => {
          const isActive = s === activeSlot;

          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="shrink-0 rounded-full border px-3 py-1 text-sm font-semibold"
              style={{
                border: `1px solid ${
                  isActive ? "var(--selected-border)" : "var(--card-border)"
                }`,
                backgroundColor: isActive
                  ? "var(--primary-bg)"
                  : "var(--card-bg)",
                color: isActive ? "var(--primary-text)" : "var(--text-main)",
              }}
            >
              {getAxisLabel(s, slotGridMeta, slotItemMap)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileMaterialsList({
  slot,
  rows,
  unitCostMap,
  onChangeUnitCost,
  toolRow,
}) {
  const t = useTranslations("CraftProfit");
  const safeRows = Array.isArray(rows) ? rows : [];

  const items = useMemo(() => {
    const out = [];

    if (toolRow) {
      out.push({
        key: "__tool__",
        name: toolRow.name,
        qty: null,
        unit: toolRow.toolPrice,
        amount: toolRow.toolCostPerCraft,
        isTool: true,
        onChangeToolPrice: toolRow.onChangeToolPrice,
      });
    }

    for (const r of safeRows) {
      const qty = Number(r?.perSlotQty?.[slot] || 0);
      if (!qty) continue;

      const unit = clamp0(unitCostMap?.[r.materialKey] ?? 0);

      out.push({
        key: r.materialKey,
        name: r.materialName,
        qty,
        unit,
        amount: qty * unit,
        isTool: false,
      });
    }

    return out;
  }, [slot, safeRows, unitCostMap, toolRow]);

  const totalAmount = useMemo(
    () => items.reduce((sum, x) => sum + clamp0(x.amount), 0),
    [items]
  );

  return (
    <div
      className="rounded-lg overflow-hidden text-[11px]"
      style={{
        border: "1px solid var(--card-border)",
        backgroundColor: "var(--card-bg)",
      }}
    >
      <div
        className="grid grid-cols-[minmax(120px,1fr)_32px_56px_56px] items-center gap-1 py-2 text-[11px] font-semibold text-center border-b"
        style={{
          backgroundColor: "var(--soft-bg)",
          borderColor: "var(--card-border)",
          color: "var(--text-main)",
        }}
      >
        <div className="text-left px-2">{t("materials.materialName")}</div>
        <div>{t("materials.required")}</div>
        <div>{t("materials.amount")}</div>
        <div>{t("materials.unitPrice")}</div>
      </div>

      {items.length ? (
        items.map((x) => (
          <div
            key={x.key}
            className="grid grid-cols-[minmax(120px,1fr)_32px_56px_56px] items-center gap-1 py-1 border-t"
            style={{ borderColor: "var(--card-border)" }}
          >
            <div
              className="truncate font-medium px-2"
              style={{ color: "var(--text-main)" }}
            >
              {x.name}
            </div>

            <div
              className="text-center"
              style={{ color: "var(--text-muted)" }}
            >
              {x.isTool ? "-" : x.qty}
            </div>

            <div
              className="text-center tabular-nums"
              style={{ color: "var(--text-main)" }}
            >
              {yen(x.amount)}
            </div>

            <div className="pr-2">
              <input
                type="number"
                inputMode="numeric"
                className="h-7 w-full text-right rounded px-1 text-[16px] scale-[0.8] origin-right"
                style={{
                  border: "1px solid var(--input-border)",
                  backgroundColor: "var(--input-bg)",
                  color: "var(--input-text)",
                }}
                value={x.unit}
                min={0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (x.isTool) x.onChangeToolPrice(v);
                  else onChangeUnitCost(x.key, v);
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <div
          className="px-3 py-4 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {t("materials.noMaterials")}
        </div>
      )}

      <div
        className="flex justify-end items-center px-2 py-1 font-semibold"
        style={{
          backgroundColor: "var(--soft-bg)",
          color: "var(--text-main)",
        }}
      >
        <span>{t("materials.total")}: {yen(totalAmount)}G</span>
      </div>
    </div>
  );
}

function MobileSlotCarousel({
  slots,
  activeSlot,
  onChange,
  slotGrids,
  slotItemMap,
  slotGridMeta,
  children,
}) {
  const safeSlots = Array.isArray(slots) ? slots : [];
  const scrollerRef = useRef(null);
  const lastActiveRef = useRef(activeSlot);
  const setByScrollRef = useRef(false);
  const scrollEndTimerRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    if (setByScrollRef.current) {
      setByScrollRef.current = false;
      lastActiveRef.current = activeSlot;
      return;
    }

    if (lastActiveRef.current === activeSlot) return;
    lastActiveRef.current = activeSlot;

    const escapedSlot =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(activeSlot)
        : String(activeSlot).replace(/"/g, '\\"');

    const card = el.querySelector(`[data-slot="${escapedSlot}"]`);
    if (!card) return;

    const targetLeft =
      card.offsetLeft - (el.clientWidth / 2 - card.offsetWidth / 2);

    el.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [activeSlot]);

  const syncActiveFromCenter = () => {
    const el = scrollerRef.current;
    if (!el) return;

    const cards = Array.from(el.querySelectorAll("[data-slot]"));
    if (!cards.length) return;

    const center = el.scrollLeft + el.clientWidth / 2;
    let bestSlot = activeSlot;
    let bestDist = Infinity;

    for (const c of cards) {
      const cCenter = c.offsetLeft + c.offsetWidth / 2;
      const d = Math.abs(cCenter - center);
      if (d < bestDist) {
        bestDist = d;
        bestSlot = c.getAttribute("data-slot");
      }
    }

    if (bestSlot && bestSlot !== activeSlot) {
      setByScrollRef.current = true;
      onChange(bestSlot);
    }
  };

  const onScroll = () => {
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => {
      syncActiveFromCenter();
    }, 140);
  };

  return (
    <div className="-mx-4 px-4">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory [-webkit-overflow-scrolling:touch]"
      >
        <div className="shrink-0 w-4" />

        {safeSlots.map((slot) => {
          const grid = slotGrids?.[slot] ?? null;

          return (
            <div
              key={slot}
              data-slot={slot}
              className="shrink-0 w-[92%] snap-center"
            >
              <div className="space-y-3">
                {grid ? (
                  <div
                    className="rounded-2xl p-3 space-y-2"
                    style={{
                      border: "1px solid var(--card-border)",
                      backgroundColor: "var(--soft-bg)",
                    }}
                  >
                    <div
                      className="text-xs font-semibold text-center truncate px-2"
                      style={{ color: "var(--text-sub)" }}
                    >
                      {getMobileAxisTitle(slot, slotGridMeta, slotItemMap)}
                    </div>

                    <div className="min-h-[184px] flex items-center">
                      <div className="w-full">
                        <SlotGridView grid={grid} />
                      </div>
                    </div>
                  </div>
                ) : null}

                {children(slot)}
              </div>
            </div>
          );
        })}

        <div className="shrink-0 w-4" />
      </div>
    </div>
  );
}

export default function CraftProfitMaterialsCard({
  slots,
  rows,
  slotGrids,
  slotGridMeta,
  selectedSet,
  activeSlot,
  setActiveSlot,
  unitCostMap,
  updateUnitCost,
  mobileToolRow,
  toolEnabled,
  selectedTool,
  toolPrice,
  setToolPriceOverride,
  toolCostPerCraft,
  slotTotalsWithTool,
  avgMaterialCostPerPart,
  costPerItem,
}) {
  const t = useTranslations("CraftProfit");
  const locale = useLocale();

  const slotItemMap = useMemo(() => {
    const map = {};
    for (const it of selectedSet?.items || []) {
      const keyById = String(it.id || it.slotKey || it.slot || it.name);
      map[keyById] = it.name;

      const slotKey = normalizeSlotKey(it.slotKey ?? it.slot);
      map[slotKey] = it.name;

      if (it.slot) {
        map[it.slot] = it.name;
      }
    }
    return map;
  }, [selectedSet]);

  const safeSlots = Array.isArray(slots) ? slots : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const sortedSlots = useMemo(() => sortSlots(safeSlots, locale), [safeSlots, locale]);

  useEffect(() => {
    if (!sortedSlots.length) return;
    if (!sortedSlots.includes(activeSlot)) {
      setActiveSlot(sortedSlots[0]);
    }
  }, [sortedSlots, activeSlot, setActiveSlot]);

  return (
    <section
      className="rounded-2xl p-5 shadow-sm space-y-3"
      style={{
        border: "1px solid var(--card-border)",
        backgroundColor: "var(--card-bg)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-title)" }}>
          {t("materials.title")}
        </h2>
      </div>

      <div className="sm:hidden space-y-3">
        <MobileSlotTabs
          slots={sortedSlots}
          activeSlot={activeSlot}
          onChange={setActiveSlot}
          slotGridMeta={slotGridMeta}
          slotItemMap={slotItemMap}
        />

        <MobileSlotCarousel
          slots={sortedSlots}
          activeSlot={activeSlot}
          onChange={setActiveSlot}
          slotGrids={slotGrids}
          slotItemMap={slotItemMap}
          slotGridMeta={slotGridMeta}
        >
          {(slot) => (
            <MobileMaterialsList
              slot={slot}
              rows={safeRows}
              unitCostMap={unitCostMap}
              onChangeUnitCost={updateUnitCost}
              toolRow={mobileToolRow}
            />
          )}
        </MobileSlotCarousel>
      </div>

      <div className="hidden sm:block space-y-3">
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("materials.baseValues")}
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-2">
            {sortedSlots.map((slot) => {
              const grid = slotGrids?.[slot] ?? null;
              const label = getAxisLabel(slot, slotGridMeta, slotItemMap);
              const itemName = getAxisItemName(slot, slotGridMeta, selectedSet);

              if (!grid) return null;

              return (
                <div
                  key={slot}
                  className="w-[220px] shrink-0 rounded-2xl p-4 space-y-2"
                  style={{
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--soft-bg)",
                  }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {label}
                    {itemName && itemName !== label ? (
                      <>
                        <br />
                        {itemName}
                      </>
                    ) : null}
                  </div>

                  <SlotGridView grid={grid} />
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead
                className="border-b"
                style={{
                  backgroundColor: "var(--soft-bg)",
                  borderColor: "var(--card-border)",
                }}
              >
                <tr>
                  <th
                    className="px-3 py-2 text-left font-semibold"
                    style={{ color: "var(--text-sub)" }}
                  >
                    {t("materials.material")}
                  </th>

                  {sortedSlots.map((slot) => (
                    <th
                      key={slot}
                      className="px-3 py-2 text-right font-semibold"
                      style={{ color: "var(--text-sub)" }}
                    >
                      {getAxisLabel(slot, slotGridMeta, slotItemMap)}
                    </th>
                  ))}

                  <th
                    className="px-3 py-2 text-right font-semibold"
                    style={{ color: "var(--text-sub)" }}
                  >
                    {t("materials.total")}
                  </th>
                  <th
                    className="px-3 py-2 text-right font-semibold"
                    style={{ color: "var(--text-sub)" }}
                  >
                    {t("materials.unitPrice")}
                  </th>
                  <th
                    className="px-3 py-2 text-right font-semibold"
                    style={{ color: "var(--text-sub)" }}
                  >
                    {t("materials.amount")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {toolEnabled && selectedTool?.id !== "none" && (
                  <tr
                    className="border-b"
                    style={{
                      borderColor: "var(--card-border)",
                      backgroundColor: "var(--soft-bg)",
                    }}
                  >
                    <td
                      className="px-3 py-2 font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      【{t("materials.tool")}】{selectedTool.name}
                    </td>

                    {sortedSlots.map((slot) => (
                      <td
                        key={slot}
                        className="px-3 py-2 text-right tabular-nums"
                        style={{ color: "var(--text-sub)" }}
                      >
                        —
                      </td>
                    ))}

                    <td
                      className="px-3 py-2 text-right font-semibold tabular-nums"
                      style={{ color: "var(--text-main)" }}
                    >
                      —
                    </td>

                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-24 rounded-lg px-2 py-1 text-right focus:outline-none"
                        style={{
                          border: "1px solid var(--input-border)",
                          backgroundColor: "var(--input-bg)",
                          color: "var(--input-text)",
                        }}
                        value={toolPrice}
                        min={0}
                        onChange={(e) => setToolPriceOverride(Number(e.target.value))}
                      />
                    </td>

                    <td
                      className="px-3 py-2 text-right font-semibold tabular-nums"
                      style={{ color: "var(--text-main)" }}
                    >
                      {yen(toolCostPerCraft)}
                    </td>
                  </tr>
                )}

                {safeRows.map((row) => {
                  const totalQty = Number(row.totalQty || 0);
                  const unit = clamp0(unitCostMap?.[row.materialKey] ?? 0);
                  const amount = totalQty * unit;

                  return (
                    <tr
                      key={row.materialKey}
                      className="border-b"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <td
                        className="px-3 py-2 font-medium"
                        style={{ color: "var(--text-main)" }}
                      >
                        {row.materialName}
                      </td>

                      {sortedSlots.map((slot) => (
                        <td
                          key={slot}
                          className="px-3 py-2 text-right tabular-nums"
                          style={{ color: "var(--text-sub)" }}
                        >
                          {row.perSlotQty?.[slot] || ""}
                        </td>
                      ))}

                      <td
                        className="px-3 py-2 text-right tabular-nums font-semibold"
                        style={{ color: "var(--text-main)" }}
                      >
                        {totalQty}
                      </td>

                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          inputMode="numeric"
                          className="w-24 rounded-lg px-2 py-1 text-right focus:outline-none"
                          style={{
                            border: "1px solid var(--input-border)",
                            backgroundColor: "var(--input-bg)",
                            color: "var(--input-text)",
                          }}
                          value={unit}
                          min={0}
                          onChange={(e) =>
                            updateUnitCost(row.materialKey, Number(e.target.value))
                          }
                        />
                      </td>

                      <td
                        className="px-3 py-2 text-right tabular-nums font-semibold"
                        style={{ color: "var(--text-main)" }}
                      >
                        {yen(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot
                style={{
                  backgroundColor: "var(--soft-bg)",
                  borderTop: "1px solid var(--card-border)",
                }}
              >
                <tr>
                  <td
                    className="px-3 py-2 font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {t("materials.total")}
                  </td>

                  {sortedSlots.map((slot) => (
                    <td
                      key={slot}
                      className="px-3 py-2 text-right tabular-nums font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {yen(slotTotalsWithTool?.amount?.[slot] || 0)}
                    </td>
                  ))}

                  <td />
                  <td
                    className="px-3 py-2 text-right text-xs font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("materials.averagePerSlot")}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {yen(avgMaterialCostPerPart)} / {yen(costPerItem)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}