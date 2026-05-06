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

function extractList(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  return [];
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeEquipment(row = {}) {
  return {
    id: `equipment-${row?.id}`,
    rawId: row?.id ?? null,
    source: "equipment",

    itemId: row?.item_id ?? "",
    name: row?.item_name ?? "",
    nameEn: row?.item_name_en ?? "",

    equipmentTypeId: row?.equipment_type_id ?? null,
    equipLevel: row?.equip_level ?? null,

    slot: row?.slot ?? "",
    slotGridType: row?.slot_grid_type ?? "",
    slotGridCols: row?.slot_grid_cols ?? null,

    groupKind: row?.group_kind ?? "",
    groupId: row?.group_id ?? "",
    groupName: row?.group_name ?? "",

    equipmentType: row?.equipment_type
      ? {
          id: row.equipment_type.id ?? null,
          key: row.equipment_type.key ?? "",
          name: row.equipment_type.name ?? "",
          kind: row.equipment_type.kind ?? "",
        }
      : null,

    effects: normalizeJsonArray(row?.effects_json),

    weight: Number(row?.weight ?? 0),
  };
}

function normalizeAccessory(row = {}) {
  return {
    id: `accessory-${row?.id}`,
    rawId: row?.id ?? null,
    source: "accessory",

    itemId: row?.item_id ?? "",
    name: row?.name ?? "",
    nameEn: row?.name_en ?? "",

    itemKind: row?.item_kind ?? "accessory",

    slot: row?.slot ?? "",
    accessoryType: row?.accessory_type ?? "",
    equipLevel: row?.equip_level ?? null,

    groupKind: "",
    groupId: "",
    groupName: "",

    equipmentType: null,

    effects: [],

    weight: Number(row?.weight ?? 0),
  };
}

function normalizeBoss(row = {}) {
  return {
    id: row?.id ?? null,
    bossId: row?.boss_id ?? "",
    name: row?.name ?? "",
    nameEn: row?.name_en ?? "",
    category: row?.category ?? "",
    series: row?.series ?? "",
    race: row?.race ?? "",
    note: row?.note ?? "",

    stats: Array.isArray(row?.stats)
      ? row.stats.map((stat) => ({
          id: stat?.id ?? null,
          variant: stat?.variant ?? "",
          hp: stat?.hp ?? null,
          mp: stat?.mp ?? null,
          attack: stat?.attack ?? null,
          defense: stat?.defense ?? null,
          magicAttack: stat?.magic_attack ?? null,
          magicDefense: stat?.magic_defense ?? null,
          agility: stat?.agility ?? null,
          weight: stat?.weight ?? null,
          note: stat?.note ?? "",
        }))
      : [],

    pushWeights: Array.isArray(row?.push_weights)
      ? row.push_weights.map((push) => ({
          id: push?.id ?? null,
          variant: push?.variant ?? "",
          disadvantageWeight: push?.disadvantage_weight ?? null,
          equalWeight: push?.equal_weight ?? null,
          winWeight: push?.win_weight ?? null,
          completeWeight: push?.complete_weight ?? null,
          wbDisadvantageWeight: push?.wb_disadvantage_weight ?? null,
          wbEqualWeight: push?.wb_equal_weight ?? null,
          wbWinWeight: push?.wb_win_weight ?? null,
          wbCompleteWeight: push?.wb_complete_weight ?? null,
          note: push?.note ?? "",
        }))
      : [],
  };
}

export async function fetchWeightCheckerEquipments(params = {}) {
  try {
    const res = await api.get(`${API_URL}/api/equipments`, { params });
    return extractList(res.data).map(normalizeEquipment);
  } catch (error) {
    console.error(error);
    throw new Error("装備データ取得失敗");
  }
}

export async function fetchWeightCheckerAccessories(q = "") {
  try {
    const res = await api.get(`${API_URL}/api/accessories`, {
      params: q ? { q } : {},
    });

    return extractList(res.data).map(normalizeAccessory);
  } catch (error) {
    console.error(error);
    throw new Error("アクセサリデータ取得失敗");
  }
}

export async function fetchWeightCheckerBosses() {
  try {
    const res = await api.get(`${API_URL}/api/tools/weight-checker/bosses`);
    return extractList(res.data).map(normalizeBoss);
  } catch (error) {
    console.error(error);
    throw new Error("ボスデータ取得失敗");
  }
}

export async function fetchWeightCheckerInitialData() {
  const [equipments, accessories, bosses] = await Promise.all([
    fetchWeightCheckerEquipments(),
    fetchWeightCheckerAccessories(),
    fetchWeightCheckerBosses(),
  ]);

  return {
    equipments,
    accessories,
    bosses,
    allItems: [...equipments, ...accessories],
  };
}