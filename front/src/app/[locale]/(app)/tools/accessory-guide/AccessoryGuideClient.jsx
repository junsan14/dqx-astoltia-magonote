"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAccessories,
  ACCESSORY_BASE_EFFECT_FIELDS,
} from "@/lib/accessories";
import styles from "./accessory-guide.module.css";
import Image from "next/image";
import PageHeroTitle from "@/components/PageHeroTitle";

function getBaseEffects(item) {
  return ACCESSORY_BASE_EFFECT_FIELDS.filter((field) => {
    const value = Number(item?.[field.key]);
    return Number.isFinite(value) && value > 0;
  }).map((field) => ({
    ...field,
    value: item[field.key],
  }));
}

function normalizeTextRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (typeof row === "string") return row;
      return row?.text || row?.note || "";
    })
    .filter(Boolean);
}

function getObtainPlaces(item) {
  return normalizeTextRows(item?.obtain_methods_json);
}

function getInheritanceChain(item) {
  if (
    Array.isArray(item?.inheritance_chain) &&
    item.inheritance_chain.length > 0
  ) {
    return item.inheritance_chain;
  }

  return item ? [item] : [];
}

function getGenerationLabel(item) {
  return item?.inheritance_type || "世代未設定";
}

function getChainKeyFromItem(item) {
  const chain = getInheritanceChain(item);

  if (chain.length > 0) {
    return chain.map((chainItem) => chainItem.id).join("-");
  }

  return `single-${item?.id ?? "unknown"}`;
}

function getChainTitle(chain = []) {
  if (!chain.length) return "伝承チェーン未設定";

  return chain
    .map((item) => item?.name)
    .filter(Boolean)
    .join(" → ");
}

