"use client";

import { useTranslations } from "next-intl";

export default function SalePriceCard({
  feeRatePct,
  setFeeRatePct,
  starPrice,
  setStarPrice,
  minRates,
  recommend,
  recommendRate,
}) {
  const t = useTranslations("CraftProfit");

  const recommendTone =
    recommend?.tone && recommend.tone.startsWith("var(")
      ? recommend.tone
      : "var(--text-main)";

  return (
    <section
      className="rounded-2xl p-5 shadow-sm space-y-4"
      style={{
        border: "1px solid var(--card-border)",
        backgroundColor: "var(--card-bg)",
      }}
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        <div
          className="text-sm font-semibold"
          style={{ color: "var(--text-title)" }}
        >
          {t("salePrice.title")}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("salePrice.fee")}
          </span>

          <div className="relative w-20">
            <input
              type="number"
              value={feeRatePct}
              onChange={(e) => setFeeRatePct(Number(e.target.value))}
              className="w-full text-base origin-right scale-90 rounded-lg px-2 py-1 pr-5 text-right"
              style={{
                border: "1px solid var(--input-border)",
                backgroundColor: "var(--input-bg)",
                color: "var(--input-text)",
              }}
            />
            <span
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              %
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["star0", t("salePrice.star0")],
          ["star1", t("salePrice.star1")],
          ["star2", t("salePrice.star2")],
          ["star3", t("salePrice.star3")],
        ].map(([k, label]) => (
          <div
            key={k}
            className="rounded-2xl p-3"
            style={{
              border: "1px solid var(--card-border)",
              backgroundColor: "var(--soft-bg)",
            }}
          >
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {label}
            </div>

            <input
              type="number"
              inputMode="numeric"
              className="mt-1 w-full rounded-xl px-3 py-2 text-right"
              style={{
                border: "1px solid var(--input-border)",
                backgroundColor: "var(--input-bg)",
                color: "var(--input-text)",
              }}
              value={starPrice[k]}
              min={0}
              onChange={(e) =>
                setStarPrice((prev) => ({
                  ...prev,
                  [k]: Number(e.target.value),
                }))
              }
            />
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4 space-y-4"
        style={{
          border: "1px solid var(--card-border)",
          backgroundColor: "var(--soft-bg)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              {t("salePrice.recommendTitle")}
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {t("salePrice.recommendHelp")}
            </div>
          </div>

          <div
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold"
            style={
              minRates?.impossible
                ? {
                    border: "1px solid var(--danger-border)",
                    backgroundColor: "var(--danger-bg)",
                    color: "var(--danger-text)",
                  }
                : {
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--card-bg)",
                    color: "var(--text-main)",
                  }
            }
          >
            {recommend.label}
          </div>
        </div>

        <div
          className="rounded-2xl px-4 py-5 text-center shadow-sm"
          style={{
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <div
            className="text-5xl font-black leading-none tabular-nums"
            style={{ color: recommendTone }}
          >
            {recommendRate}%
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { key: "p3", star: t("salePrice.star3"), value: minRates?.p3 ?? 0, note: t("salePrice.requiredRate") },
            { key: "p2", star: t("salePrice.star2"), value: minRates?.p2 ?? 0, note: t("salePrice.requiredRate") },
            { key: "p1", star: t("salePrice.star1"), value: minRates?.p1 ?? 0, note: t("salePrice.remaining") },
          ].map((item) => (
            <div
              key={item.key}
              className="rounded-2xl p-3 text-center shadow-sm"
              style={{
                border: "1px solid var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <div
                className="text-sm font-black tracking-wider"
                style={{ color: "var(--text-main)" }}
              >
                {item.star}
              </div>
              <div
                className="mt-1 text-2xl font-black tabular-nums"
                style={{ color: "var(--text-main)" }}
              >
                {item.value}%
              </div>
              <div
                className="mt-1 text-[11px] font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                {item.note}
              </div>
            </div>
          ))}
        </div>

        {(recommend.sub || minRates?.note) && (
          <div
            className="rounded-xl px-3 py-2 text-xs"
            style={
              minRates?.impossible
                ? {
                    border: "1px solid var(--danger-border)",
                    backgroundColor: "var(--danger-bg)",
                    color: "var(--danger-text)",
                  }
                : {
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--card-bg)",
                    color: "var(--text-muted)",
                  }
            }
          >
            {recommend.sub || minRates?.note}
          </div>
        )}
      </div>
    </section>
  );
}