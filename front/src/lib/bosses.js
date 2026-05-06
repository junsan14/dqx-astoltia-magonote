import axios from "axios";

function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  return apiUrl.replace(/\/$/, "");
}

const API_URL = getApiUrl();

const api = axios.create({
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

export const BOSS_NUMBER_FIELDS = [
  "sortOrder",
  "level",
  "hp",
  "mp",
  "attack",
  "defense",
  "magicAttack",
  "magicDefense",
  "agility",
  "weight",
  "disadvantageWeight",
  "equalWeight",
  "winWeight",
  "completeWeight",
  "wbDisadvantageWeight",
  "wbEqualWeight",
  "wbWinWeight",
  "wbCompleteWeight",
];

export function str(value) {
  return value == null ? "" : String(value);
}

function normalizeNumberInput(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
}

function toBooleanValue(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return Boolean(value);
}

export function safeJsonParse(value, fallback) {
  if (value == null || value === "") return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJsonString(value, fallbackJson = "{}") {
  try {
    return JSON.stringify(value ?? JSON.parse(fallbackJson));
  } catch {
    return fallbackJson;
  }
}

export function makeKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `boss_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createEmptyBossStat() {
  return {
    __key: makeKey(),

    id: null,
    bossId: null,

    variant: "",
    level: "",
    hp: "",
    mp: "",
    attack: "",
    defense: "",
    magicAttack: "",
    magicDefense: "",
    agility: "",
    weight: "",

    extraStatsJson: "{}",
    note: "",

    createdAt: null,
    updatedAt: null,
  };
}

export function createEmptyBossPushWeight() {
  return {
    __key: makeKey(),

    id: null,
    bossId: null,

    variant: "",

    disadvantageWeight: "",
    equalWeight: "",
    winWeight: "",
    completeWeight: "",

    wbDisadvantageWeight: "",
    wbEqualWeight: "",
    wbWinWeight: "",
    wbCompleteWeight: "",

    note: "",

    createdAt: null,
    updatedAt: null,
  };
}

export function createEmptyBossRow() {
  return {
    __key: makeKey(),

    id: null,

    bossId: "",
    name: "",
    nameEn: "",

    category: "",
    series: "",
    race: "",

    imageUrl: "",
    sourceUrl: "",

    description: "",
    note: "",

    isActive: true,
    sortOrder: "0",

    stats: [],
    pushWeights: [],

    createdAt: null,
    updatedAt: null,
  };
}

export function normalizeBossStat(row = {}) {
  const empty = createEmptyBossStat();

  return {
    ...empty,

    __key: row?.__key ?? row?.id ?? makeKey(),

    id: row?.id ?? null,
    bossId: row?.boss_id ?? row?.bossId ?? null,

    variant: str(row?.variant),

    level: normalizeNumberInput(row?.level),
    hp: normalizeNumberInput(row?.hp),
    mp: normalizeNumberInput(row?.mp),
    attack: normalizeNumberInput(row?.attack),
    defense: normalizeNumberInput(row?.defense),
    magicAttack: normalizeNumberInput(row?.magic_attack ?? row?.magicAttack),
    magicDefense: normalizeNumberInput(
      row?.magic_defense ?? row?.magicDefense
    ),
    agility: normalizeNumberInput(row?.agility),
    weight: normalizeNumberInput(row?.weight),

    extraStatsJson: toJsonString(
      safeJsonParse(row?.extra_stats_json ?? row?.extraStatsJson, {}),
      "{}"
    ),

    note: str(row?.note),

    createdAt: row?.created_at ?? row?.createdAt ?? null,
    updatedAt: row?.updated_at ?? row?.updatedAt ?? null,
  };
}

export function normalizeBossPushWeight(row = {}) {
  const empty = createEmptyBossPushWeight();

  return {
    ...empty,

    __key: row?.__key ?? row?.id ?? makeKey(),

    id: row?.id ?? null,
    bossId: row?.boss_id ?? row?.bossId ?? null,

    variant: str(row?.variant),

    disadvantageWeight: normalizeNumberInput(
      row?.disadvantage_weight ?? row?.disadvantageWeight
    ),
    equalWeight: normalizeNumberInput(row?.equal_weight ?? row?.equalWeight),
    winWeight: normalizeNumberInput(row?.win_weight ?? row?.winWeight),
    completeWeight: normalizeNumberInput(
      row?.complete_weight ?? row?.completeWeight
    ),

    wbDisadvantageWeight: normalizeNumberInput(
      row?.wb_disadvantage_weight ?? row?.wbDisadvantageWeight
    ),
    wbEqualWeight: normalizeNumberInput(
      row?.wb_equal_weight ?? row?.wbEqualWeight
    ),
    wbWinWeight: normalizeNumberInput(row?.wb_win_weight ?? row?.wbWinWeight),
    wbCompleteWeight: normalizeNumberInput(
      row?.wb_complete_weight ?? row?.wbCompleteWeight
    ),

    note: str(row?.note),

    createdAt: row?.created_at ?? row?.createdAt ?? null,
    updatedAt: row?.updated_at ?? row?.updatedAt ?? null,
  };
}

export function normalizeBossRow(row = {}) {
  const empty = createEmptyBossRow();

  const stats = Array.isArray(row?.stats)
    ? row.stats
    : Array.isArray(row?.boss_stats)
    ? row.boss_stats
    : [];

  const pushWeights = Array.isArray(row?.push_weights)
    ? row.push_weights
    : Array.isArray(row?.pushWeights)
    ? row.pushWeights
    : [];

  return {
    ...empty,

    __key: row?.__key ?? row?.id ?? makeKey(),

    id: row?.id ?? null,

    bossId: str(row?.boss_id ?? row?.bossId),
    name: str(row?.name),
    nameEn: str(row?.name_en ?? row?.nameEn),

    category: str(row?.category),
    series: str(row?.series),
    race: str(row?.race),

    imageUrl: str(row?.image_url ?? row?.imageUrl),
    sourceUrl: str(row?.source_url ?? row?.sourceUrl),

    description: str(row?.description),
    note: str(row?.note),

    isActive: toBooleanValue(row?.is_active ?? row?.isActive ?? true),
    sortOrder: normalizeNumberInput(row?.sort_order ?? row?.sortOrder ?? 0),

    stats: stats.map(normalizeBossStat),
    pushWeights: pushWeights.map(normalizeBossPushWeight),

    createdAt: row?.created_at ?? row?.createdAt ?? null,
    updatedAt: row?.updated_at ?? row?.updatedAt ?? null,
  };
}

export function buildBossStatPayload(row = {}) {
  return {
    id: row.id ?? null,
    variant: str(row.variant).trim() || null,

    level: toNullableNumber(row.level),
    hp: toNullableNumber(row.hp),
    mp: toNullableNumber(row.mp),
    attack: toNullableNumber(row.attack),
    defense: toNullableNumber(row.defense),
    magic_attack: toNullableNumber(row.magicAttack),
    magic_defense: toNullableNumber(row.magicDefense),
    agility: toNullableNumber(row.agility),
    weight: toNullableNumber(row.weight),

    extra_stats_json:
      str(row.extraStatsJson).trim() === ""
        ? null
        : safeJsonParse(row.extraStatsJson, {}),

    note: str(row.note).trim() || null,
  };
}

export function buildBossPushWeightPayload(row = {}) {
  return {
    id: row.id ?? null,
    variant: str(row.variant).trim() || null,

    disadvantage_weight: toNullableNumber(row.disadvantageWeight),
    equal_weight: toNullableNumber(row.equalWeight),
    win_weight: toNullableNumber(row.winWeight),
    complete_weight: toNullableNumber(row.completeWeight),

    wb_disadvantage_weight: toNullableNumber(row.wbDisadvantageWeight),
    wb_equal_weight: toNullableNumber(row.wbEqualWeight),
    wb_win_weight: toNullableNumber(row.wbWinWeight),
    wb_complete_weight: toNullableNumber(row.wbCompleteWeight),

    note: str(row.note).trim() || null,
  };
}

export function buildBossPayload(row = {}) {
  return {
    boss_id: str(row.bossId).trim(),
    name: str(row.name).trim(),
    name_en: str(row.nameEn).trim() || null,

    category: str(row.category).trim() || null,
    series: str(row.series).trim() || null,
    race: str(row.race).trim() || null,

    image_url: str(row.imageUrl).trim() || null,
    source_url: str(row.sourceUrl).trim() || null,

    description: str(row.description).trim() || null,
    note: str(row.note).trim() || null,

    is_active: Boolean(row.isActive),
    sort_order: toNullableNumber(row.sortOrder) ?? 0,

    stats: Array.isArray(row.stats)
      ? row.stats.map(buildBossStatPayload)
      : [],

    push_weights: Array.isArray(row.pushWeights)
      ? row.pushWeights.map(buildBossPushWeightPayload)
      : [],
  };
}

export async function fetchBosses(params = {}) {
  try {
    const res = await api.get(`${API_URL}/api/bosses`, { params });
    const json = res.data;

    if (Array.isArray(json)) return json.map(normalizeBossRow);
    if (Array.isArray(json?.data)) return json.data.map(normalizeBossRow);
    if (Array.isArray(json?.data?.data)) {
      return json.data.data.map(normalizeBossRow);
    }

    return [];
  } catch (error) {
    console.error(error);
    throw new Error("ボス一覧取得失敗");
  }
}

export async function fetchBoss(id) {
  try {
    const res = await api.get(`${API_URL}/api/bosses/${id}`);
    const json = res.data;

    return normalizeBossRow(json?.data ?? json);
  } catch (error) {
    console.error(error);
    throw new Error("ボス取得失敗");
  }
}

export async function fetchWeightCheckerBosses() {
  try {
    const res = await api.get(`${API_URL}/api/weight-checker/bosses`);
    const json = res.data;

    if (Array.isArray(json)) return json.map(normalizeBossRow);
    if (Array.isArray(json?.data)) return json.data.map(normalizeBossRow);
    if (Array.isArray(json?.data?.data)) {
      return json.data.data.map(normalizeBossRow);
    }

    return [];
  } catch (error) {
    console.error(error);
    throw new Error("重さチェッカー用ボス一覧取得失敗");
  }
}

export async function createBoss(data) {
  try {
    const res = await api.post(`${API_URL}/api/bosses`, buildBossPayload(data));

    return normalizeBossRow(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("ボス作成失敗");
  }
}

export async function updateBoss(id, data) {
  try {
    const res = await api.put(
      `${API_URL}/api/bosses/${id}`,
      buildBossPayload(data)
    );

    return normalizeBossRow(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("ボス更新失敗");
  }
}

export async function deleteBoss(id) {
  try {
    const res = await api.delete(`${API_URL}/api/bosses/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("ボス削除失敗");
  }
}

export async function updateBossStats(id, stats = []) {
  try {
    const res = await api.put(`${API_URL}/api/bosses/${id}/stats`, {
      stats: stats.map(buildBossStatPayload),
    });

    return res.data?.data ?? res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("ボスステータス更新失敗");
  }
}

export async function updateBossPushWeights(id, pushWeights = []) {
  try {
    const res = await api.put(`${API_URL}/api/bosses/${id}/push-weights`, {
      push_weights: pushWeights.map(buildBossPushWeightPayload),
    });

    return res.data?.data ?? res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("押し勝ち重さ更新失敗");
  }
}

// 互換用
export const createEmptyBoss = createEmptyBossRow;
export const normalizeBoss = normalizeBossRow;
export const buildApiPayload = buildBossPayload;