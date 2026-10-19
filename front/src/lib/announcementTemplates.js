export const NEW_INFORMATION_TYPES = {
  monster: ["モンスター", "monster"], orb: ["宝珠", "orb"], map: ["MAP", "map"],
  equipment: ["装備", "equipment"], item: ["アイテム", "item"],
  accessory: ["アクセサリー", "accessory"], boss: ["ボス", "boss"], other: ["情報", "information"],
};

export function newInformationFields(form) {
  const url = new URL(form.page_path || "/", "https://local.invalid");
  const titleMatch = String(form.title || "").match(/^新(.+?)追加「(.*)」$/);
  const titleType = Object.keys(NEW_INFORMATION_TYPES).find(key => NEW_INFORMATION_TYPES[key][0] === titleMatch?.[1]);
  const type = form.template_type || titleType || form.target_type ||
    (url.pathname.startsWith("/tools/monster-search/") ? "monster" : url.searchParams.get("type")) ||
    (url.pathname === "/tools/map-monster-browser" ? "map" : url.pathname === "/tools/craft-profit" && url.searchParams.has("q") ? "equipment" : "other");
  return {
    template_type: NEW_INFORMATION_TYPES[type] ? type : "other",
    template_name: form.template_name ?? titleMatch?.[2] ?? form.target_name ?? url.searchParams.get("q") ??
      String(form.title || "").replace(/の(?:情報|ドロップ情報|装備・職人データ|職人種別の設定)を(?:更新|追加)しました$/, ""),
    template_version: form.template_version ?? String(form.body || "").match(/^ver\.([^\sの]+)(?:の|\s)/)?.[1] ?? "8.1",
  };
}

export function newInformationText(form) {
  const fields = newInformationFields(form);
  const [ja, en] = NEW_INFORMATION_TYPES[fields.template_type];
  const name = fields.template_name.trim();
  const version = fields.template_version.trim().replace(/^ver\.?\s*/i, "");
  return form.locale === "en" ? {
    title: `New ${en} added${name ? `: ${name}` : ""}`,
    body: `${version ? `ver.${version}: ` : ""}Added new ${en} information.`,
  } : {
    title: `新${ja}追加${name ? `「${name}」` : ""}`,
    body: `${version ? `ver.${version}の` : ""}新${ja}情報作成`,
  };
}

export function changeAnnouncementField(form, key, value) {
  const next = { ...form, [key]: value };
  if (key === "category" && value === "new_info") {
    return { ...next, ...newInformationFields(form), ...newInformationText(next) };
  }
  if (form.category === "new_info" && (key.startsWith("template_") || key === "locale")) {
    const before = newInformationText(form);
    const after = newInformationText(next);
    // Keep manually edited copy when changing template inputs.
    if (form.title === before.title) next.title = after.title;
    if (form.body === before.body) next.body = after.body;
  }
  return next;
}
