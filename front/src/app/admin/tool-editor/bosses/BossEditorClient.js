"use client";

import { useEffect, useMemo, useState } from "react";

import EditorShell from "@/components/admin/shared/editor/EditorShell";
import EditorHeader from "@/components/admin/shared/editor/EditorHeader";
import EditorSidebar from "@/components/admin/shared/editor/EditorSidebar";
import FloatingToast from "@/components/admin/shared/editor/FloatingToast";
import useEditorLayout from "@/components/admin/shared/editor/useEditorLayout";
import useFloatingToast from "@/components/admin/shared/editor/useFloatingToast";

import {
  fetchBosses,
  createBoss,
  updateBoss,
  deleteBoss,
  createEmptyBossRow,
  createEmptyBossStat,
  createEmptyBossPushWeight,
} from "@/lib/bosses";



const CUSTOM_CATEGORY_VALUE = "__custom__";

function toInputValue(value) {
  return value == null ? "" : String(value);
}

function makeLocalKey(prefix = "row") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getStatTabLabel(stat, index) {
  if (stat?.variant) return stat.variant;
  if (stat?.level) return `Lv.${stat.level}`;
  return `ステータス ${index + 1}`;
}

function getPushWeightTabLabel(push, index) {
  if (push?.variant) return push.variant;
  return `重さ ${index + 1}`;
}

