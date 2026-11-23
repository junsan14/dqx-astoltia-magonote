"use client";
import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import useSWR from "swr";
import axios from "@/lib/axios";
import { resolveWeeklyTaskSearch } from "@/lib/weeklyTaskSearch.mjs";
import styles from "./WeeklyMapTasks.module.css";
export default function WeeklyMapTasks({ onApply, disabled, maps, spawns, monsters }) {
  const en = useLocale() === "en";
  const locale = en ? "en" : "ja";
  const [selected, setSelected] = useState("");
  const { data, error, mutate } = useSWR(`/api/weekly-map-tasks?locale=${locale}`, url => axios.get(url).then(r=>r.data), { refreshInterval: 60000 });
  const tasks = useMemo(()=>data?.data?.filter(row=>row.category===selected) || [],[data,selected]);
  const result = useMemo(()=>resolveWeeklyTaskSearch(tasks,maps,spawns,monsters),[tasks,maps,spawns,monsters]);
  const labels = en ? {scribe:"This week’s Daimaou’s Scribe",fitness:"This week’s Fitness"} : {scribe:"今週の大魔王の代筆家",fitness:"今週のフィットネス"};
  return <section className={styles.section} aria-label={en ? "Weekly tasks" : "今週のお題"}>
    <div className={styles.buttons} role="group" aria-label={en ? "Choose a weekly task" : "お題を選択"}>
      {Object.entries(labels).map(([key,label])=><button type="button" key={key} disabled={disabled || !data || Boolean(error)} aria-pressed={selected===key} aria-controls="weekly-task-content" onClick={()=>{
        setSelected(key);
        const rows=data.data.filter(item=>item.category===key);
        const next=resolveWeeklyTaskSearch(rows,maps,spawns,monsters);
        if(next.task) onApply(next.task);
      }}>{label}</button>)}
    </div>
    <div id="weekly-task-content" className={styles.content} aria-live="polite">
      {error ? <span>{en ? "Could not load tasks." : "お題を読み込めませんでした。"} <button type="button" onClick={()=>mutate()}>{en ? "Retry" : "再読み込み"}</button></span>
      : !data || disabled ? <span>{en ? "Loading…" : "読み込み中…"}</span>
      : !selected ? <span>{en ? "Select a weekly task." : "今週のお題を選択"}</span>
      : <><small>{data.week_start}〜</small>
        {tasks.length ? <>
          {tasks.map(task=><button type="button" key={task.id} className={styles.task} title={task.body} onClick={()=>onApply(task)}>{task.body}</button>)}
          {tasks.length > 1 && <span className={styles.hint}>{result.combined ? (en ? "Shared hunting location found" : "同じ場所で両方狙えます") : (en ? "No shared spawn data; select each task" : "同時達成の出現情報なし・お題ごとに検索")}</span>}
        </> : <span>{en ? "Being prepared." : "今週のお題は準備中です。"}</span>}</>}
    </div>
  </section>;
}
