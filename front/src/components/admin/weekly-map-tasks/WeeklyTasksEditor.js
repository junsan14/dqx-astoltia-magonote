"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import axios from "@/lib/axios";
import SearchableSelect from "@/components/common/form/SearchableSelect";
import styles from "./WeeklyTasksEditor.module.css";
const empty = { body:"", body_en:"", continent_id:"", search_mode:"map", map_id:"", monster_system_type_id:"", is_published:false };
export default function WeeklyTasksEditor() {
  const [week, setWeek] = useState("");
  const [category, setCategory] = useState("scribe");
  const [slot,setSlot] = useState(1);
  const [form, setForm] = useState(empty);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");
  const {data,error,mutate,isValidating} = useSWR(`/api/admin/weekly-map-tasks${week ? `?week_start=${week}` : ""}`, url=>axios.get(url).then(r=>r.data), {revalidateOnFocus:false});
  useEffect(()=>{
    if (!data) return;
    const row=data.data.find(item=>item.category===category && Number(item.slot || 1)===slot);
    const defaultContinent = data.continents.find(item=>item.name === (category === "scribe" ? "魔界" : "天星郷"));
    setForm(row ? {...empty,...row, map_id:row.map_id || "",monster_system_type_id:row.monster_system_type_id || ""} : {...empty, continent_id:defaultContinent?.id || ""});
    setNotice("");
  },[data,category,slot]);
  function field(key,value) {setForm(prev=>({...prev,[key]:value}));}
  async function save(event) {
    event.preventDefault();
    if (form.search_mode === "map" && !form.map_id) { setNotice("マップ名を入力し、候補から対象マップを確定してください。"); return; }
    setSaving(true);setNotice("");
    try {
      await axios.get("/sanctum/csrf-cookie");
      const token=document.cookie.split("; ").find(value=>value.startsWith("XSRF-TOKEN="));
      await axios.put("/api/admin/weekly-map-tasks",{...form,week_start:data.week_start,category,slot,map_id:form.search_mode==="map" ? form.map_id : null,monster_system_type_id:form.search_mode==="system" ? form.monster_system_type_id : null}, {headers:token ? {"X-XSRF-TOKEN":decodeURIComponent(token.slice(11))} : {}});
      await mutate();setNotice("保存しました。公開にしたお題は、対象週になると表示されます。");
    } catch(e) {setNotice(Object.values(e.response?.data?.errors || {}).flat().join(" / ") || "保存できませんでした。入力内容とログイン状態を確認してください。");}
    finally {setSaving(false);}
  }
  return <main className={styles.page}>
    <h1>今週のお題管理</h1><p>各週・各種別に2件まで登録できます。お題1・2をそれぞれ保存してください。日曜朝6時（日本時間）に表示対象が切り替わります。未登録・下書きの週は「準備中」と表示されます。</p>
    <div className={styles.controls}>
      <label>対象週の日曜日<input type="date" value={week || data?.week_start || ""} disabled={saving} onChange={e=>setWeek(e.target.value)} /></label>
      <div className={styles.tabs} role="group" aria-label="種別">
        {[['scribe','大魔王の代筆家'],['fitness','フィットネス']].map(([key,label])=><button key={key} type="button" disabled={saving} aria-pressed={category===key} onClick={()=>{setCategory(key);setSlot(1);}}>{label}</button>)}
      </div>
      <div className={styles.tabs} role="group" aria-label="お題番号">{[1,2].map(number=><button key={number} type="button" disabled={saving} aria-pressed={slot===number} onClick={()=>setSlot(number)}>お題{number}</button>)}</div>
    </div>
    {error ? <p role="alert">読み込めませんでした。日曜日の日付・管理者権限を確認してください。<button onClick={()=>mutate()}>再読み込み</button></p> : !data ? <p role="status">読み込み中…</p> :
    <form onSubmit={save}><fieldset disabled={saving || isValidating}>
      <label>お題（日本語）<textarea required maxLength={1000} value={form.body} onChange={e=>field("body",e.target.value)} placeholder="ジャリムバハ砂漠にいるモンスターを　２０匹討伐する。" /></label>
      <label>お題（英語・任意）<textarea maxLength={1000} value={form.body_en || ""} onChange={e=>field("body_en",e.target.value)} /></label>
      <label>大陸<select required value={form.continent_id} onChange={e=>setForm(prev=>({...prev,continent_id:e.target.value,map_id:""}))}><option value="">選択してください</option>{data.continents.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>検索方法<select value={form.search_mode} onChange={e=>setForm(prev=>({...prev,search_mode:e.target.value,map_id:"",monster_system_type_id:""}))}><option value="map">マップで検索</option><option value="system">系統で検索</option></select></label>
      {form.search_mode==="map" ? <div><span>マップ（名前を入力して絞り込み）</span><SearchableSelect value={form.map_id} onChange={value=>field("map_id",value)} options={data.maps.filter(row=>String(row.continent_id)===String(form.continent_id))} ariaLabel="マップ" placeholder="マップ名を入力・選択" disabled={saving || isValidating || !form.continent_id} /></div> : <label>モンスター系統<select required value={form.monster_system_type_id} onChange={e=>field("monster_system_type_id",e.target.value)}><option value="">選択してください</option>{data.systems.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      <label className={styles.check}><input type="checkbox" checked={form.is_published} onChange={e=>field("is_published",e.target.checked)} />公開する（オフで下書き・公開取り下げ）</label>
      <button type="submit">{saving ? "保存中…" : `お題${slot}を保存`}</button>
    </fieldset></form>}
    {notice && <p role="status">{notice}</p>}
  </main>;
}
