"use client";

import { NEW_INFORMATION_TYPES, newInformationFields, newInformationText } from "@/lib/announcementTemplates";

export default function NewInformationFields({ form, onChange, onApply }) {
  if (form.category !== "new_info") return null;
  const fields = newInformationFields(form);
  return <>
    <label>追加する情報<select value={fields.template_type} onChange={event => onChange("template_type", event.target.value)}>
      {Object.entries(NEW_INFORMATION_TYPES).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label>対象の名前<input maxLength={160} value={fields.template_name} onChange={event => onChange("template_name", event.target.value)} placeholder="ゆめにゅうどう・異" /></label>
    <label>バージョン<input maxLength={20} value={fields.template_version} onChange={event => onChange("template_version", event.target.value)} placeholder="8.1" /></label>
    <button type="button" onClick={() => {
      if (window.confirm("タイトルと本文を、入力した対象・名前・バージョンの定型文に置き換えますか？")) onApply(newInformationText(form));
    }}>タイトル・本文に定型文を入れ直す</button>
  </>;
}
