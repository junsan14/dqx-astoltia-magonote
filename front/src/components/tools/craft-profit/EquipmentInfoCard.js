//装備情報
"use client";

import { useEffect, useMemo, useState } from "react";
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

function getEquipmentItems(selectedSet) {
  if (!selectedSet) return [];

  if (Array.isArray(selectedSet.items) && selectedSet.items.length) {
    return selectedSet.items;
  }

  return [selectedSet];
}

function parseEffects(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
}

const STATUS_FIELDS = [
  {
    key: "max_hp",
    camelKey: "maxHp",
    label: "さいだいHP",
    aliases: ["さいだいhp", "最大hp"],
  },
  {
    key: "max_mp",
    camelKey: "maxMp",
    label: "さいだいMP",
    aliases: ["さいだいmp", "最大mp"],
  },
  {
    key: "attack",
    camelKey: "attack",
    label: "こうげき力",
    aliases: ["こうげき力", "攻撃力"],
  },
  {
    key: "defense",
    camelKey: "defense",
    label: "しゅび力",
    aliases: ["しゅび力", "守備力"],
  },
  {
    key: "charm",
    camelKey: "charm",
    label: "おしゃれさ",
    aliases: ["おしゃれさ", "みりょく", "魅力"],
  },
  {
    key: "agility",
    camelKey: "agility",
    label: "すばやさ",
    aliases: ["すばやさ"],
  },
  {
    key: "dexterity",
    camelKey: "dexterity",
    label: "きようさ",
    aliases: ["きようさ"],
  },
  {
    key: "magic_attack",
    camelKey: "magicAttack",
    label: "こうげき魔力",
    aliases: ["こうげき魔力", "攻撃魔力"],
  },
  {
    key: "healing_power",
    camelKey: "healingPower",
    label: "かいふく魔力",
    aliases: ["かいふく魔力", "回復魔力"],
  },
  {
    key: "weight",
    camelKey: "weight",
    label: "おもさ",
    aliases: ["おもさ", "重さ"],
  },
];

function normalizeEffectText(effect) {
  if (typeof effect === "string") return effect.trim();

  if (effect && typeof effect === "object") {
    return String(effect.text ?? effect.name ?? effect.label ?? "").trim();
  }

  return "";
}

function normalizeComparableText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export default function EquipmentInfoCard({
  selectedSet,
  displayJobs,
  crystalByEquipLevel,
}) {
  const t = useTranslations("CraftProfit");
  // PC・SPともに初期状態は閉じる。
  const [isOpen, setIsOpen] = useState(false);
  const [activeStatusItemKey, setActiveStatusItemKey] = useState("");

  const normalizedDisplayJobs = useMemo(() => {
    if (Array.isArray(displayJobs) && displayJobs.length) {
      return uniqueJobs(displayJobs.map(normalizeJob));
    }

    const equipment = getMainEquipmentFromSelectedSet(selectedSet);
    return buildJobsFromEquipment(equipment);
  }, [displayJobs, selectedSet]);

  const statusItems = useMemo(() => {
    return getEquipmentItems(selectedSet).map((item, index) => {
      const key = String(
        item?.id ??
          item?.itemId ??
          item?.item_id ??
          item?.slotKey ??
          item?.slot ??
          item?.name ??
          index
      );

      const statuses = STATUS_FIELDS.map((field) => {
        const rawValue = item?.[field.camelKey] ?? item?.[field.key];
        const value = Number(rawValue);

        return {
          ...field,
          value: Number.isFinite(value) ? value : 0,
        };
      }).filter((field) => field.value !== 0);

      return {
        key,
        name: item?.name ?? item?.itemName ?? item?.item_name ?? "",
        slot: item?.slot ?? item?.slotName ?? item?.slot_name ?? "その他",
        statuses,
      };
    });
  }, [selectedSet]);

  useEffect(() => {
    setActiveStatusItemKey(statusItems[0]?.key ?? "");
  }, [selectedSet, statusItems]);

  const activeStatusItem = useMemo(() => {
    return (
      statusItems.find((item) => item.key === activeStatusItemKey) ??
      statusItems[0] ??
      null
    );
  }, [activeStatusItemKey, statusItems]);

  const baseEffectAliases = useMemo(() => {
    return STATUS_FIELDS.flatMap((status) =>
      status.aliases.map(normalizeComparableText)
    );
  }, []);

  const equipmentEffects = useMemo(() => {
    const uniqueEffects = new Map();

    getEquipmentItems(selectedSet)
      .flatMap((item) =>
        parseEffects(item.effectsJson ?? item.effects_json ?? item.effects)
      )
      .map(normalizeEffectText)
      .filter(Boolean)
      .forEach((effect) => {
        const comparable = normalizeComparableText(effect);

        // 基礎効果欄に表示しているHP・攻撃力などは装備効果から除外する。
        const overlapsBaseStatus = baseEffectAliases.some((alias) =>
          comparable.startsWith(alias)
        );

        if (!overlapsBaseStatus && !uniqueEffects.has(comparable)) {
          uniqueEffects.set(comparable, effect);
        }
      });

    return Array.from(uniqueEffects.values());
  }, [baseEffectAliases, selectedSet]);

  return (
    <section className={styles.card}>
      <button
        type="button"
        className={styles.headingButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="equipment-info-content"
      >
        <div className={styles.headingRow}>
          <h2 className={styles.heading}>{t("equipment.title")}</h2>

          <div className={styles.headingMeta}>
            <div className={styles.equipLevel}>
              {t("equipment.equipLevel")}
              <span className={styles.equipLevelValue}>
                {selectedSet?.equipLevel ?? selectedSet?.equip_level ?? "—"}
              </span>
            </div>

            <span
              className={`${styles.accordionIcon} ${
                isOpen ? styles.accordionIconOpen : ""
              }`}
              aria-hidden="true"
            >
              ▼
            </span>
          </div>
        </div>
      </button>

      <div
        id="equipment-info-content"
        className={`${styles.accordionContent} ${
          isOpen
            ? styles.accordionContentOpen
            : styles.accordionContentClosed
        }`}
        aria-hidden={!isOpen}
      >
        <div className={styles.accordionContentInner}>
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
            <div className={styles.sectionLabel}>基礎効果</div>

            {statusItems.length > 1 ? (
              <div
                className={styles.statusTabs}
                role="tablist"
                aria-label="部位別の基礎効果"
              >
                {statusItems.map((item) => {
                  const active = item.key === activeStatusItem?.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`${styles.statusTab} ${
                        active ? styles.statusTabActive : ""
                      }`}
                      onClick={() => setActiveStatusItemKey(item.key)}
                    >
                      {item.slot}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {activeStatusItem?.statuses.length ? (
              <div className={styles.tagList} role="tabpanel">
                {activeStatusItem.statuses.map((status) => (
                  <span key={status.key} className={styles.effectTag}>
                    {status.label}+{status.value}
                  </span>
                ))}
              </div>
            ) : (
              <div className={styles.emptyText}>基礎効果はありません</div>
            )}
          </div>

          <div className={styles.infoCard}>
            <div className={styles.sectionLabel}>装備効果</div>

            {equipmentEffects.length ? (
              <div className={styles.tagList}>
                {equipmentEffects.map((effect) => (
                  <span key={effect} className={styles.effectTag}>
                    {effect}
                  </span>
                ))}
              </div>
            ) : (
              <div className={styles.emptyText}>装備効果はありません</div>
            )}
          </div>

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
        </div>
      </div>
    </section>
  );
}
