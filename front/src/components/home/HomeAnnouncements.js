"use client";

import { useId, useState } from "react";
import useSWR from "swr";
import { useLocale } from "next-intl";
import ProgressIntlLink from "@/components/common/route-progress/ProgressIntlLink";
import axios from "@/lib/axios";
import styles from "./HomeAnnouncements.module.css";

export default function HomeAnnouncements({ archive = false }) {
  const locale = useLocale();
  const en = locale === "en";
  const [page, setPage] = useState(1);
  const { data, error, mutate } = useSWR(`/api/announcements?locale=${locale}&per_page=${archive ? 20 : 5}&page=${page}`, url => axios.get(url).then(res => res.data));
  const categories = en ? { update: "Update", fix: "Fix", feature: "New feature", new_info: "New info" } : { update: "データ更新", fix: "修正", feature: "新機能", new_info: "新情報追加" };

  return (
    <section className={`${styles.section} ${archive ? styles.archive : ""}`} aria-label={en ? "Updates" : "更新のお知らせ"}>
      {!archive && (
        <div className={styles.heading}>
          <h2>{en ? "Updates" : "更新のお知らせ"}</h2>
          <ProgressIntlLink href="/announcements">{en ? "All updates →" : "すべて見る →"}</ProgressIntlLink>
        </div>
      )}
      {error ? <p role="alert">{en ? "Unable to load updates." : "お知らせを読み込めませんでした。"} <button onClick={() => mutate()}>{en ? "Retry" : "再読み込み"}</button></p>
        : !data ? <p role="status">{en ? "Loading…" : "読み込み中…"}</p>
        : data.data.length === 0 ? <p>{en ? "No updates yet." : "お知らせはまだありません。"}</p>
        : <ul className={styles.list}>{data.data.map(item => (
          <AnnouncementRow key={item.id} item={item} en={en} category={categories[item.category]} />
        ))}</ul>}
      {archive && data && <nav className={styles.heading} aria-label={en ? "Pagination" : "ページ切り替え"}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>{en ? "Previous" : "前へ"}</button>
        <span>{page} / {data.last_page}</span>
        <button disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>{en ? "Next" : "次へ"}</button>
      </nav>}
    </section>
  );
}


function AnnouncementRow({ item, en, category }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  //const hasLink = item.page_path && /^\/tools\/[a-z0-9/-]+(?:\?[a-zA-Z0-9_%+&=.,:;@!()\/~-]*)?$/.test(item.page_path);
const hasLink =
  item.page_path &&
  /^\/tools\/[a-z0-9/-]+(?:\?[a-zA-Z0-9_%+&=.,:;@!()/~-]*)?$/.test(item.page_path);
  return (
    <li className={styles.card}>
      <button
        type="button"
        id={`${id}-trigger`}
        className={styles.summary}
        aria-expanded={open}
        aria-controls={`${id}-content`}
        onClick={() => setOpen(value => !value)}
      >
        <time className={styles.date} dateTime={item.published_at}>{new Date(item.published_at).toLocaleDateString(en ? "en-US" : "ja-JP", { timeZone: "Asia/Tokyo" })}</time>
        <span className={styles.badge}>{category}</span>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </button>
      <div
        id={`${id}-content`}
        className={`${styles.accordion} ${open ? styles.open : ""}`}
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!open}
        {...(!open ? { inert: "" } : {})}
      >
        <div className={styles.accordionInner}>
          <div className={styles.content}>
            <p className={styles.body}>{item.body}</p>
            {hasLink ? <ProgressIntlLink className={styles.pageLink} href={item.page_path} tabIndex={open ? undefined : -1}>{item.page_label || (en ? "View page" : "対象ページ")} →</ProgressIntlLink> : <span className={styles.pageLabel}>{item.page_label}</span>}
          </div>
        </div>
      </div>
    </li>
  );
}