function clampIndex(index, length) {
  if (length <= 0) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

export default function BossEditorClient() {
  const { isMobile, sidebarOpen, toggleSidebar, closeSidebar } =
    useEditorLayout();

  const { toast, showToast } = useFloatingToast();

  const [bosses, setBosses] = useState([]);
  const [keyword, setKeyword] = useState("");

  const [selectedBossId, setSelectedBossId] = useState(null);
  const [form, setForm] = useState(createEmptyBossRow());

  const [activeStatIndex, setActiveStatIndex] = useState(0);
  const [activePushWeightIndex, setActivePushWeightIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const filteredBosses = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    if (!q) return bosses;

    return bosses.filter((boss) => {
      return (
        String(boss.name ?? "").toLowerCase().includes(q) ||
        String(boss.nameEn ?? "").toLowerCase().includes(q) ||
        String(boss.bossId ?? "").toLowerCase().includes(q) ||
        String(boss.category ?? "").toLowerCase().includes(q) ||
        String(boss.series ?? "").toLowerCase().includes(q) ||
        String(boss.race ?? "").toLowerCase().includes(q)
      );
    });
  }, [bosses, keyword]);
  
  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        bosses
          .map((boss) => String(boss.category ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [bosses]);

  const selectedBoss = useMemo(() => {
    if (!selectedBossId) return null;

    return (
      bosses.find((boss) => Number(boss.id) === Number(selectedBossId)) ?? null
    );
  }, [bosses, selectedBossId]);

  const currentStat = useMemo(() => {
    const stats = form.stats ?? [];
    if (stats.length === 0) return null;
    return stats[clampIndex(activeStatIndex, stats.length)] ?? null;
  }, [form.stats, activeStatIndex]);

  const currentPushWeight = useMemo(() => {
    const pushWeights = form.pushWeights ?? [];
    if (pushWeights.length === 0) return null;
    return pushWeights[clampIndex(activePushWeightIndex, pushWeights.length)] ?? null;
  }, [form.pushWeights, activePushWeightIndex]);

  const saveDisabled = saving || !form.bossId.trim() || !form.name.trim();
  const deleteDisabled = saving || !form.id;

  async function loadData(keepSelectedBossId = null) {
    setLoading(true);

    try {
      const list = await fetchBosses();

      setBosses(list);

      const nextBoss =
        list.find((boss) => Number(boss.id) === Number(keepSelectedBossId)) ??
        list[0] ??
        null;

      if (nextBoss) {
        setSelectedBossId(nextBoss.id);
        setForm(nextBoss);
        setActiveStatIndex(0);
        setActivePushWeightIndex(0);
      } else {
        setSelectedBossId(null);
        setForm(createEmptyBossRow());
        setActiveStatIndex(0);
        setActivePushWeightIndex(0);
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "ボス一覧取得に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    
  }, []);

  function handleSelectBoss(boss) {
    setSelectedBossId(boss.id);
    setForm(boss);
    setActiveStatIndex(0);
    setActivePushWeightIndex(0);

    if (isMobile) {
      closeSidebar();
    }
  }

  function handleCreateNew() {
    setSelectedBossId(null);
    setForm({
      ...createEmptyBossRow(),
      stats: [createEmptyBossStat()],
      pushWeights: [createEmptyBossPushWeight()],
    });
    setActiveStatIndex(0);
    setActivePushWeightIndex(0);

    if (isMobile) {
      closeSidebar();
    }
  }

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function updateStat(index, name, value) {
    setForm((prev) => {
      const nextStats = [...(prev.stats ?? [])];

      nextStats[index] = {
        ...nextStats[index],
        [name]: value,
      };

      return {
        ...prev,
        stats: nextStats,
      };
    });
  }

  function addStat() {
    setForm((prev) => {
      const nextStats = [
        ...(prev.stats ?? []),
        {
          ...createEmptyBossStat(),
          __key: makeLocalKey("stat"),
        },
      ];

      setActiveStatIndex(nextStats.length - 1);

      return {
        ...prev,
        stats: nextStats,
      };
    });
  }

  function removeStat(index) {
    setForm((prev) => {
      const nextStats = (prev.stats ?? []).filter((_, i) => i !== index);
      setActiveStatIndex((current) => clampIndex(current, nextStats.length));

      return {
        ...prev,
        stats: nextStats,
      };
    });
  }

  function updatePushWeight(index, name, value) {
    setForm((prev) => {
      const nextPushWeights = [...(prev.pushWeights ?? [])];

      nextPushWeights[index] = {
        ...nextPushWeights[index],
        [name]: value,
      };

      return {
        ...prev,
        pushWeights: nextPushWeights,
      };
    });
  }

  function addPushWeight() {
    setForm((prev) => {
      const nextPushWeights = [
        ...(prev.pushWeights ?? []),
        {
          ...createEmptyBossPushWeight(),
          __key: makeLocalKey("push"),
        },
      ];

      setActivePushWeightIndex(nextPushWeights.length - 1);

      return {
        ...prev,
        pushWeights: nextPushWeights,
      };
    });
  }

  function removePushWeight(index) {
    setForm((prev) => {
      const nextPushWeights = (prev.pushWeights ?? []).filter(
        (_, i) => i !== index
      );

      setActivePushWeightIndex((current) =>
        clampIndex(current, nextPushWeights.length)
      );

      return {
        ...prev,
        pushWeights: nextPushWeights,
      };
    });
  }

  async function handleSave() {
    if (saveDisabled) return;

    setSaving(true);

    try {
      let savedBoss;

      if (form.id) {
        savedBoss = await updateBoss(form.id, form);
      } else {
        savedBoss = await createBoss(form);
      }

      await loadData(savedBoss.id);

      showToast("保存しました", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id || saving) return;

    const ok = window.confirm(`「${form.name}」を削除しますか？`);
    if (!ok) return;

    setSaving(true);

    try {
      await deleteBoss(form.id);
      await loadData();

      showToast("削除しました", "success");
    } catch (error) {
      console.error(error);
      showToast(error.message || "削除に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  }

  const sidebar = (
    <EditorSidebar
      isMobile={isMobile}
      isOpen={sidebarOpen}
      onToggle={toggleSidebar}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onCreateNew={handleCreateNew}
      createDisabled={saving}
      createLabel="ボス追加"
      loading={loading}
      title="ボス一覧"
      searchPlaceholder="名前・ID・カテゴリで検索"
    >
      {filteredBosses.map((boss) => {
        const active = Number(boss.id) === Number(selectedBossId);

        return (
          <button
            key={boss.id}
            type="button"
            onClick={() => handleSelectBoss(boss)}
            style={bossItemStyle(active)}
          >
            <span style={styles.bossItemTop}>
              <span style={styles.bossName}>{boss.name}</span>

              {!boss.isActive ? (
                <span style={styles.inactiveBadge}>OFF</span>
              ) : null}
            </span>

            <span style={styles.bossMeta}>ID: {boss.bossId || "-"}</span>

            <span style={styles.bossSub}>
              {boss.category || "カテゴリなし"}
              {boss.series ? ` / ${boss.series}` : ""}
            </span>

            <span style={styles.bossSub}>
              {boss.race || "系統なし"}
              {boss.sortOrder !== "" && boss.sortOrder != null
                ? ` / sort: ${boss.sortOrder}`
                : ""}
            </span>
          </button>
        );
      })}

      {!loading && filteredBosses.length === 0 ? (
        <div style={styles.emptyText}>ボスが見つかりません。</div>
      ) : null}
    </EditorSidebar>
  );

  return (
    <>
      <EditorShell isMobile={isMobile} sidebar={sidebar}>
        <EditorHeader
          isMobile={isMobile}
          title="ボス編集"
          description="ボスの基本情報、ステータス、押し勝ち重さを管理します。"
          notice={
            selectedBoss
              ? `編集中: ${selectedBoss.name} / ${selectedBoss.bossId}`
              : "新しいボスを作成中"
          }
          onSave={handleSave}
          onDelete={handleDelete}
          saving={saving}
          saveDisabled={saveDisabled}
          deleteDisabled={deleteDisabled}
          deleteTitle={form.id ? "このボスを削除" : "保存済みのボスのみ削除できます"}
        />

        <div style={styles.contentStack}>
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>基本情報</h2>
                <p style={styles.cardDescription}>
                  bosses テーブルに保存する内容です。
                </p>
              </div>

              {isMobile ? (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  style={styles.secondaryButton}
                >
                  ボス一覧
                </button>
              ) : null}
            </div>

            <div style={styles.formGrid}>
              <TextField
                label="ボスID"
                value={form.bossId}
                placeholder="boss_001"
                onChange={(value) => updateField("bossId", value)}
              />

              <TextField
                label="ボス名"
                value={form.name}
                placeholder="スライム"
                onChange={(value) => updateField("name", value)}
              />

              <TextField
                label="英語名"
                value={form.nameEn}
                placeholder="Slime"
                onChange={(value) => updateField("nameEn", value)}
              />

              <CategoryField
                value={form.category}
                options={categoryOptions}
                onChange={(value) => updateField("category", value)}
              />

              <TextField
                label="シリーズ"
                value={form.series}
                placeholder="常闇の聖戦"
                onChange={(value) => updateField("series", value)}
              />

              <TextField
                label="系統"
                value={form.race}
                placeholder="ドラゴン系"
                onChange={(value) => updateField("race", value)}
              />

              <TextField
                label="画像URL"
                value={form.imageUrl}
                placeholder="https://..."
                onChange={(value) => updateField("imageUrl", value)}
              />

              <TextField
                label="参照URL"
                value={form.sourceUrl}
                placeholder="https://..."
                onChange={(value) => updateField("sourceUrl", value)}
              />

              <TextField
                label="並び順"
                type="number"
                value={form.sortOrder}
                onChange={(value) => updateField("sortOrder", value)}
              />

              <label style={styles.checkField}>
                <input
                  type="checkbox"
                  checked={Boolean(form.isActive)}
                  onChange={(e) => updateField("isActive", e.target.checked)}
                />
                <span>表示する / is_active</span>
              </label>
            </div>

            <div style={styles.textareaGrid}>
              <TextareaField
                label="説明"
                value={form.description}
                onChange={(value) => updateField("description", value)}
              />

              <TextareaField
                label="メモ"
                value={form.note}
                onChange={(value) => updateField("note", value)}
              />
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>ステータス</h2>
                <p style={styles.cardDescription}>
                  boss_stats テーブルに保存する内容です。複数ある場合はタブで切り替えて編集します。
                </p>
              </div>

              <button
                type="button"
                onClick={addStat}
                style={styles.primarySmallButton}
              >
                + ステータス追加
              </button>
            </div>

            {(form.stats ?? []).length > 0 ? (
              <>
                <TabList
                  items={form.stats ?? []}
                  activeIndex={activeStatIndex}
                  getLabel={getStatTabLabel}
                  onChange={setActiveStatIndex}
                />

                {currentStat ? (
                  <div style={styles.subCard}>
                    <div style={styles.subCardHeader}>
                      <h3 style={styles.subCardTitle}>
                        {getStatTabLabel(currentStat, activeStatIndex)}
                      </h3>

                      <button
                        type="button"
                        onClick={() => removeStat(activeStatIndex)}
                        style={styles.dangerSmallButton}
                      >
                        このステータスを削除
                      </button>
                    </div>

                    <div style={styles.compactGrid}>
                      <TextField
                        label="variant"
                        value={currentStat.variant}
                        placeholder="通常 / 強さ1 など"
                        onChange={(value) =>
                          updateStat(activeStatIndex, "variant", value)
                        }
                      />

                      <TextField
                        label="level"
                        type="number"
                        value={currentStat.level}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "level", value)
                        }
                      />

                      <TextField
                        label="HP"
                        type="number"
                        value={currentStat.hp}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "hp", value)
                        }
                      />

                      <TextField
                        label="MP"
                        type="number"
                        value={currentStat.mp}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "mp", value)
                        }
                      />

                      <TextField
                        label="攻撃力"
                        type="number"
                        value={currentStat.attack}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "attack", value)
                        }
                      />

                      <TextField
                        label="守備力"
                        type="number"
                        value={currentStat.defense}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "defense", value)
                        }
                      />

                      <TextField
                        label="攻撃魔力"
                        type="number"
                        value={currentStat.magicAttack}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "magicAttack", value)
                        }
                      />

                      <TextField
                        label="魔法守備"
                        type="number"
                        value={currentStat.magicDefense}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "magicDefense", value)
                        }
                      />

                      <TextField
                        label="すばやさ"
                        type="number"
                        value={currentStat.agility}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "agility", value)
                        }
                      />

                      <TextField
                        label="重さ"
                        type="number"
                        value={currentStat.weight}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "weight", value)
                        }
                      />
                    </div>

                    <div style={styles.textareaGrid}>
                      <TextareaField
                        label="extra_stats_json"
                        value={currentStat.extraStatsJson}
                        placeholder='{"exp": 1000}'
                        onChange={(value) =>
                          updateStat(activeStatIndex, "extraStatsJson", value)
                        }
                      />

                      <TextareaField
                        label="メモ"
                        value={currentStat.note}
                        onChange={(value) =>
                          updateStat(activeStatIndex, "note", value)
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={styles.emptyText}>
                ステータスがありません。「ステータス追加」から追加できます。
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>押し勝ち重さ</h2>
                <p style={styles.cardDescription}>
                  boss_push_weights テーブルに保存する内容です。複数ある場合はタブで切り替えて編集します。
                </p>
              </div>

              <button
                type="button"
                onClick={addPushWeight}
                style={styles.primarySmallButton}
              >
                + 重さ追加
              </button>
            </div>

            {(form.pushWeights ?? []).length > 0 ? (
              <>
                <TabList
                  items={form.pushWeights ?? []}
                  activeIndex={activePushWeightIndex}
                  getLabel={getPushWeightTabLabel}
                  onChange={setActivePushWeightIndex}
                />

                {currentPushWeight ? (
                  <div style={styles.subCard}>
                    <div style={styles.subCardHeader}>
                      <h3 style={styles.subCardTitle}>
                        {getPushWeightTabLabel(
                          currentPushWeight,
                          activePushWeightIndex
                        )}
                      </h3>

                      <button
                        type="button"
                        onClick={() => removePushWeight(activePushWeightIndex)}
                        style={styles.dangerSmallButton}
                      >
                        この重さを削除
                      </button>
                    </div>

                    <div style={styles.compactGrid}>
                      <TextField
                        label="variant"
                        value={currentPushWeight.variant}
                        placeholder="通常 / 強さ1 など"
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "variant",
                            value
                          )
                        }
                      />

                      <TextField
                        label="押し劣勢"
                        type="number"
                        value={currentPushWeight.disadvantageWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "disadvantageWeight",
                            value
                          )
                        }
                      />

                      <TextField
                        label="互角"
                        type="number"
                        value={currentPushWeight.equalWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "equalWeight",
                            value
                          )
                        }
                      />

                      <TextField
                        label="押し勝ち"
                        type="number"
                        value={currentPushWeight.winWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "winWeight",
                            value
                          )
                        }
                      />

                      <TextField
                        label="完封"
                        type="number"
                        value={currentPushWeight.completeWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "completeWeight",
                            value
                          )
                        }
                      />

                      <TextField
                        label="WB押し劣勢"
                        type="number"
                        value={currentPushWeight.wbDisadvantageWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "wbDisadvantageWeight",
                            value
                          )
                        }
                      />

                      <TextField
                        label="WB互角"
                        type="number"
                        value={currentPushWeight.wbEqualWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "wbEqualWeight",
                            value
                          )
                        }
                      />

                      <TextField
                        label="WB押し勝ち"
                        type="number"
                        value={currentPushWeight.wbWinWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "wbWinWeight",
                            value
                          )
                        }
                      />

                      <TextField
                        label="WB完封"
                        type="number"
                        value={currentPushWeight.wbCompleteWeight}
                        onChange={(value) =>
                          updatePushWeight(
                            activePushWeightIndex,
                            "wbCompleteWeight",
                            value
                          )
                        }
                      />
                    </div>

                    <div style={styles.textareaGrid}>
                      <TextareaField
                        label="メモ"
                        value={currentPushWeight.note}
                        onChange={(value) =>
                          updatePushWeight(activePushWeightIndex, "note", value)
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={styles.emptyText}>
                押し勝ち重さがありません。「重さ追加」から追加できます。
              </div>
            )}
          </section>
        </div>
      </EditorShell>

      <FloatingToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isMobile={isMobile}
      />
    </>
  );
}