function getChainSearchText(chain = []) {
  return chain
    .map((item) =>
      [
        item?.id,
        item?.item_id,
        item?.name,
        item?.name_en,
        item?.slot,
        item?.accessory_type,
        item?.inheritance_type,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");
}

function getSearchTextFromAccessory(item) {
  const obtainPlaces = getObtainPlaces(item).join(" ");
  const effects = normalizeTextRows(item?.effects_json).join(" ");
  const syntheses = normalizeTextRows(item?.synthesis_effects_json).join(" ");
  const chainText = getChainSearchText(getInheritanceChain(item));

  return [
    item?.name,
    item?.name_en,
    item?.item_id,
    item?.slot,
    item?.accessory_type,
    item?.description,
    item?.inheritance_type,
    item?.inheritance_note,
    obtainPlaces,
    effects,
    syntheses,
    chainText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildChainRows(accessories = []) {
  const byId = new Map(accessories.map((item) => [Number(item.id), item]));
  const rowsByKey = new Map();

  accessories.forEach((item) => {
    const rawChain = getInheritanceChain(item);

    const chain = rawChain
      .map((chainItem) => {
        const fullItem = byId.get(Number(chainItem.id));
        return fullItem || chainItem;
      })
      .filter(Boolean);

    const safeChain = chain.length > 0 ? chain : [item];
    const key = getChainKeyFromItem({ ...item, inheritance_chain: safeChain });

    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, {
        id: `chain-${key}`,
        chain: safeChain,
        title: getChainTitle(safeChain),
      });
    }
  });

  return [...rowsByKey.values()].sort((a, b) => {
    const aFirst = a.chain[0];
    const bFirst = b.chain[0];

    const slotCompare = String(aFirst?.slot ?? "").localeCompare(
      String(bFirst?.slot ?? ""),
      "ja"
    );

    if (slotCompare !== 0) return slotCompare;

    return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ja");
  });
}

function chainHasObtainPlace(row) {
  return row.chain.some((item) => getObtainPlaces(item).length > 0);
}

function chainHasInheritance(row) {
  return row.chain.length > 1;
}

function chainMatchesSlot(row, slot) {
  if (!slot) return true;
  return row.chain.some((item) => String(item?.slot ?? "") === slot);
}

function chainMatchesType(row, type) {
  if (!type) return true;
  return row.chain.some((item) => String(item?.accessory_type ?? "") === type);
}

function chainMatchesKeyword(row, keyword) {
  if (!keyword) return true;

  const text = row.chain.map((item) => getSearchTextFromAccessory(item)).join(" ");
  return text.includes(keyword);
}

export default function AccessoryGuideClient() {
  const [accessories, setAccessories] = useState([]);
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState("");
  const [type, setType] = useState("");
  const [onlyInheritance, setOnlyInheritance] = useState(false);
  const [onlyObtainPlace, setOnlyObtainPlace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadAccessories() {
      setLoading(true);
      setErrorMessage("");

      try {
        const rows = await fetchAccessories();

        if (!ignore) {
          setAccessories(Array.isArray(rows) ? rows : []);
        }
      } catch (error) {
        console.error(error);

        if (!ignore) {
          setErrorMessage("アクセサリ情報の取得に失敗しました。");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAccessories();

    return () => {
      ignore = true;
    };
  }, []);

  const slots = useMemo(() => {
    return [
      ...new Set(accessories.map((item) => item.slot).filter(Boolean)),
    ].sort();
  }, [accessories]);

  const types = useMemo(() => {
    return [
      ...new Set(
        accessories.map((item) => item.accessory_type).filter(Boolean)
      ),
    ].sort();
  }, [accessories]);

  const chainRows = useMemo(() => {
    return buildChainRows(accessories);
  }, [accessories]);

  const filteredRows = useMemo(() => {
    const keyword = q.trim().toLowerCase();

    return chainRows.filter((row) => {
      if (!chainMatchesKeyword(row, keyword)) return false;
      if (!chainMatchesSlot(row, slot)) return false;
      if (!chainMatchesType(row, type)) return false;
      if (onlyInheritance && !chainHasInheritance(row)) return false;
      if (onlyObtainPlace && !chainHasObtainPlace(row)) return false;

      return true;
    });
  }, [chainRows, q, slot, type, onlyInheritance, onlyObtainPlace]);

  const visibleAccessoryCount = useMemo(() => {
    return filteredRows.reduce((total, row) => total + row.chain.length, 0);
  }, [filteredRows]);

  function resetFilters() {
    setQ("");
    setSlot("");
    setType("");
    setOnlyInheritance(false);
    setOnlyObtainPlace(false);
  }

  return (
    <main>
        <PageHeroTitle
            kicker="DQX Tools"
            title="アクセサリ伝承ガイド"
            maxWidth="100%"
            margin="0"
            padding="0"
          />
      <section className={styles.hero}>
        <div className={styles.heroCard}>
          <span>登録アクセサリ</span>
          <strong>{accessories.length}</strong>
          <small>items</small>
        </div>
      </section>

      <section className={styles.filters}>
        <label className={styles.searchBox}>
          <span>検索</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="アクセ名・伝承チェーン・入手場所・効果で検索"
          />
        </label>

        <label>
          <span>部位</span>
          <select value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="">すべて</option>
            {slots.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>種類</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">すべて</option>
            {types.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={onlyInheritance}
            onChange={(e) => setOnlyInheritance(e.target.checked)}
          />
          <span>伝承ありのみ</span>
        </label>

        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={onlyObtainPlace}
            onChange={(e) => setOnlyObtainPlace(e.target.checked)}
          />
          <span>入手場所ありのみ</span>
        </label>
      </section>

      <div className={styles.resultBar}>
        <p>
          表示中 <strong>{filteredRows.length}</strong> チェーン /{" "}
          <strong>{visibleAccessoryCount}</strong> アクセ
        </p>

        {(q || slot || type || onlyInheritance || onlyObtainPlace) && (
          <button type="button" onClick={resetFilters}>
            条件をリセット
          </button>
        )}
      </div>

      {loading && <p className={styles.status}>読み込み中...</p>}

      {!loading && errorMessage && (
        <p className={styles.error}>{errorMessage}</p>
      )}

      {!loading && !errorMessage && filteredRows.length === 0 && (
        <p className={styles.status}>条件に合うアクセサリがありません。</p>
      )}

      {!loading && !errorMessage && filteredRows.length > 0 && (
        <section className={styles.chainRows}>
          {filteredRows.map((row) => (
            <AccessoryChainRow key={row.id} row={row} />
          ))}
        </section>
      )}
    </main>
  );
}

function AccessoryChainRow({ row }) {
  return (
    <section className={styles.chainRow}>
      <div className={styles.chainRowHeader}>
        <div>
          <p className={styles.chainRowLabel}>伝承チェーン</p>
          <h2>{row.title}</h2>
        </div>

        <span>{row.chain.length}世代</span>
      </div>

      <div
        className={`${styles.chainScroller} ${
          row.chain.length === 1 ? styles.chainScrollerSingle : ""
        }`}
      >
        {row.chain.map((item) => (
          <AccessoryGuideCard
            key={`${row.id}-${item.id}`}
            item={item}
            chain={row.chain}
          />
        ))}
    </div>
    </section>
  );
}
const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

function getImageSrc(src = "") {
  if (!src) return "";

  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  if (src.startsWith("/storage/")) {
    return `${BACKEND_URL}${src}`;
  }

  return src;
}
function AccessoryGuideCard({ item, chain }) {
  const obtainPlaces = getObtainPlaces(item);
  const effects = getBaseEffects(item);
  const normalEffects = normalizeTextRows(item.effects_json);
  const syntheses = normalizeTextRows(item.synthesis_effects_json);

  return (
    <article className={styles.accessoryCard}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.cardMeta}>
            {item.inheritance_type && <span>{item.inheritance_type}</span>}
            {item.slot && <span>{item.slot}</span>}
          </div>

          <h3>{item.name}</h3>

         
        </div>

        {item.image_url && (
          <div className={styles.imageWrap}>
            <Image
              src={getImageSrc(item.image_url)}
              alt={item.name || "アクセサリ画像"}
              width={64}
              height={64}
              sizes="64px"
              loading="lazy"
              className={styles.accessoryImage}
            />
          </div>
        )}
      </div>

      <section className={styles.infoBlock}>
        <h4>入手場所</h4>

        {obtainPlaces.length > 0 ? (
          <ul className={styles.textList}>
            {obtainPlaces.map((text, index) => (
              <li key={`${item.id}-obtain-${index}`}>{text}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>入手場所未設定</p>
        )}
      </section>

      <section className={styles.infoBlock}>
        <h4>合成効果</h4>

        {syntheses.length > 0 ? (
          <ul className={styles.synthesisList}>
            {syntheses.map((text, index) => (
              <li key={`${item.id}-synthesis-${index}`}>{text}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>合成効果未設定</p>
        )}
      </section>

      <details className={styles.detailsBlock}>
        <summary>詳細を見る</summary>

        <div className={styles.detailsInner}>
          <section className={styles.infoBlock}>
            <h4>基礎効果</h4>

            {effects.length > 0 ? (
              <div className={styles.effectList}>
                {effects.map((effect) => (
                  <span key={effect.key}>
                    {effect.label} +{effect.value}
                  </span>
                ))}
              </div>
            ) : normalEffects.length > 0 ? (
              <ul className={styles.textList}>
                {normalEffects.map((text, index) => (
                  <li key={`${item.id}-effect-${index}`}>{text}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>基礎効果未設定</p>
            )}
          </section>

          <section className={styles.infoBlock}>
            <h4>説明</h4>

            {item.description ? (
              <p className={styles.description}>{item.description}</p>
            ) : (
              <p className={styles.muted}>説明未設定</p>
            )}
          </section>
        </div>
      </details>
    </article>
  );
}