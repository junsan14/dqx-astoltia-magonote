"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import axios from "@/lib/axios";
import { changeAnnouncementField } from "@/lib/announcementTemplates";
import NewInformationFields from "./NewInformationFields";
import styles from "./AnnouncementsEditor.module.css";

const empty = { locale: "ja", category: "update", page_label: "", page_path: "", title: "", body: "" };
const fetcher = url => axios.get(url).then(res => res.data);
const fields = { page_label: "対象ページ名", page_path: "対象ページのパス（任意）", title: "タイトル", body: "本文" };

export default function AnnouncementsEditor() {
  const [page, setPage] = useState(1);
  const { data: list, error: listError, mutate } = useSWR(`/api/admin/announcements?page=${page}`, fetcher);
  const { data: candidates, error: candidatesError } = useSWR("/api/admin/announcements/candidates", fetcher);
  const [form, setForm] = useState(empty);
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialized && candidates) {
      setForm({ ...empty, ...(candidates.data[0] || {}) });
      setInitialized(true);
    }
  }, [candidates, initialized]);

  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function select(value) {
    if (dirty && !window.confirm("未保存の編集を破棄して切り替えますか？")) return;
    setInitialized(true);
    setForm({ ...empty, ...value });
    setDirty(false);
    setMessage("");
    setError("");
  }

  function change(key, value) {
    setInitialized(true);
    setDirty(true);
    setForm(prev => changeAnnouncementField(prev, key, value));
  }

  async function save(event) {
    event.preventDefault();
    const publish = event.nativeEvent.submitter?.value === "publish";
    setBusy(true); setMessage(""); setError("");
    try {
      await axios.get("/sanctum/csrf-cookie");
      const payload = Object.fromEntries(Object.keys(empty).map(key => [key, form[key]]));
      payload.is_published = publish;
      const response = form.id
        ? await axios.put(`/api/admin/announcements/${form.id}`, payload)
        : await axios.post("/api/admin/announcements", payload);
      setForm({ ...form, ...response.data.data });
      setDirty(false);
      setMessage(publish ? "公開しました。TOPページに表示されます。" : "下書きに保存しました。公開画面には表示されません。");
      await mutate();
    } catch (e) {
      setError(Object.values(e.response?.data?.errors || {}).flat().join(" / ") || "保存できませんでした。入力内容と接続を確認してください。");
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.main}>
      <h1>更新のお知らせ管理</h1>
      <p>DBの更新から文面を作り、内容を手直しして公開できます。機能追加は「手入力で新規作成」から登録してください。</p>
      <div className={styles.layout}>
        <aside className={styles.panel}>
          <button disabled={busy} onClick={() => select(empty)}>手入力で新規作成</button>
          <h2>DBからの文面候補</h2>
          <p className={styles.hint}>直近30日・最大50件。最初の候補を初期表示します。更新日時に基づくため、ドロップ変更は記録開始以降の追加・変更・削除を反映します。その他は更新日時から候補を作るため、具体的な変更項目は本文で補足してください。</p>
          {candidatesError ? <p role="alert">更新候補を取得できませんでした。</p> : !candidates ? <p>読み込み中…</p> : !candidates.data.length ? <p>最近の更新はありません。</p> : <div className={styles.candidates}>{candidates.data.map(item => <button disabled={busy} key={item.key} onClick={() => select(item)}>{item.title}<small>{item.page_label} / {item.updated_at}</small></button>)}</div>}
          <h2>保存済みのお知らせ</h2>
          {listError ? <p role="alert">一覧を取得できませんでした。</p> : !list ? <p>読み込み中…</p> : !list.data.length ? <p>保存済みのお知らせはありません。</p> : list.data.map(item => <button disabled={busy} key={item.id} onClick={() => select(item)} aria-pressed={form.id === item.id}>{item.published_at ? "［公開］" : "［下書き］"}{item.title}</button>)}
          {list && <div className={styles.actions}><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>前へ</button><span>{page} / {list.last_page}</span><button disabled={busy || page >= list.last_page} onClick={() => setPage(page + 1)}>次へ</button></div>}
        </aside>
        <form className={styles.panel} onSubmit={save}>
          <h2>{form.id ? "お知らせを編集" : "新しいお知らせ"}</h2>
          <p>{form.published_at ? "公開中" : "下書き（未公開）"}{dirty ? " ・ 未保存の変更あり" : ""}</p>
          <fieldset disabled={busy}>
            <label>表示言語<select value={form.locale} onChange={e => change("locale", e.target.value)}><option value="ja">日本語</option><option value="en">English</option></select></label>
            <label>種類<select value={form.category} onChange={e => change("category", e.target.value)}><option value="update">データ更新</option><option value="fix">修正</option><option value="feature">新機能</option><option value="new_info">新情報追加</option></select></label>
            <NewInformationFields form={form} onChange={change} onApply={text => { setDirty(true); setForm(prev => ({ ...prev, ...text })); }} />
            {form.link_options?.length > 0 && <label>変更内容に合わせたリンク先<select value={form.link_options.some(option => option.page_path === form.page_path) ? form.page_path : ""} onChange={e => {
              const option = form.link_options.find(option => option.page_path === e.target.value);
              if (!option) return;
              setDirty(true);
              setForm(prev => ({ ...prev, page_path: option.page_path, page_label: option.page_label }));
            }}><option value="" disabled>手動で設定したリンク</option>{form.link_options.map(option => <option key={option.page_path} value={option.page_path}>{option.label}</option>)}</select></label>}
            {Object.entries(fields).map(([key, label]) => <label key={key}>{label}{key === "body" ? <textarea required rows={8} maxLength={10000} value={form[key]} onChange={e => change(key, e.target.value)} /> : <input required={key !== "page_path"} maxLength={key === "title" ? 200 : key === "page_label" ? 100 : 2048} value={form[key] || ""} placeholder={key === "page_path" ? "/tools/monster-search" : ""} onChange={e => change(key, e.target.value)} />}</label>)}
            <p className={styles.hint}>パスは /tools/ から入力してください。宝珠などの候補には検索名を、装備には変更内容に合わせた検索先をセットします。表示言語に合わせてリンクします。英語で公開する場合はタイトル・本文・ページ名も英語に編集してください。</p>
            <div className={styles.actions}><button type="submit" value="draft">{form.published_at ? "非公開にして下書き保存" : "下書き保存"}</button><button className={styles.primary} type="submit" value="publish">{busy ? "保存中…" : form.published_at ? "公開内容を更新" : "公開する"}</button></div>
          </fieldset>
          {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
        </form>
      </div>
    </main>
  );
}