function CategoryField({ value, options = [], onChange }) {
  const currentValue = value ?? "";

  const [isCustomMode, setIsCustomMode] = useState(false);

  const isExistingCategory =
    currentValue !== "" && options.includes(currentValue);

  const selectValue = isCustomMode
    ? CUSTOM_CATEGORY_VALUE
    : isExistingCategory
    ? currentValue
    : currentValue === ""
    ? ""
    : CUSTOM_CATEGORY_VALUE;

  useEffect(() => {
    if (currentValue !== "" && !options.includes(currentValue)) {
      setIsCustomMode(true);
    }
  }, [currentValue, options]);

  return (
    <div style={styles.field}>
      <span style={styles.label}>カテゴリ</span>

      <select
        value={selectValue}
        onChange={(e) => {
          const nextValue = e.target.value;

          if (nextValue === CUSTOM_CATEGORY_VALUE) {
            setIsCustomMode(true);
            onChange(currentValue);
            return;
          }

          setIsCustomMode(false);
          onChange(nextValue);
        }}
        style={styles.input}
      >
        <option value="">未選択</option>

        {options.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}

        <option value={CUSTOM_CATEGORY_VALUE}>新規カテゴリを入力</option>
      </select>

      {isCustomMode ? (
        <input
          type="text"
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="新しいカテゴリ名を入力"
          style={styles.input}
        />
      ) : null}
    </div>
  );
}

