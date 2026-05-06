"use client";

import { useMemo, useState } from "react";
import styles from "./BossJudgeSection.module.css";

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toKatakana(value) {
  return String(value || "").replace(/[\u3041-\u3096]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0x60);
  });
}

function normalizeText(value) {
  return toKatakana(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function getVariantLabel(value) {
  if (!value) return "通常";

  const text = String(value);

  if (/^\d+$/.test(text)) {
    return `強さ${text}`;
  }

  return text;
}

function getBossRows(bosses) {
  return bosses.flatMap((boss) => {
    if (!Array.isArray(boss.pushWeights) || boss.pushWeights.length === 0) {
      return [];
    }

    return boss.pushWeights.map((push, index) => {
      const variant = push.variant || "";

      const rowKey = [
        boss.id,
        push.id || "push",
        variant || "default",
        index,
      ].join("-");

      return {
        id: rowKey,
        bossId: boss.id,
        pushWeightId: push.id ?? null,

        name: boss.name,
        nameEn: boss.nameEn,
        category: boss.category,
        series: boss.series,
        race: boss.race,
        variant: push.variant || "",

        disadvantageWeight: push.disadvantageWeight,
        equalWeight: push.equalWeight,
        winWeight: push.winWeight,
        completeWeight: push.completeWeight,

        note: push.note || boss.note,
      };
    });
  });
}

function groupBossRows(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const groupKey = String(row.bossId ?? row.name);

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        groupKey,
        bossId: row.bossId,
        name: row.name,
        nameEn: row.nameEn,
        category: row.category,
        series: row.series,
        race: row.race,
        rows: [],
      });
    }

    map.get(groupKey).rows.push(row);
  });

  return [...map.values()].map((group) => {
    return {
      ...group,
      rows: group.rows.sort((a, b) => {
        const aNumber = Number(a.variant);
        const bNumber = Number(b.variant);

        if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
          return aNumber - bNumber;
        }

        return String(a.variant || "").localeCompare(String(b.variant || ""), "ja");
      }),
    };
  });
}

function getEffectivePushWeight(value, useWeightBreak) {
  const weight = toNumber(value);

  if (!weight) {
    return null;
  }

  if (!useWeightBreak) {
    return weight;
  }

  return Math.ceil(weight / 2);
}

function getBossStatus(totalWeight, boss, useWeightBreak) {
  const disadvantageWeight = getEffectivePushWeight(
    boss.disadvantageWeight,
    useWeightBreak
  );

  const equalWeight = getEffectivePushWeight(boss.equalWeight, useWeightBreak);

  const winWeight = getEffectivePushWeight(boss.winWeight, useWeightBreak);

  const completeWeight = getEffectivePushWeight(
    boss.completeWeight,
    useWeightBreak
  );

  if (completeWeight && totalWeight >= completeWeight) {
    return {
      rank: 4,
      label: "完封",
      className: styles.statusComplete,
      description: "かなり余裕あり",
      nextWeight: null,
    };
  }

  if (winWeight && totalWeight >= winWeight) {
    return {
      rank: 3,
      label: "押勝",
      className: styles.statusWin,
      description: "押し勝ち可能",
      nextWeight: completeWeight ? completeWeight - totalWeight : null,
    };
  }

  if (equalWeight && totalWeight >= equalWeight) {
    return {
      rank: 2,
      label: "互角",
      className: styles.statusEqual,
      description: "押し合い可能",
      nextWeight: winWeight ? winWeight - totalWeight : null,
    };
  }

  if (disadvantageWeight && totalWeight >= disadvantageWeight) {
    return {
      rank: 1,
      label: "劣勢",
      className: styles.statusWeak,
      description: "少し押されやすい",
      nextWeight: equalWeight ? equalWeight - totalWeight : null,
    };
  }

  return {
    rank: 0,
    label: "押せない",
    className: styles.statusNo,
    description: "おもさ不足",
    nextWeight: disadvantageWeight ? disadvantageWeight - totalWeight : null,
  };
}

