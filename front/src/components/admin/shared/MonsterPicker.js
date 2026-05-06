"use client";

import { useEffect, useMemo, useState } from "react";
import { searchMonsters, fetchMonsterDetail } from "@/lib/monsters";

function rowKey(row) {
  return row?.id ?? row?._tmpKey;
}

function makeTempKey() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function usePrefersDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDark(media.matches);

    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return isDark;
}

export default function MonsterPicker({
  value = [],
  onChange,
  defaultDropType = "normal",
  dropTypeOptions = [],
  enableDropTypeSelect = true,
  titleWhenEmpty = "まだモンスターが登録されていない",
  theme,
}) {
  const prefersDark = usePrefersDarkMode();
  const pickerTheme = useMemo(
    () => normalizeMonsterPickerTheme(theme, prefersDark),
    [theme, prefersDark]
  );

  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);

  const rows = useMemo(() => {
    const source = Array.isArray(value) ? value : [];
    return source.map((row) => ({
      ...row,
      _tmpKey: row._tmpKey ?? (row.id ? null : makeTempKey()),
    }));
  }, [value]);

  useEffect(() => {
    if (!keyword.trim()) {
      setCandidates([]);
      setSearching(false);
      return;
    }

    let ignore = false;

    async function run() {
      setSearching(true);

      try {
        const result = await searchMonsters(keyword, "monster");
        if (!ignore) {
          setCandidates(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) setCandidates([]);
      } finally {
        if (!ignore) setSearching(false);
      }
    }

    const timer = setTimeout(run, 250);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [keyword]);

  useEffect(() => {
    const current = Array.isArray(value) ? value : [];
    const targetRows = current.filter(
      (row) => row?.monster_id && !row?.monster?.name
    );

    if (!targetRows.length) return;

    let ignore = false;

    async function hydrateMonsters() {
      try {
        const resolved = await Promise.all(
          targetRows.map(async (row) => {
            try {
              const monster = await fetchMonsterDetail(row.monster_id);
              return {
                key: row.id ?? row._tmpKey,
                monster,
              };
            } catch (error) {
              console.error("monster hydrate error:", row.monster_id, error);
              return {
                key: row.id ?? row._tmpKey,
                monster: null,
              };
            }
          })
        );

        if (ignore) return;

        const resolvedMap = new Map(
          resolved.filter((x) => x.monster).map((x) => [x.key, x.monster])
        );

        if (!resolvedMap.size) return;

        const nextRows = current.map((row) => {
          const key = row.id ?? row._tmpKey;
          const monster = resolvedMap.get(key);
          return monster ? { ...row, monster } : row;
        });

        onChange(normalizeRows(nextRows));
      } catch (error) {
        console.error(error);
      }
    }

    hydrateMonsters();

    return () => {
      ignore = true;
    };
  }, [value, onChange, defaultDropType]);

  function normalizeRows(nextRows) {
    return nextRows.map((row, index) => ({
      ...row,
      drop_type: row.drop_type || defaultDropType,
      sort_order: index + 1,
    }));
  }

  function addMonster(monster) {
    const current = Array.isArray(value) ? value : [];

    const exists = current.some(
      (x) => Number(x.monster_id) === Number(monster.id)
    );
    if (exists) return;

    onChange(
      normalizeRows([
        ...current,
        {
          id: null,
          _tmpKey: makeTempKey(),
          monster_id: monster.id,
          drop_type: defaultDropType,
          sort_order: current.length + 1,
          monster,
        },
      ])
    );

    setKeyword("");
    setCandidates([]);
  }

  function removeMonster(targetKey) {
    const current = Array.isArray(value) ? value : [];

    onChange(
      normalizeRows(
        current.filter((row) => {
          const currentKey = row.id ?? row._tmpKey;
          return currentKey !== targetKey;
        })
      )
    );
  }

  function updateDropType(targetKey, nextDropType) {
    const current = Array.isArray(value) ? value : [];

    onChange(
      normalizeRows(
        current.map((row) =>
          (row.id ?? row._tmpKey) === targetKey
            ? { ...row, drop_type: nextDropType }
            : row
        )
      )
    );
  }

  return (
    <div style={wrapStyle}>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="モンスター名 / 系統 / monster_no で検索"
        style={inputStyle(pickerTheme)}
      />

      {searching ? <div style={mutedStyle(pickerTheme)}>検索中...</div> : null}

      {!!candidates.length && (
        <div style={candidateWrapStyle(pickerTheme)}>
          {candidates.map((monster, idx) => (
            <button
              key={monster.id ?? `candidate_${idx}`}
              type="button"
              style={candidateButtonStyle(pickerTheme)}
              onClick={() => addMonster(monster)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = pickerTheme.candidateHoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = pickerTheme.cardBg;
              }}
            >
              <div style={candidateMainStyle}>
                <div style={candidateNameStyle(pickerTheme)}>
                  {monster.name || `monster_id: ${monster.id}`}
                </div>
              </div>
              <div style={addLabelStyle(pickerTheme)}>追加</div>
            </button>
          ))}
        </div>
      )}

      {!rows.length ? (
        <div style={mutedStyle(pickerTheme)}>{titleWhenEmpty}</div>
      ) : (
        <div style={listStyle}>
          {rows.map((row) => {
            const targetKey = rowKey(row);
            const monsterName =
              row.monster?.name || row.name || `monster_id: ${row.monster_id}`;

            return (
              <div key={targetKey} style={dropItemStyle(pickerTheme)}>
                <div style={monsterNameStyle(pickerTheme)}>{monsterName}</div>

                <div style={controlAreaStyle}>
                  {enableDropTypeSelect ? (
                    <select
                      value={row.drop_type || defaultDropType}
                      onChange={(e) => updateDropType(targetKey, e.target.value)}
                      style={selectStyle(pickerTheme)}
                    >
                      {dropTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={fixedTypeBadgeStyle(pickerTheme)}>
                      {row.drop_type || defaultDropType}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeMonster(targetKey)}
                    style={removeButtonStyle(pickerTheme)}
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normalizeMonsterPickerTheme(theme, prefersDark = false) {
  const fallback = prefersDark
    ? {
        inputBg: "#0f172a",
        inputBorder: "#475569",
        inputText: "#f8fafc",
        mutedText: "#94a3b8",
        cardBg: "#111827",
        cardBorder: "#374151",
        text: "#e5e7eb",
        subText: "#cbd5e1",
        actionText: "#93c5fd",
        selectedBg: "#1e293b",
        selectedBorder: "#60a5fa",
        tagBg: "#1e293b",
        tagBorder: "#475569",
        tagText: "#e2e8f0",
        dangerBg: "#111827",
        dangerBorder: "#ef4444",
        dangerText: "#fca5a5",
        candidateHoverBg: "#1f2937",
      }
    : {
        inputBg: "#ffffff",
        inputBorder: "#cccccc",
        inputText: "#111827",
        mutedText: "#666666",
        cardBg: "#ffffff",
        cardBorder: "#dddddd",
        text: "#111827",
        subText: "#475569",
        actionText: "#1976d2",
        selectedBg: "#eff6ff",
        selectedBorder: "#2563eb",
        tagBg: "#f7f7f7",
        tagBorder: "#dddddd",
        tagText: "#555555",
        dangerBg: "#ffffff",
        dangerBorder: "#c62828",
        dangerText: "#c62828",
        candidateHoverBg: "#f8fafc",
      };

  return {
    inputBg: theme?.inputBg ?? fallback.inputBg,
    inputBorder: theme?.inputBorder ?? fallback.inputBorder,
    inputText: theme?.inputText ?? theme?.text ?? fallback.inputText,
    mutedText: theme?.mutedText ?? theme?.subText ?? fallback.mutedText,
    cardBg: theme?.cardBg ?? theme?.panelBg ?? fallback.cardBg,
    cardBorder: theme?.cardBorder ?? theme?.panelBorder ?? fallback.cardBorder,
    text: theme?.text ?? theme?.pageText ?? fallback.text,
    subText: theme?.subText ?? fallback.subText,
    actionText: theme?.secondaryText ?? fallback.actionText,
    selectedBg: theme?.selectedBg ?? fallback.selectedBg,
    selectedBorder: theme?.selectedBorder ?? fallback.selectedBorder,
    tagBg: theme?.tagBg ?? fallback.tagBg,
    tagBorder: theme?.tagBorder ?? fallback.tagBorder,
    tagText: theme?.tagText ?? fallback.tagText,
    dangerBg: theme?.dangerBg ?? fallback.dangerBg,
    dangerBorder: theme?.dangerBorder ?? fallback.dangerBorder,
    dangerText: theme?.dangerText ?? fallback.dangerText,
    candidateHoverBg: fallback.candidateHoverBg,
  };
}

const wrapStyle = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const inputStyle = (theme) => ({
  width: "100%",
  border: `1px solid ${theme.inputBorder}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 16,
  boxSizing: "border-box",
  background: theme.inputBg,
  color: theme.inputText,
  minWidth: 0,
});

const mutedStyle = (theme) => ({
  fontSize: 14,
  color: theme.mutedText,
});

const candidateWrapStyle = (theme) => ({
  border: `1px solid ${theme.cardBorder}`,
  borderRadius: 10,
  overflow: "hidden",
  display: "grid",
  background: theme.cardBg,
});

const candidateButtonStyle = (theme) => ({
  border: "none",
  borderBottom: `1px solid ${theme.cardBorder}`,
  background: theme.cardBg,
  padding: 12,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  width: "100%",
  color: theme.text,
  transition: "background-color 0.15s ease",
});

const candidateMainStyle = {
  minWidth: 0,
  flex: 1,
};

const candidateNameStyle = (theme) => ({
  fontWeight: 700,
  fontSize: 15,
  lineHeight: 1.4,
  wordBreak: "break-word",
  color: theme.text,
});

const addLabelStyle = (theme) => ({
  fontSize: 12,
  color: theme.actionText,
  whiteSpace: "nowrap",
  flexShrink: 0,
  fontWeight: 700,
});

const listStyle = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const dropItemStyle = (theme) => ({
  border: `1px solid ${theme.cardBorder}`,
  borderRadius: 10,
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  background: theme.cardBg,
  flexWrap: "nowrap",
  minWidth: 0,
});

const monsterNameStyle = (theme) => ({
  minWidth: 0,
  flex: 1,
  fontWeight: 700,
  fontSize: 15,
  lineHeight: 1.4,
  wordBreak: "break-word",
  color: theme.text,
});

const controlAreaStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
  flexWrap: "wrap",
};

const selectStyle = (theme) => ({
  border: `1px solid ${theme.inputBorder}`,
  background: theme.inputBg,
  color: theme.inputText,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 14,
  minWidth: 96,
});

const fixedTypeBadgeStyle = (theme) => ({
  fontSize: 12,
  color: theme.tagText,
  border: `1px solid ${theme.tagBorder}`,
  borderRadius: 999,
  padding: "6px 10px",
  background: theme.tagBg,
  whiteSpace: "nowrap",
  fontWeight: 700,
});

const removeButtonStyle = (theme) => ({
  border: `1px solid ${theme.dangerBorder}`,
  background: theme.dangerBg,
  color: theme.dangerText,
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontWeight: 700,
});