function TabList({ items, activeIndex, getLabel, onChange }) {
  return (
    <div style={styles.tabWrap}>
      {items.map((item, index) => {
        const active = index === activeIndex;

        return (
          <button
            key={item.__key ?? item.id ?? index}
            type="button"
            onClick={() => onChange(index)}
            style={tabButtonStyle(active)}
          >
            {getLabel(item, index)}
          </button>
        );
      })}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        type={type}
        value={toInputValue(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </label>
  );
}

function TextareaField({ label, value, onChange, placeholder = "" }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <textarea
        value={toInputValue(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        style={styles.textarea}
      />
    </label>
  );
}

const styles = {
  contentStack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    minWidth: 0,
  },

  card: {
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: 14,
    padding: 16,
    minWidth: 0,
    boxSizing: "border-box",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  cardTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.3,
    color: "var(--text-title)",
  },

  cardDescription: {
    margin: "6px 0 0",
    color: "var(--text-muted)",
    fontSize: 14,
    lineHeight: 1.6,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  compactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },

  textareaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    marginTop: 12,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },

  label: {
    color: "var(--text-sub)",
    fontSize: 13,
    fontWeight: 700,
  },

  input: {
    width: "100%",
    minWidth: 0,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "11px 12px",
    outline: "none",
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    minWidth: 0,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 10,
    padding: "11px 12px",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.6,
  },

  checkField: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    color: "var(--text-sub)",
    fontSize: 14,
    fontWeight: 700,
  },

  secondaryButton: {
    border: "1px solid var(--secondary-border)",
    background: "var(--secondary-bg)",
    color: "var(--secondary-text)",
    borderRadius: 10,
    padding: "9px 12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  primarySmallButton: {
    border: "1px solid var(--primary-border)",
    background: "var(--primary-bg)",
    color: "var(--primary-text)",
    borderRadius: 10,
    padding: "9px 12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  dangerSmallButton: {
    border: "1px solid var(--danger-border)",
    background: "var(--danger-bg)",
    color: "var(--danger-text)",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  subCard: {
    border: "1px solid var(--soft-border)",
    background: "var(--soft-bg)",
    borderRadius: 12,
    padding: 14,
    minWidth: 0,
  },

  subCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  subCardTitle: {
    margin: 0,
    color: "var(--text-title)",
    fontSize: 16,
  },

  tabWrap: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 10,
    marginBottom: 12,
  },

  bossItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  bossName: {
    color: "var(--text-main)",
    fontWeight: 800,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  bossMeta: {
    color: "var(--text-muted)",
    fontSize: 12,
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  bossSub: {
    color: "var(--text-muted)",
    fontSize: 12,
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  inactiveBadge: {
    flexShrink: 0,
    border: "1px solid var(--danger-border)",
    background: "var(--danger-bg)",
    color: "var(--danger-text)",
    borderRadius: 999,
    padding: "2px 7px",
    fontSize: 11,
    fontWeight: 800,
  },

  emptyText: {
    color: "var(--text-muted)",
    fontSize: 14,
    lineHeight: 1.6,
    padding: 8,
  },
};

function bossItemStyle(active = false) {
  return {
    width: "100%",
    border: `1px solid ${
      active ? "var(--selected-border)" : "var(--card-border)"
    }`,
    background: active ? "var(--selected-bg)" : "var(--panel-bg)",
    color: "var(--text-main)",
    borderRadius: 12,
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  };
}

function tabButtonStyle(active = false) {
  return {
    border: `1px solid ${
      active ? "var(--selected-border)" : "var(--soft-border)"
    }`,
    background: active ? "var(--selected-bg)" : "var(--soft-bg)",
    color: active ? "var(--text-title)" : "var(--text-sub)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}