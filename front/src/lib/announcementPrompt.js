export const ANNOUNCEMENT_PROMPT_EVENT = "admin:announcement-prompt";

const resources = {
  "monster-search": "モンスター",
  orbs: "宝珠",
  items: "アイテム",
  equipments: "装備",
  accessories: "アクセサリー",
  maps: "マップ",
  "monster-map-spawns": "モンスターの生息地",
  continents: "大陸",
  "craft-types": "職人種別",
  "craft-product-types": "職人の作成品種別",
  "equipment-types": "装備種別",
  "game-jobs": "職業",
  "crystal-rules": "結晶の設定",
  bosses: "ボス",
};

function queryPath(path, params) {
  return `${path}?${new URLSearchParams(params)}`;
}

function draftFromResponse(response) {
  const pathname = new URL(response.config.url, window.location.origin).pathname;
  const match = pathname.match(/^\/api\/([^/]+)(?:\/(\d+))?\/?$/);
  if (!match || !resources[match[1]]) return null;
  const [, resource, routeId] = match;
  const method = String(response.config.method || "").toLowerCase();
  if (!["post", "put", "patch"].includes(method)) return null;
  if (response.status < 200 || response.status >= 300) return null;
  const data = response.data?.data ?? response.data;
  if (!data || Array.isArray(data) || typeof data !== "object") return null;
  const id = data.id ?? routeId;
  const name = String(data.item_name || data.name || data.monster_name || resources[resource]);
  const action = routeId ? "更新" : "追加";
  let pageLabel = "職人あれこれ";
  let pagePath = "/tools/craft-profit";
  let linkOptions = [];

  if (resource === "monster-search") {
    pageLabel = "モンスター詳細";
    pagePath = id ? `/tools/monster-search/${id}` : "/tools/monster-search";
  } else if (["orbs", "items", "accessories"].includes(resource)) {
    const type = { orbs: "orb", items: "item", accessories: "accessory" }[resource];
    pageLabel = "モンスター検索";
    pagePath = queryPath("/tools/monster-search", { type, q: name });
  } else if (resource === "equipments") {
    pagePath = queryPath("/tools/craft-profit", { q: name });
    linkOptions = [
      { label: "素材・職人用の数値 → 職人あれこれ", page_label: pageLabel, page_path: pagePath },
      { label: "ドロップ情報 → モンスター検索", page_label: "モンスター検索", page_path: queryPath("/tools/monster-search", { type: "equipment", q: name }) },
    ];
  } else if (["maps", "monster-map-spawns", "continents"].includes(resource)) {
    pageLabel = "マップ・モンスター検索";
    const mapId = resource === "maps" ? id : data.map_id;
    pagePath = mapId ? queryPath("/tools/map-monster-browser", {
      ...(data.continent_id ? { continentId: data.continent_id } : {}), mapId,
    }) : "/tools/map-monster-browser";
  } else if (resource === "bosses") {
    pageLabel = "重さチェッカー";
    pagePath = "/tools/weight-checker";
  }

  return {
    locale: "ja", category: "update", page_label: pageLabel, page_path: pagePath,
    title: `${name}の情報を${action}しました`.slice(0, 200),
    body: `「${name}」の情報を${action}しました。`,
    source_label: `${resources[resource]}「${name}」を${action}しました。`,
    link_options: linkOptions,
  };
}

// Install only on the clients used by the content editors. Read requests,
// uploads, deletes, reports, and announcement saves cannot trigger a prompt.
export function attachAnnouncementPrompt(client) {
  client.interceptors.response.use(response => {
    if (typeof window === "undefined" || !/^\/(?:ja\/|en\/)?admin(?:\/|$)/.test(window.location.pathname)) return response;
    try {
      const draft = draftFromResponse(response);
      if (draft) window.dispatchEvent(new CustomEvent(ANNOUNCEMENT_PROMPT_EVENT, { detail: draft }));
    } catch (error) {
      // A notification problem must never turn a successful data save into an error.
      console.error("Unable to prepare announcement", error);
    }
    return response;
  });
}
