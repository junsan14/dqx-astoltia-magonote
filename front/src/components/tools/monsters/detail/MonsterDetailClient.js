"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { searchMonsters } from "@/lib/monsters";
import MonsterSearchHero from "./MonsterSearchHero";
import MonsterSearchCard from "./MonsterSearchCard";

const SEARCH_OPTIONS = [
  { value: "monster", label: "モンスター" },
  { value: "orb", label: "オーブ" },
  { value: "item", label: "アイテム" },
  { value: "equipment", label: "装備" },
];

function getStyles() {
  return {
    page: {
      minHeight: "100vh",
      background:
        "linear-gradient(180deg, var(--page-bg) 0%, color-mix(in srgb, var(--soft-bg) 70%, var(--page-bg)) 42%, var(--page-bg) 100%)",
      padding: "28px 16px 64px",
      color: "var(--page-text)",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflowX: "hidden",
      boxSizing: "border-box",
    },
    searchSection: {
      maxWidth: "1100px",
      margin: "0 auto 28px",
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
      position: "relative",
      zIndex: 10,
    },
    searchCard: {
      position: "relative",
      border: `1px solid var(--panel-border)`,
      background:
        "color-mix(in srgb, var(--panel-bg) 82%, transparent)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderRadius: "24px",
      padding: "18px",
      boxShadow:
        "0 18px 50px color-mix(in srgb, var(--page-text) 8%, transparent)",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      boxSizing: "border-box",
      overflow: "visible",
      zIndex: 60,
    },
    segment: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginBottom: "14px",
      minWidth: 0,
    },
    segmentButton: {
      border: `1px solid var(--soft-border)`,
      background: "var(--panel-bg)",
      color: "var(--text-sub)",
      borderRadius: "999px",
      padding: "10px 14px",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
      maxWidth: "100%",
      boxSizing: "border-box",
      transition: "all 0.18s ease",
    },
    segmentButtonActive: {
      background: "var(--primary-bg)",
      color: "var(--primary-text)",
      border: `1px solid var(--primary-border)`,
      boxShadow:
        "0 10px 24px color-mix(in srgb, var(--primary-border) 18%, transparent)",
    },
    searchArea: {
      position: "relative",
      minWidth: 0,
    },
    searchIcon: {
      position: "absolute",
      left: "16px",
      top: "50%",
      transform: "translateY(-50%)",
      color: "var(--text-muted)",
      fontSize: "18px",
      zIndex: 2,
    },
    input: {
      width: "100%",
      height: "58px",
      borderRadius: "18px",
      border: `1px solid var(--input-border)`,
      background: "var(--input-bg)",
      fontSize: "16px",
      padding: "0 18px 0 46px",
      outline: "none",
      color: "var(--input-text)",
      boxSizing: "border-box",
      minWidth: 0,
      maxWidth: "100%",
    },
    suggestionBox: {
      position: "absolute",
      top: "64px",
      left: 0,
      right: 0,
      background: "var(--panel-bg)",
      border: `1px solid var(--input-border)`,
      borderRadius: "18px",
      boxShadow:
        "0 18px 40px color-mix(in srgb, var(--page-text) 12%, transparent)",
      overflow: "hidden",
      zIndex: 999,
      minWidth: 0,
      maxWidth: "100%",
      boxSizing: "border-box",
    },
    suggestionHeader: {
      padding: "12px 14px 8px",
      fontSize: "12px",
      fontWeight: 800,
      color: "var(--text-muted)",
      letterSpacing: "0.08em",
    },
    suggestionList: {
      margin: 0,
      padding: "0 0 6px",
      listStyle: "none",
      minWidth: 0,
    },
    suggestionButton: {
      width: "100%",
      display: "block",
      textAlign: "left",
      padding: "12px 14px",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "inherit",
      borderTop: `1px solid var(--soft-border)`,
      boxSizing: "border-box",
    },
    suggestionMain: {
      fontSize: "15px",
      fontWeight: 800,
      color: "var(--text-title)",
      overflowWrap: "anywhere",
      wordBreak: "break-word",
    },
    statusRow: {
      marginTop: "12px",
      display: "flex",
      justifyContent: "flex-end",
      minWidth: 0,
    },
    statusText: {
      fontSize: "13px",
      color: "var(--text-muted)",
      fontWeight: 700,
    },
    empty: {
      maxWidth: "1100px",
      margin: "24px auto 0",
      borderRadius: "24px",
      padding: "38px 18px",
      textAlign: "center",
      background: "var(--panel-bg)",
      border: `1px solid var(--soft-border)`,
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
    },
    emptyIcon: {
      fontSize: "28px",
      color: "var(--text-muted)",
      marginBottom: "8px",
    },
    emptyTitle: {
      margin: "0 0 8px",
      fontSize: "22px",
      fontWeight: 900,
      color: "var(--text-title)",
    },
    emptyText: {
      margin: 0,
      color: "var(--text-muted)",
    },
    grid: {
      maxWidth: "1100px",
      margin: "0 auto",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: "16px",
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
    },
    linkReset: {
      textDecoration: "none",
      color: "inherit",
      minWidth: 0,
    },
  };
}

