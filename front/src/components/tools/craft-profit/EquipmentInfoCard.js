"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

function normalizeJob(job) {
  if (!job) return null;

  if (typeof job === "string") {
    return {
      key: job,
      name: job,
      source: "unknown",
    };
  }

  return {
    key: String(job.key ?? job.id ?? job.game_job_id ?? job.name ?? ""),
    name: job.name ?? job.label ?? String(job.key ?? job.id ?? ""),
    source: job.source ?? "unknown",
  };
}

function getJobFromEquipableType(item) {
  const job = item?.gameJob ?? item?.game_job ?? item;

  if (!job) return null;

  return {
    id: job.id ?? item?.game_job_id ?? null,
    key: String(job.key ?? job.id ?? item?.game_job_id ?? job.name ?? ""),
    name: job.name ?? String(job.key ?? job.id ?? ""),
    source: "inherit",
  };
}

function getJobFromOverride(item) {
  const job = item?.gameJob ?? item?.game_job ?? null;

  const gameJobId = item?.game_job_id ?? item?.gameJobId ?? job?.id ?? item?.id;

  if (!gameJobId && !job?.name && !item?.name) return null;

  return {
    id: gameJobId ?? null,
    key: String(job?.key ?? item?.key ?? gameJobId ?? job?.name ?? item?.name ?? ""),
    name: job?.name ?? item?.name ?? String(job?.key ?? item?.key ?? gameJobId ?? ""),
    source: "override",
    mode: item?.mode ?? "allow",
  };
}

function uniqueJobs(jobs) {
  const map = new Map();

  jobs.filter(Boolean).forEach((job) => {
    const key = String(job.key ?? job.name ?? "");
    if (!key) return;
    map.set(key, job);
  });

  return Array.from(map.values());
}

function buildJobsFromEquipment(equipment) {
  if (!equipment) return [];

  const mode =
    equipment.jobOverrideMode ??
    equipment.job_override_mode ??
    "inherit";

  const equipmentType =
    equipment.equipmentType ??
    equipment.equipment_type ??
    null;

  const rawEquipableTypes =
    equipmentType?.equipableTypes ??
    equipmentType?.equipable_types ??
    [];

  const inheritedJobs = Array.isArray(rawEquipableTypes)
    ? rawEquipableTypes.map(getJobFromEquipableType).filter(Boolean)
    : [];

  const rawOverrides =
    equipment.jobOverrides ??
    equipment.job_overrides ??
    [];

  const allowJobs = Array.isArray(rawOverrides)
    ? rawOverrides
        .map(getJobFromOverride)
        .filter((job) => job && job.mode !== "deny")
    : [];

  const denyKeys = new Set(
    Array.isArray(rawOverrides)
      ? rawOverrides
          .map(getJobFromOverride)
          .filter((job) => job && job.mode === "deny")
          .map((job) => String(job.key))
      : []
  );

  if (mode === "replace") {
    return uniqueJobs(allowJobs);
  }

  if (mode === "add") {
    return uniqueJobs([...inheritedJobs, ...allowJobs]).filter(
      (job) => !denyKeys.has(String(job.key))
    );
  }

  return uniqueJobs(inheritedJobs).filter(
    (job) => !denyKeys.has(String(job.key))
  );
}

function getMainEquipmentFromSelectedSet(selectedSet) {
  if (!selectedSet) return null;

  if (Array.isArray(selectedSet.items) && selectedSet.items.length) {
    return selectedSet.items[0];
  }

  return selectedSet;
}

export default function EquipmentInfoCard({
  selectedSet,
  displayJobs,
  crystalByEquipLevel,
}) {
  const t = useTranslations("CraftProfit");

  const normalizedDisplayJobs = useMemo(() => {
    if (Array.isArray(displayJobs) && displayJobs.length) {
      return uniqueJobs(displayJobs.map(normalizeJob));
    }

    const equipment = getMainEquipmentFromSelectedSet(selectedSet);
    return buildJobsFromEquipment(equipment);
  }, [displayJobs, selectedSet]);

  return (
    <section
      className="rounded-2xl p-5 shadow-sm space-y-3"
      style={{
        border: "1px solid var(--card-border)",
        backgroundColor: "var(--card-bg)",
      }}
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-title)" }}
        >
          {t("equipment.title")}
        </h2>

        <div className="text-sm" style={{ color: "var(--text-sub)" }}>
          {t("equipment.equipLevel")}
          <span
            className="font-semibold"
            style={{ color: "var(--text-main)" }}
          >
            {selectedSet?.equipLevel ?? selectedSet?.equip_level ?? "—"}
          </span>
        </div>
      </div>

      {Array.isArray(selectedSet?.items) && selectedSet.items.length > 1 ? (
        <div
          className="rounded-2xl p-4"
          style={{
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--soft-bg)",
          }}
        >
          <div
            className="text-xs font-extrabold"
            style={{ color: "var(--text-muted)" }}
          >
            {t("equipment.setContents")}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {selectedSet.items.map((it) => (
              <span
                key={it.id ?? it.itemId ?? it.item_id ?? it.name}
                className="px-3 py-1.5 rounded-full text-[13px] font-extrabold"
                style={{
                  border: "1px solid var(--tag-border)",
                  backgroundColor: "var(--card-bg)",
                  color: "var(--text-main)",
                }}
              >
                {it.slot}：{it.name ?? it.itemName ?? it.item_name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <div
          className="rounded-2xl p-4"
          style={{
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <div
            className="text-xs font-extrabold"
            style={{ color: "var(--text-muted)" }}
          >
            {t("equipment.jobs")}
          </div>

          {normalizedDisplayJobs.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {normalizedDisplayJobs.map((job) => (
                <span
                  key={job.key}
                  className="px-3 py-1.5 rounded-full text-[13px] font-extrabold"
                  title={
                    job.source === "override"
                      ? "この装備だけの追加・置き換え職業"
                      : "装備タイプ由来の職業"
                  }
                  style={{
                    border:
                      job.source === "override"
                        ? "1px solid var(--selected-border)"
                        : "1px solid var(--tag-border)",
                    backgroundColor:
                      job.source === "override"
                        ? "var(--selected-bg)"
                        : "var(--tag-bg)",
                    color: "var(--tag-text)",
                  }}
                >
                  {job.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {t("equipment.noJobs")}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl p-4 space-y-2"
          style={{
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("equipment.crystals")}
          </div>

          {crystalByEquipLevel ? (
            <div
              className="text-sm leading-7"
              style={{ color: "var(--text-main)" }}
            >
              {t("equipment.crystalPattern", {
                plus0: crystalByEquipLevel.plus0,
                plus1: crystalByEquipLevel.plus1,
                plus2: crystalByEquipLevel.plus2,
                plus3: crystalByEquipLevel.plus3,
              })}
            </div>
          ) : (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("equipment.noCrystalInfo")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}