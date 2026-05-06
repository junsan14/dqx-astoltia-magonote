"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchKishojuNearRainbow } from "@/lib/kishoju";
import styles from "./kishojuAdmin.module.css";

const RAINBOW_LIMIT_MINUTES = 60;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function getRainbowInfo(item, now) {
  const createdAt = new Date(item.created_at);
  const rainbowAt = addMinutes(createdAt, RAINBOW_LIMIT_MINUTES);
  const diffMs = rainbowAt.getTime() - now.getTime();

  return {
    createdAt,
    rainbowAt,
    remainingMinutes: Math.max(0, Math.ceil(diffMs / 1000 / 60)),
    isExpired: diffMs <= 0,
  };
}

function formatTime(value) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRedGauge(color) {
  return color === "赤" || color === "red";
}

export default function KishojuAdminPage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    roomsCount: 0,
    membersCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [now, setNow] = useState(new Date());

  async function loadNearRainbowItems() {
    setErrorMessage("");

    try {
      const data = await fetchKishojuNearRainbow();

      setItems(data.items || []);
      setSummary(data.summary);
    } catch (error) {
      setErrorMessage(error.message || "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadNearRainbowItems();

    const fetchTimer = setInterval(() => {
      loadNearRainbowItems();
    }, 10000);

    const clockTimer = setInterval(() => {
      setNow(new Date());
    }, 10000);

    return () => {
      clearInterval(fetchTimer);
      clearInterval(clockTimer);
    };
  }, []);

  const activeRedItems = useMemo(() => {
    return items
      .filter((item) => isRedGauge(item.gauge_color))
      .map((item) => {
        const info = getRainbowInfo(item, now);

        return {
          ...item,
          remainingMinutes: info.remainingMinutes,
          rainbowAt: info.rainbowAt,
          isExpired: info.isExpired,
        };
      })
      .filter((item) => !item.isExpired)
      .sort((a, b) => a.remainingMinutes - b.remainingMinutes);
  }, [items, now]);

  const latestUpdatedAt = useMemo(() => {
    if (activeRedItems.length === 0) return "-";

    const latest = [...activeRedItems].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )[0];

    return formatTime(latest.created_at);
  }, [activeRedItems]);

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin / Kishoju Watch</p>
          <h1 className={styles.title}>虹化チェック</h1>
          <p className={styles.lead}>
            全ルームから赤登録をまとめて表示します。
            虹化までの残り時間が短い順に並びます。
          </p>
        </div>

        <button
          type="button"
          className={styles.reloadButton}
          onClick={loadNearRainbowItems}
        >
          更新
        </button>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>稼働ルーム</span>
          <strong>{summary.roomsCount}</strong>
        </article>

        <article className={styles.summaryCard}>
          <span>参加ユーザー</span>
          <strong>{summary.membersCount}</strong>
        </article>

        <article className={styles.summaryCard}>
          <span>赤報告</span>
          <strong>{activeRedItems.length}</strong>
        </article>

        <article className={styles.summaryCard}>
          <span>最終登録</span>
          <strong className={styles.smallValue}>{latestUpdatedAt}</strong>
        </article>
      </section>

      {errorMessage && <p className={styles.errorBox}>{errorMessage}</p>}

      {isLoading ? (
        <div className={styles.emptyBox}>読み込み中...</div>
      ) : activeRedItems.length === 0 ? (
        <div className={styles.emptyBox}>現在、赤登録はありません。</div>
      ) : (
        <section className={styles.board}>
          {activeRedItems.map((item) => (
            <article
              className={`${styles.watchCard} ${styles.red}`}
              key={`${item.room_public_id}-${item.id}`}
            >
              <div className={styles.cardMain}>
                <div className={styles.serverBox}>
                  <span>S{item.server_no}</span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <div className={styles.mainInfo}>
                      <span className={styles.mapName}>{item.map_name}</span>
                      <span className={styles.roomName}>
                        {item.room_name || "輝晶獣 分散ルーム"}
                      </span>
                    </div>

                    <div className={styles.remainBox}>
                      <span>あと</span>
                      <strong>{item.remainingMinutes}分</strong>
                    </div>
                  </div>

                  <div className={styles.cardMeta}>
                    <span className={styles.gaugeBadge}>赤</span>
                    <span>登録: {formatTime(item.created_at)}</span>
                    <span>虹化目安: {formatTime(item.rainbowAt)}</span>
                    <span>報告者: {item.reported_by || "-"}</span>
                  </div>

                  {item.memo && <p className={styles.memo}>{item.memo}</p>}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}