export default function MonsterDetailClient() {
  const styles = useMemo(() => getStyles(), []);

  const [searchType, setSearchType] = useState("monster");
  const [keyword, setKeyword] = useState("");
  const [monsters, setMonsters] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const currentLabel = useMemo(() => {
    return SEARCH_OPTIONS.find((x) => x.value === searchType)?.label ?? "検索";
  }, [searchType]);

  const extractNameFromMatchText = (text) => {
    if (!text) return null;
    const parts = String(text).split(":");
    return parts.length > 1 ? parts.slice(1).join(":").trim() : text;
  };

  const formatSuggestionName = (monster) => {
    if (searchType === "monster") return monster.name;

    if (searchType === "orb") {
      return (
        monster.matched_name ||
        monster.orb_name ||
        extractNameFromMatchText(monster.match_text) ||
        monster.name
      );
    }

    if (searchType === "item" || searchType === "equipment") {
      return (
        monster.matched_name ||
        extractNameFromMatchText(monster.match_text) ||
        monster.name
      );
    }

    return monster.name;
  };

  const buildUniqueSuggestions = (list) => {
    const map = new Map();

    for (const monster of list) {
      const suggestionName = formatSuggestionName(monster)?.trim();
      if (!suggestionName) continue;

      if (!map.has(suggestionName)) {
        map.set(suggestionName, {
          id: monster.id,
          label: suggestionName,
        });
      }
    }

    return Array.from(map.values()).slice(0, 8);
  };

  const formatSubText = (monster) => {
    if (searchType === "orb") {
      const orbName =
        monster.matched_name ||
        monster.orb_name ||
        extractNameFromMatchText(monster.match_text);

      const orbColor = monster.matched_color || monster.orb_color;

      if (orbName && orbColor) return `${orbName} ・ ${orbColor}`;
      if (orbName) return orbName;
      if (orbColor) return orbColor;
      return null;
    }

    if (searchType === "item" || searchType === "equipment") {
      return monster.matched_name || extractNameFromMatchText(monster.match_text);
    }

    return monster.system_type || null;
  };

  const runSearch = async ({
    keyword: searchKeyword = "",
    searchType: currentSearchType = "monster",
  } = {}) => {
    try {
      setLoading(true);

      const list = await searchMonsters(searchKeyword, currentSearchType);

      setMonsters(list);
      setSuggestions(buildUniqueSuggestions(list));
      setSearched(true);
    } catch (error) {
      console.error(error);
      setMonsters([]);
      setSuggestions([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch({
      keyword: "",
      searchType: "monster",
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      runSearch({ keyword, searchType });
    }, keyword.length >= 2 ? 180 : 0);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [keyword, searchType]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (label) => {
    setKeyword(label);
    setShowSuggestions(false);
    runSearch({
      keyword: label,
      searchType,
    });
  };

  return (
    <main style={styles.page}>
      <MonsterSearchHero />

      <section style={styles.searchSection}>
        <div style={styles.searchCard}>
          <div style={styles.segment}>
            {SEARCH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSearchType(option.value);
                  setShowSuggestions(true);
                }}
                style={{
                  ...styles.segmentButton,
                  ...(searchType === option.value ? styles.segmentButtonActive : {}),
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div style={styles.searchArea} ref={wrapperRef}>
            <span style={styles.searchIcon}>⌕</span>
            <input
              type="text"
              placeholder={`${currentLabel}で検索`}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={(e) => {
                setShowSuggestions(true);
                e.target.select();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowSuggestions(false);
                }
              }}
              style={styles.input}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={styles.suggestionBox}>
                <div style={styles.suggestionHeader}>候補</div>
                <ul style={styles.suggestionList}>
                  {suggestions.map((suggestion) => (
                    <li key={`suggest-${suggestion.label}`}>
                      <button
                        type="button"
                        style={styles.suggestionButton}
                        onClick={() => handleSuggestionClick(suggestion.label)}
                      >
                        <div style={styles.suggestionMain}>{suggestion.label}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div style={styles.statusRow}>
            <span style={styles.statusText}>
              {loading ? "検索中..." : `${monsters.length}件`}
            </span>
          </div>
        </div>
      </section>

      {!loading && searched && monsters.length === 0 && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>◌</div>
          <h2 style={styles.emptyTitle}>見つかりませんでした</h2>
          <p style={styles.emptyText}>キーワードを変えて試してください</p>
        </div>
      )}

      {monsters.length > 0 && (
        <section style={styles.grid}>
          {monsters.map((monster) => (
            <Link
              key={monster.id}
              href={`/tools/monster-search/${monster.id}`}
              style={styles.linkReset}
            >
              <MonsterSearchCard
                monster={monster}
                searchType={searchType}
                formatSubText={formatSubText}
              />
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}