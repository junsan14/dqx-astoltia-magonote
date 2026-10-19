"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSWRConfig } from "swr";
import axios from "@/lib/axios";
import { ANNOUNCEMENT_PROMPT_EVENT } from "@/lib/announcementPrompt";
import styles from "./AnnouncementPrompt.module.css";

export default function AnnouncementPromptProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [status, setStatus] = useState("");
  const sequence = useRef(0);

  useEffect(() => {
    const receive = event => {
      setStatus("");
      setQueue(previous => [...previous, { ...event.detail, promptId: ++sequence.current }]);
    };
    window.addEventListener(ANNOUNCEMENT_PROMPT_EVENT, receive);
    return () => window.removeEventListener(ANNOUNCEMENT_PROMPT_EVENT, receive);
  }, []);

  function finish(message = "") {
    setQueue(previous => previous.slice(1));
    setStatus(message);
  }

  return <>
    {children}
    {status && <div role="status" className={styles.toast}>{status}<button type="button" aria-label="通知を閉じる" onClick={() => setStatus("")}>×</button></div>}
    {queue.length > 0 && createPortal(
      <AnnouncementPrompt key={queue[0].promptId} draft={queue[0]} onFinish={finish} remaining={queue.length - 1} />,
      document.body
    )}
  </>;
}

function AnnouncementPrompt({ draft, onFinish, remaining }) {
  const dialogRef = useRef(null);
  const submitting = useRef(false);
  const [form, setForm] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, []);

  function change(key, value) {
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function skip() {
    if (!submitting.current) onFinish();
  }

  async function save(event) {
    event.preventDefault();
    if (submitting.current) return;
    const publish = event.nativeEvent.submitter?.value === "publish";
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await axios.get("/sanctum/csrf-cookie");
      await axios.post("/api/admin/announcements", {
        locale: form.locale, category: form.category,
        page_label: form.page_label, page_path: form.page_path,
        title: form.title, body: form.body, is_published: publish,
      });
    } catch (e) {
      setError(Object.values(e.response?.data?.errors || {}).flat().join(" / ") || "お知らせを保存できませんでした。元のデータは保存済みです。内容を確認してもう一度お試しください。");
      submitting.current = false;
      setSaving(false);
      return;
    }
    // Closing after success prevents a failed cache refresh from offering a
    // second publish action for an announcement that was already created.
    onFinish(publish ? "お知らせを公開しました。TOPとお知らせ一覧に表示されます。" : "お知らせを下書き保存しました。お知らせ管理から編集・公開できます。");
    void mutate(key => typeof key === "string" && /^\/api\/(?:admin\/)?announcements(?:\?|$)/.test(key)).catch(() => {});
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="announcement-prompt-title" aria-describedby="announcement-prompt-description" onCancel={event => { event.preventDefault(); skip(); }}>
      <form onSubmit={save}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>保存が完了しました</p><h2 id="announcement-prompt-title">お知らせに掲載しますか？</h2></div>
          <button className={styles.close} type="button" aria-label="今回は掲載せず閉じる" disabled={saving} onClick={skip}>×</button>
        </header>
        <div className={styles.content}>
          <p id="announcement-prompt-description" className={styles.description}>{draft.source_label}<br />掲載内容を編集して、そのまま公開できます。</p>
          <fieldset disabled={saving}>
            <div className={styles.columns}>
              <label>表示言語<select value={form.locale} onChange={e => change("locale", e.target.value)}><option value="ja">日本語</option><option value="en">English</option></select></label>
              <label>種類<select value={form.category} onChange={e => change("category", e.target.value)}><option value="update">データ更新</option><option value="fix">修正</option><option value="feature">新機能</option></select></label>
            </div>
            <label>タイトル<input autoFocus required maxLength={200} value={form.title} onChange={e => change("title", e.target.value)} /></label>
            <label>本文<textarea required rows={4} maxLength={10000} value={form.body} onChange={e => change("body", e.target.value)} /></label>
            {form.link_options?.length > 0 && <label>変更内容に合わせたリンク先<select value={form.link_options.some(option => option.page_path === form.page_path) ? form.page_path : ""} onChange={e => {
              const option = form.link_options.find(option => option.page_path === e.target.value);
              if (option) setForm(previous => ({ ...previous, page_path: option.page_path, page_label: option.page_label }));
            }}><option value="" disabled>手動設定</option>{form.link_options.map(option => <option key={option.page_path} value={option.page_path}>{option.label}</option>)}</select></label>}
            <label>対象ページ名<input required maxLength={100} value={form.page_label} onChange={e => change("page_label", e.target.value)} /></label>
            <label>リンク先（任意）<input maxLength={2048} value={form.page_path} onChange={e => change("page_path", e.target.value)} placeholder="/tools/monster-search/84" /></label>
            {form.locale === "en" && <p className={styles.hint}>英語向けのタイトル・本文・対象ページ名に編集してください。</p>}
          </fieldset>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {remaining > 0 && <p className={styles.hint}>ほかに{remaining}件の保存済みデータのお知らせ候補があります。</p>}
        </div>
        <footer className={styles.actions}>
          <button type="button" disabled={saving} onClick={skip}>今回は掲載しない</button>
          <button type="submit" value="draft" disabled={saving}>下書き保存</button>
          <button type="submit" value="publish" className={styles.primary} disabled={saving}>{saving ? "保存中…" : "お知らせに公開する"}</button>
        </footer>
      </form>
    </dialog>
  );
}