function getBossPushValues(boss, useWeightBreak) {
  return {
    disadvantage: getEffectivePushWeight(
      boss.disadvantageWeight,
      useWeightBreak
    ),
    equal: getEffectivePushWeight(boss.equalWeight, useWeightBreak),
    win: getEffectivePushWeight(boss.winWeight, useWeightBreak),
    complete: getEffectivePushWeight(boss.completeWeight, useWeightBreak),
  };
}

function VariantTabs({
  group,
  activeRow,
  setSelectedVariantByBoss,
}) {
  if (group.rows.length <= 1) {
    return null;
  }

  return (
    <div className={styles.variantTabs} aria-label={`${group.name}の強さ切り替え`}>
      {group.rows.map((row) => {
        const isActive = row.id === activeRow.id;

        return (
          <button
            key={row.id}
            type="button"
            className={`${styles.variantTab} ${
              isActive ? styles.variantTabActive : ""
            }`}
            onClick={() => {
              setSelectedVariantByBoss((prev) => ({
                ...prev,
                [group.groupKey]: row.id,
              }));
            }}
          >
            {getVariantLabel(row.variant)}
          </button>
        );
      })}
    </div>
  );
}

export default function BossJudgeSection({
  bosses,
  finalWeight,
  useWeightBreak,
  isLoading,
}) {
  const [bossKeyword, setBossKeyword] = useState("");
  const [bossCategory, setBossCategory] = useState("all");
  const [selectedVariantByBoss, setSelectedVariantByBoss] = useState({});

  const bossRows = useMemo(() => {
    return getBossRows(bosses);
  }, [bosses]);

  const bossGroups = useMemo(() => {
    return groupBossRows(bossRows);
  }, [bossRows]);

  const bossCategories = useMemo(() => {
    return bossRows
      .map((boss) => boss.category)
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
  }, [bossRows]);

  function getActiveRow(group) {
    const selectedId = selectedVariantByBoss[group.groupKey];

    return group.rows.find((row) => row.id === selectedId) || group.rows[0];
  }

  const filteredBossGroups = useMemo(() => {
    return bossGroups
      .filter((group) => {
        if (bossCategory !== "all" && group.category !== bossCategory) {
          return false;
        }

        if (!bossKeyword.trim()) {
          return true;
        }

        return group.rows.some((boss) => {
          const searchText = normalizeText(
            [
              boss.name,
              boss.nameEn,
              boss.category,
              boss.series,
              boss.race,
              boss.variant,
              getVariantLabel(boss.variant),
            ]
              .filter(Boolean)
              .join(" ")
          );

          return searchText.includes(normalizeText(bossKeyword));
        });
      })
      .sort((a, b) => {
        return String(a.name || "").localeCompare(String(b.name || ""), "ja");
      });
  }, [
    bossGroups,
    bossCategory,
    bossKeyword,
    finalWeight,
    useWeightBreak,
    selectedVariantByBoss,
  ]);

  return (
    <section className={styles.bossSection}>
      <div className={styles.bossHeader}>
        <div>
          <h2>ボス判定</h2>
          <p>
            現在のおもさ {finalWeight} で、押し合いラインを判定する。
            {useWeightBreak
              ? " ウェイトブレイク中はボスのおもさを半分として計算。"
              : ""}
          </p>
        </div>

        <div className={styles.bossFilters}>
          <input
            type="search"
            value={bossKeyword}
            disabled={isLoading}
            onChange={(e) => setBossKeyword(e.target.value)}
            placeholder={isLoading ? "読み込み中..." : "ボス名で検索"}
          />

          <select
            value={bossCategory}
            disabled={isLoading}
            onChange={(e) => setBossCategory(e.target.value)}
          >
            {isLoading ? (
              <option value="all">ボスデータを読み込み中...</option>
            ) : (
              <>
                <option value="all">すべて</option>
                {bossCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.bossLoadingBox}>
          <span className={styles.bossLoadingSpinner} />
          <div>
            <strong>ボスデータを読み込み中...</strong>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.bossTableWrap}>
            <table className={styles.bossTable}>
              <thead>
                <tr>
                  <th>判定</th>
                  <th>ボス</th>
                  <th>劣勢</th>
                  <th>互角</th>
                  <th>押勝</th>
                  <th>完封</th>
                  <th>不足</th>
                </tr>
              </thead>

              <tbody>
                {filteredBossGroups.map((group) => {
                  const activeRow = getActiveRow(group);
                  const status = getBossStatus(
                    finalWeight,
                    activeRow,
                    useWeightBreak
                  );

                  const { disadvantage, equal, win, complete } =
                    getBossPushValues(activeRow, useWeightBreak);

                  return (
                    <tr key={group.groupKey}>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <small>{status.description}</small>
                      </td>

                      <td>
                        <div className={styles.bossNameCell}>
                          <div>
                            <strong>{group.name}</strong>
                            <small>
                              {[group.series, group.category, group.race]
                                .filter(Boolean)
                                .join(" / ") || "-"}
                            </small>
                          </div>

                          <VariantTabs
                            group={group}
                            activeRow={activeRow}
                            selectedVariantByBoss={selectedVariantByBoss}
                            setSelectedVariantByBoss={setSelectedVariantByBoss}
                          />
                        </div>
                      </td>

                      <td>{disadvantage || "-"}</td>
                      <td>{equal || "-"}</td>
                      <td>{win || "-"}</td>
                      <td>{complete || "-"}</td>
                      <td>
                        {status.nextWeight && status.nextWeight > 0
                          ? `あと ${status.nextWeight}`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}

                {filteredBossGroups.length === 0 && (
                  <tr>
                    <td colSpan="7" className={styles.emptyCell}>
                      ボスデータが見つからない。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.bossCardList}>
            {filteredBossGroups.map((group) => {
              const activeRow = getActiveRow(group);
              const status = getBossStatus(
                finalWeight,
                activeRow,
                useWeightBreak
              );

              const { disadvantage, equal, win, complete } = getBossPushValues(
                activeRow,
                useWeightBreak
              );

              return (
                <article
                  key={`card-${group.groupKey}`}
                  className={styles.bossCard}
                >
                  <div className={styles.bossCardTop}>
                    <div className={styles.bossCardTitleArea}>
                      <div>
                        <h3>{group.name}</h3>
                        <p>
                          {[group.series, group.category, group.race]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </p>
                      </div>

                      <VariantTabs
                        group={group}
                        activeRow={activeRow}
                        selectedVariantByBoss={selectedVariantByBoss}
                        setSelectedVariantByBoss={setSelectedVariantByBoss}
                      />
                    </div>

                    <span
                      className={`${styles.statusBadge} ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className={styles.pushGrid}>
                    <div>
                      <span>劣勢</span>
                      <strong>{disadvantage || "-"}</strong>
                    </div>

                    <div>
                      <span>互角</span>
                      <strong>{equal || "-"}</strong>
                    </div>

                    <div>
                      <span>押勝</span>
                      <strong>{win || "-"}</strong>
                    </div>

                    <div>
                      <span>完封</span>
                      <strong>{complete || "-"}</strong>
                    </div>
                  </div>

                  <div className={styles.bossCardFooter}>
                    <span>{status.description}</span>
                    <strong>
                      {status.nextWeight && status.nextWeight > 0
                        ? `あと ${status.nextWeight}`
                        : "達成中"}
                    </strong>
                  </div>
                </article>
              );
            })}

            {filteredBossGroups.length === 0 && (
              <div className={styles.bossCardEmpty}>
                ボスデータが見つからない。
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}