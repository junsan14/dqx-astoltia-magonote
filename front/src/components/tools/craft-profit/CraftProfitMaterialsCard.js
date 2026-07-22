"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { clamp0, yen } from "@/lib/money";
import {
  getSlotItemName,
  normalizeSlotKey,
  sortSlots,
} from "./craftProfitHelpers";
import styles from "./CraftProfitMaterialsCard.module.css";

function SlotGridView({ grid }) {
  if (!grid) return null;

  const is2DArray =
    Array.isArray(grid) && grid.every((row) => Array.isArray(row));

  if (!is2DArray) return null;

  const rows = grid.length;
  const cols = Math.max(...grid.map((row) => row.length), 0);

  if (!rows || !cols) return null;

  const normalized = Array.from({ length: rows }, (_, rowIndex) =>
    Array.from(
      { length: cols },
      (_, columnIndex) => grid?.[rowIndex]?.[columnIndex] ?? null
    )
  );

  return (
    <div className={styles.slotGridViewport}>
      <div
        className={styles.slotGrid}
        style={{ "--slot-grid-columns": cols }}
      >
        {normalized.flat().map((value, index) => {
          const disabled = value == null || value === "";

          return (
            <div
              key={`${index}-${String(value ?? "empty")}`}
              className={`${styles.slotGridCell} ${
                disabled ? styles.slotGridCellDisabled : ""
              }`}
            >
              <div className={styles.slotGridValue}>
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

const moneyFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

function normalizeMoneyValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.trunc(numericValue));
}

function formatMoneyValue(value) {
  return moneyFormatter.format(normalizeMoneyValue(value));
}

function parseMoneyValue(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function MoneyInput({ value, onChange, className, ariaLabel }) {
  const handleFocus = (event) => {
    const input = event.currentTarget;

    requestAnimationFrame(() => {
      input.select();
    });
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9,]*"
      autoComplete="off"
      className={className}
      value={formatMoneyValue(value)}
      aria-label={ariaLabel}
      onFocus={handleFocus}
      onChange={(event) => onChange(parseMoneyValue(event.target.value))}
    />
  );
}

function MobileSlotTabs({
  slots,
  activeSlot,
  onChange,
  slotGridMeta,
  slotItemMap,
}) {
  const safeSlots = Array.isArray(slots) ? slots : [];
  const tabListRef = useRef(null);
  const tabRefs = useRef(new Map());

  useEffect(() => {
    const activeButton = tabRefs.current.get(activeSlot);
    const tabList = tabListRef.current;

    if (!activeButton || !tabList) return;

    const buttonCenter = activeButton.offsetLeft + activeButton.offsetWidth / 2;
    const targetLeft = buttonCenter - tabList.clientWidth / 2;

    tabList.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [activeSlot]);

  return (
    <div className={styles.mobileTabsFullBleed}>
      <div
        ref={tabListRef}
        className={styles.mobileTabsScroller}
        role="tablist"
        aria-label="装備部位"
      >
        {safeSlots.map((slot) => {
          const isActive = slot === activeSlot;

          return (
            <button
              key={slot}
              ref={(node) => {
                if (node) tabRefs.current.set(slot, node);
                else tabRefs.current.delete(slot);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.mobileTab} ${
                isActive ? styles.mobileTabActive : ""
              }`}
              onClick={() => onChange(slot)}
            >
              {getAxisLabel(slot, slotGridMeta, slotItemMap)}
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
  recommendedPrices,
}) {
  const t = useTranslations("CraftProfit");
  const locale = useLocale();
  const safeRows = Array.isArray(rows) ? rows : [];

  const items = useMemo(() => {
    const result = [];

    if (toolRow) {
      result.push({
        key: "__tool__",
        name: toolRow.name,
        qty: null,
        unit: toolRow.toolPrice,
        amount: toolRow.toolCostPerCraft,
        isTool: true,
        onChangeToolPrice: toolRow.onChangeToolPrice,
      });
    }

    for (const row of safeRows) {
      const qty = Number(row?.perSlotQty?.[slot] || 0);
      if (!qty) continue;

      const unit = clamp0(unitCostMap?.[row.materialKey] ?? 0);

      result.push({
        key: row.materialKey,
        name: row.materialName,
        qty,
        unit,
        amount: qty * unit,
        isTool: false,
      });
    }

    return result;
  }, [slot, safeRows, unitCostMap, toolRow]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + clamp0(item.amount), 0),
    [items]
  );

  return (
    <div className={styles.mobileMaterialTable}>
      <div className={styles.mobileMaterialHeader}>
        <div className={styles.mobileMaterialNameHeader}>
          {t("materials.materialName")}
        </div>
        <div>{t("materials.required")}</div>
        <div>{t("materials.amount")}</div>
        <div>{t("materials.unitPrice")}</div>
      </div>

      {items.length ? (
        items.map((item) => (
          <div key={item.key} className={styles.mobileMaterialRow}>
            <div className={styles.mobileMaterialName}>{item.name}</div>

            <div className={styles.mobileMutedCell}>
              {item.isTool ? "-" : item.qty}
            </div>

            <div className={styles.mobileNumberCell}>{yen(item.amount)}</div>

            <div className={styles.mobileUnitInputWrap}>
              <MoneyInput
                className={styles.mobileUnitInput}
                value={item.unit}
                ariaLabel={`${item.name} ${t("materials.unitPrice")}`}
                onChange={(value) => {
                  if (item.isTool) item.onChangeToolPrice(value);
                  else onChangeUnitCost(item.key, value);
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <div className={styles.mobileEmpty}>{t("materials.noMaterials")}</div>
      )}

      <div className={styles.mobileMaterialTotal}>
        <span>
          {t("materials.total")}: {yen(totalAmount)}G
        </span>
      </div>

      <div className={styles.mobileRecommendedPriceHeading}>
        {locale === "en" ? "Recommended prices" : "販売目安価格"}
      </div>

      {[
        ["star0", "☆☆☆"],
        ["star1", "★☆☆"],
        ["star2", "★★☆"],
        ["star3", "★★★"],
      ].map(([key, label]) => (
        <div key={key} className={styles.mobileRecommendedPriceRow}>
          <span className={styles.mobileRecommendedPriceLabel}>{label}</span>
          <span className={styles.mobileRecommendedPriceValue}>
            {recommendedPrices ? `${yen(recommendedPrices[key])}G` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function getNearestSlot(scroller) {
  if (!scroller) return null;

  const cards = Array.from(scroller.querySelectorAll("[data-slot-card]"));
  if (!cards.length) return null;

  const center = scroller.scrollLeft + scroller.clientWidth / 2;
  let nearestSlot = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(cardCenter - center);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestSlot = card.getAttribute("data-slot-card");
    }
  }

  return nearestSlot;
}

function getCardForSlot(scroller, slot) {
  if (!scroller || slot == null) return null;

  return Array.from(scroller.querySelectorAll("[data-slot-card]")).find(
    (card) => card.getAttribute("data-slot-card") === String(slot)
  );
}

function scrollCardToCenter(scroller, card, behavior = "smooth") {
  if (!scroller || !card) return;

  const targetLeft =
    card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2;
  const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);

  scroller.scrollTo({
    left: Math.min(maxLeft, Math.max(0, targetLeft)),
    behavior,
  });
}

function MobileSlotCarousel({
  slots,
  activeSlot,
  onChange,
  slotGrids,
  slotItemMap,
  slotGridMeta,
  navigationSourceRef,
  tabRequestVersion,
  children,
}) {
  const safeSlots = Array.isArray(slots) ? slots : [];
  const scrollerRef = useRef(null);
  const activeSlotRef = useRef(activeSlot);
  const previousActiveRef = useRef(null);
  const animationFrameRef = useRef(null);
  const scrollEndTimerRef = useRef(null);
  const targetSlotRef = useRef(null);

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  const syncActiveFromCenter = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const nearestSlot = getNearestSlot(scroller);
    if (!nearestSlot || nearestSlot === activeSlotRef.current) return;

    navigationSourceRef.current = "swipe";
    activeSlotRef.current = nearestSlot;
    onChange(nearestSlot);
  }, [navigationSourceRef, onChange]);

  const finishScrolling = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const nearestSlot = getNearestSlot(scroller);

    if (
      navigationSourceRef.current !== "tab" &&
      nearestSlot &&
      nearestSlot !== activeSlotRef.current
    ) {
      navigationSourceRef.current = "swipe";
      activeSlotRef.current = nearestSlot;
      onChange(nearestSlot);
    }

    targetSlotRef.current = null;
    navigationSourceRef.current = "idle";
  }, [navigationSourceRef, onChange]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    const handleNativeScrollEnd = () => finishScrolling();
    scroller.addEventListener("scrollend", handleNativeScrollEnd);

    return () => {
      scroller.removeEventListener("scrollend", handleNativeScrollEnd);
    };
  }, [finishScrolling]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !activeSlot) return;

    if (navigationSourceRef.current === "swipe") {
      previousActiveRef.current = activeSlot;
      return;
    }

    if (previousActiveRef.current === activeSlot) return;

    const card = getCardForSlot(scroller, activeSlot);
    if (!card) return;

    const isInitialPosition = previousActiveRef.current == null;
    previousActiveRef.current = activeSlot;
    targetSlotRef.current = activeSlot;

    scrollCardToCenter(
      scroller,
      card,
      isInitialPosition ? "auto" : "smooth"
    );
  }, [activeSlot, navigationSourceRef, tabRequestVersion]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, []);

  const startUserSwipe = () => {
    targetSlotRef.current = null;
    navigationSourceRef.current = "swipe";

    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = null;
    }
  };

  const handleScroll = () => {
    if (animationFrameRef.current) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;

      // A tab click may pass across several cards. Keep the clicked tab active
      // until the programmatic smooth scroll finishes.
      if (navigationSourceRef.current !== "tab") {
        syncActiveFromCenter();
      }
    });

    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }

    // Fallback for browsers where the scrollend event is unavailable or late.
    scrollEndTimerRef.current = setTimeout(finishScrolling, 110);
  };

  return (
    <div className={styles.mobileCarouselFullBleed}>
      <div
        ref={scrollerRef}
        className={styles.mobileCarousel}
        onPointerDown={startUserSwipe}
        onTouchStart={startUserSwipe}
        onScroll={handleScroll}
      >
        {safeSlots.map((slot) => {
          const grid = slotGrids?.[slot] ?? null;
          const isActive = slot === activeSlot;

          return (
            <div
              key={slot}
              data-slot-card={slot}
              role="tabpanel"
              aria-hidden={!isActive}
              className={styles.mobileSlide}
            >
              <div className={styles.mobileSlideContent}>
                {grid ? (
                  <div className={styles.mobileGridCard}>
                    <div className={styles.mobileGridTitle}>
                      {getMobileAxisTitle(slot, slotGridMeta, slotItemMap)}
                    </div>

                    <div className={styles.mobileGridBody}>
                      <SlotGridView grid={grid} />
                    </div>
                  </div>
                ) : null}

                {children(slot)}
              </div>
            </div>
          );
        })}
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
  slotPricing,
}) {
  const t = useTranslations("CraftProfit");
  const locale = useLocale();
  const navigationSourceRef = useRef("idle");
  const [tabRequestVersion, setTabRequestVersion] = useState(0);

  const slotItemMap = useMemo(() => {
    const map = {};

    for (const item of selectedSet?.items || []) {
      const keyById = String(
        item.id || item.slotKey || item.slot || item.name
      );
      map[keyById] = item.name;

      const slotKey = normalizeSlotKey(item.slotKey ?? item.slot);
      map[slotKey] = item.name;

      if (item.slot) map[item.slot] = item.name;
    }

    return map;
  }, [selectedSet]);

  const safeSlots = Array.isArray(slots) ? slots : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const sortedSlots = useMemo(
    () => sortSlots(safeSlots, locale),
    [safeSlots, locale]
  );

  useEffect(() => {
    if (!sortedSlots.length) return;

    if (!sortedSlots.includes(activeSlot)) {
      navigationSourceRef.current = "idle";
      setActiveSlot(sortedSlots[0]);
    }
  }, [sortedSlots, activeSlot, setActiveSlot]);

  const handleTabChange = useCallback(
    (slot) => {
      navigationSourceRef.current = "tab";
      setActiveSlot(slot);
      setTabRequestVersion((version) => version + 1);
    },
    [setActiveSlot]
  );

  const handleCarouselChange = useCallback(
    (slot) => {
      setActiveSlot(slot);
    },
    [setActiveSlot]
  );

  return (
    <section className={styles.card}>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>{t("materials.title")}</h2>
      </div>

      <div className={styles.mobileOnly}>
        <MobileSlotTabs
          slots={sortedSlots}
          activeSlot={activeSlot}
          onChange={handleTabChange}
          slotGridMeta={slotGridMeta}
          slotItemMap={slotItemMap}
        />

        <MobileSlotCarousel
          slots={sortedSlots}
          activeSlot={activeSlot}
          onChange={handleCarouselChange}
          slotGrids={slotGrids}
          slotItemMap={slotItemMap}
          slotGridMeta={slotGridMeta}
          navigationSourceRef={navigationSourceRef}
          tabRequestVersion={tabRequestVersion}
        >
          {(slot) => (
            <MobileMaterialsList
              slot={slot}
              rows={safeRows}
              unitCostMap={unitCostMap}
              onChangeUnitCost={updateUnitCost}
              toolRow={mobileToolRow}
              recommendedPrices={slotPricing?.[slot]?.prices}
            />
          )}
        </MobileSlotCarousel>
      </div>

      <div className={styles.desktopOnly}>
        <div className={styles.baseValueLabel}>
          {t("materials.baseValues")}
        </div>

        <div className={styles.desktopGridScroller}>
          <div className={styles.desktopGridList}>
            {sortedSlots.map((slot) => {
              const grid = slotGrids?.[slot] ?? null;
              const label = getAxisLabel(slot, slotGridMeta, slotItemMap);
              const itemName = getAxisItemName(
                slot,
                slotGridMeta,
                selectedSet
              );

              if (!grid) return null;

              return (
                <div key={slot} className={styles.desktopGridCard}>
                  <div className={styles.desktopGridTitle}>
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

        <div className={styles.desktopTableCard}>
          <div className={styles.desktopTableScroller}>
            <table className={styles.desktopTable}>
              <thead className={styles.desktopTableHead}>
                <tr>
                  <th className={styles.leftHeader}>
                    {t("materials.material")}
                  </th>

                  {sortedSlots.map((slot) => (
                    <th key={slot} className={styles.numberHeader}>
                      {getAxisLabel(slot, slotGridMeta, slotItemMap)}
                    </th>
                  ))}

                  <th className={styles.numberHeader}>
                    {t("materials.total")}
                  </th>
                  <th className={styles.numberHeader}>
                    {t("materials.unitPrice")}
                  </th>
                  <th className={styles.numberHeader}>
                    {t("materials.amount")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {toolEnabled && selectedTool?.id !== "none" && (
                  <tr className={styles.toolRow}>
                    <td className={styles.materialCell}>
                      【{t("materials.tool")}】{selectedTool.name}
                    </td>

                    {sortedSlots.map((slot) => (
                      <td key={slot} className={styles.mutedNumberCell}>
                        —
                      </td>
                    ))}

                    <td className={styles.strongNumberCell}>—</td>

                    <td className={styles.inputCell}>
                      <MoneyInput
                        className={styles.desktopInput}
                        value={toolPrice}
                        ariaLabel={`${selectedTool.name} ${t("materials.unitPrice")}`}
                        onChange={setToolPriceOverride}
                      />
                    </td>

                    <td className={styles.strongNumberCell}>
                      {yen(toolCostPerCraft)}
                    </td>
                  </tr>
                )}

                {safeRows.map((row) => {
                  const totalQty = Number(row.totalQty || 0);
                  const unit = clamp0(unitCostMap?.[row.materialKey] ?? 0);
                  const amount = totalQty * unit;

                  return (
                    <tr key={row.materialKey} className={styles.bodyRow}>
                      <td className={styles.materialCell}>
                        {row.materialName}
                      </td>

                      {sortedSlots.map((slot) => (
                        <td key={slot} className={styles.mutedNumberCell}>
                          {row.perSlotQty?.[slot] || ""}
                        </td>
                      ))}

                      <td className={styles.strongNumberCell}>{totalQty}</td>

                      <td className={styles.inputCell}>
                        <MoneyInput
                          className={styles.desktopInput}
                          value={unit}
                          ariaLabel={`${row.materialName} ${t("materials.unitPrice")}`}
                          onChange={(value) =>
                            updateUnitCost(row.materialKey, value)
                          }
                        />
                      </td>

                      <td className={styles.strongNumberCell}>{yen(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className={styles.desktopTableFoot}>
                <tr className={styles.totalRow}>
                  <td className={styles.materialCell}>
                    {t("materials.total")}
                  </td>

                  {sortedSlots.map((slot) => (
                    <td key={slot} className={styles.strongNumberCell}>
                      {yen(slotTotalsWithTool?.amount?.[slot] || 0)}
                    </td>
                  ))}

                  <td colSpan={3} />

                </tr>

                <tr className={styles.recommendedPriceHeadingRow}>
                  <td
                    colSpan={sortedSlots.length + 4}
                    className={styles.recommendedPriceHeading}
                  >
                    {locale === "en"
                      ? "Recommended prices"
                      : "適正売値価格"}
                  </td>
                </tr>

                {[
                  ["star0", "☆☆☆"],
                  ["star1", "★☆☆"],
                  ["star2", "★★☆"],
                  ["star3", "★★★"],
                ].map(([key, label]) => (
                  <tr key={key} className={styles.recommendedPriceRow}>
                    <td className={styles.recommendedPriceLabel}>{label}</td>

                    {sortedSlots.map((slot) => (
                      <td key={slot} className={styles.recommendedPriceValue}>
                        {slotPricing?.[slot]?.prices
                          ? yen(slotPricing[slot].prices[key])
                          : "—"}
                      </td>
                    ))}

                    <td colSpan={3} />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
