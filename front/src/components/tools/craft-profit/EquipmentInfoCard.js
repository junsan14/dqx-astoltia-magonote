"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import styles from "./EquipmentInfoCard.module.css";

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
  const gameJobId =
    item?.game_job_id ?? item?.gameJobId ?? job?.id ?? item?.id;

  if (!gameJobId && !job?.name && !item?.name) return null;

  return {
    id: gameJobId ?? null,
    key: String(
      job?.key ?? item?.key ?? gameJobId ?? job?.name ?? item?.name ?? ""
    ),
    name:
      job?.name ??
      item?.name ??
      String(job?.key ?? item?.key ?? gameJobId ?? ""),
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
    equipment.jobOverrideMode ?? equipment.job_override_mode ?? "inherit";
  const equipmentType =
    equipment.equipmentType ?? equipment.equipment_type ?? null;
  const rawEquipableTypes =
    equipmentType?.equipableTypes ?? equipmentType?.equipable_types ?? [];

  const inheritedJobs = Array.isArray(rawEquipableTypes)
    ? rawEquipableTypes.map(getJobFromEquipableType).filter(Boolean)
    : [];

  const rawOverrides =
    equipment.jobOverrides ?? equipment.job_overrides ?? [];

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
    <section className={styles.card}>
      <div className={styles.headingRow}>
        <h2 className={styles.heading}>{t("equipment.title")}</h2>

        <div className={styles.equipLevel}>
          {t("equipment.equipLevel")}
          <span className={styles.equipLevelValue}>
            {selectedSet?.equipLevel ?? selectedSet?.equip_level ?? "—"}
          </span>
        </div>
      </div>

      {Array.isArray(selectedSet?.items) && selectedSet.items.length > 1 ? (
        <div className={styles.setContentsCard}>
          <div className={styles.sectionLabel}>
            {t("equipment.setContents")}
          </div>

          <div className={styles.tagList}>
            {selectedSet.items.map((item) => (
              <span
                key={item.id ?? item.itemId ?? item.item_id ?? item.name}
                className={styles.setTag}
              >
                {item.slot}：{item.name ?? item.itemName ?? item.item_name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.infoGrid}>
        <div className={styles.infoCard}>
          <div className={styles.sectionLabel}>{t("equipment.jobs")}</div>

          {normalizedDisplayJobs.length ? (
            <div className={styles.tagList}>
              {normalizedDisplayJobs.map((job) => (
                <span
                  key={job.key}
                  className={`${styles.jobTag} ${
                    job.source === "override" ? styles.jobTagOverride : ""
                  }`}
                  title={
                    job.source === "override"
                      ? "この装備だけの追加・置き換え職業"
                      : "装備タイプ由来の職業"
                  }
                >
                  {job.name}
                </span>
              ))}
            </div>
          ) : (
            <div className={styles.emptyText}>{t("equipment.noJobs")}</div>
          )}
        </div>

        <div className={styles.infoCard}>
          <div className={styles.crystalLabel}>
            {t("equipment.crystals")}
          </div>

          {crystalByEquipLevel ? (
            <div className={styles.crystalText}>
              {t("equipment.crystalPattern", {
                plus0: crystalByEquipLevel.plus0,
                plus1: crystalByEquipLevel.plus1,
                plus2: crystalByEquipLevel.plus2,
                plus3: crystalByEquipLevel.plus3,
              })}
            </div>
          ) : (
            <div className={styles.emptyText}>
              {t("equipment.noCrystalInfo")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
