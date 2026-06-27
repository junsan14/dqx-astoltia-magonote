import axios from "axios";

function getApiUrl() {
  const apiUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  return apiUrl.replace(/\/$/, "");
}

const API_URL = getApiUrl();

const api = axios.create({
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

function pickLocalizedValue(row = {}, baseKey, locale = "ja") {
  const ja = String(row?.[baseKey] ?? "").trim();
  const en = String(row?.[`${baseKey}_en`] ?? "").trim();

  if (locale === "en") {
    return en || ja || "";
  }

  return ja || en || "";
}

function pickMapName(row = {}, locale = "ja") {
  const ja = String(row?.map_name ?? row?.name ?? row?.map?.name ?? "").trim();

  const en = String(
    row?.map_name_en ?? row?.name_en ?? row?.map?.name_en ?? ""
  ).trim();

  if (locale === "en") {
    return en || ja || "";
  }

  return ja || en || "";
}

function pickContinentName(row = {}, locale = "ja") {
  const continentObject =
    typeof row?.continent === "object" && row?.continent !== null
      ? row.continent
      : null;

  const mapContinentObject =
    typeof row?.map?.continent === "object" && row?.map?.continent !== null
      ? row.map.continent
      : null;

  const continentString =
    typeof row?.continent === "string" ? row.continent : "";

  const mapContinentString =
    typeof row?.map?.continent === "string" ? row.map.continent : "";

  const ja = String(
    row?.continent_name ??
      row?.map?.continent_name ??
      continentObject?.name ??
      continentObject?.continent_name ??
      mapContinentObject?.name ??
      mapContinentObject?.continent_name ??
      continentString ??
      mapContinentString ??
      ""
  ).trim();

  const en = String(
    row?.continent_name_en ??
      row?.continent_en ??
      row?.map?.continent_name_en ??
      row?.map?.continent_en ??
      continentObject?.name_en ??
      continentObject?.continent_name_en ??
      mapContinentObject?.name_en ??
      mapContinentObject?.continent_name_en ??
      ""
  ).trim();

  if (locale === "en") {
    return en || ja || "";
  }

  return ja || en || "";
}

export function resolveImageUrl(path = "") {
  const value = String(path ?? "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${API_URL}${value}`;
  return `${API_URL}/${value}`;
}

export function parseCoords(area) {
  if (Array.isArray(area)) return area;

  if (typeof area === "string") {
    try {
      const parsed = JSON.parse(area);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeLayerRow(row = {}, locale = "ja") {
  const rawImagePath =
    row?.image_path ??
    row?.image_url ??
    row?.map_image_url ??
    row?.map_image_path ??
    "";

  return {
    id: row?.id ?? null,
    map_id: row?.map_id ?? null,
    layer_name: pickLocalizedValue(row, "layer_name", locale),
    layer_name_en: row?.layer_name_en ?? "",
    floor_no: row?.floor_no ?? 0,
    display_order: row?.display_order ?? 1,
    image_path: rawImagePath,
    image_url: resolveImageUrl(rawImagePath),
  };
}

export function normalizeMapRow(row = {}, locale = "ja") {
  const layers = Array.isArray(row?.layers)
    ? row.layers
        .map((layer) => normalizeLayerRow(layer, locale))
        .sort((a, b) => {
          const aOrder = Number(a?.display_order ?? 1);
          const bOrder = Number(b?.display_order ?? 1);

          if (aOrder !== bOrder) return aOrder - bOrder;

          const aFloor = Number(a?.floor_no ?? 0);
          const bFloor = Number(b?.floor_no ?? 0);

          return aFloor - bFloor;
        })
    : [];

  const mapName = pickMapName(row, locale);
  const continentName = pickContinentName(row, locale);

  const rawImagePath =
    row?.image_path ??
    row?.image_url ??
    row?.map_image_url ??
    row?.map_image_path ??
    "";

  return {
    id: row?.id ?? null,
    name: mapName,
    map_name: mapName,

    continent: continentName,
    continent_name: continentName,

    continent_id:
      row?.continent_id ??
      row?.continent?.id ??
      row?.map?.continent_id ??
      row?.map?.continent?.id ??
      null,

    map_type: row?.map_type ?? "",

    image_path: rawImagePath,
    image_url: resolveImageUrl(rawImagePath),

    layers,
  };
}

export function normalizeSpawn(row = {}, locale = "ja") {
  const area = row?.area ?? "";
  const coords = Array.isArray(row?.coords) ? row.coords : parseCoords(area);

  const rawLayerImagePath =
    row?.map_layer_image_path ??
    row?.layer_image_path ??
    row?.map_layer?.image_path ??
    row?.map_layer?.image_url ??
    row?.map?.image_path ??
    row?.map?.image_url ??
    row?.map_image_url ??
    row?.image_url ??
    row?.image_path ??
    "";

  const mapLayerName = pickLocalizedValue(
    {
      ...row,
      map_layer_name:
        row?.map_layer_name ??
        row?.layer_name ??
        row?.map_layer?.layer_name ??
        "",
      map_layer_name_en:
        row?.map_layer_name_en ??
        row?.layer_name_en ??
        row?.map_layer?.layer_name_en ??
        "",
    },
    "map_layer_name",
    locale
  );

  const monsterName = pickLocalizedValue(
    {
      ...row,
      monster_name: row?.monster_name ?? row?.monster?.name ?? "",
      monster_name_en: row?.monster_name_en ?? row?.monster?.name_en ?? "",
    },
    "monster_name",
    locale
  );

  const mapName = pickMapName(
    {
      ...row,
      map_name: row?.map_name ?? row?.map?.name ?? "",
      map_name_en: row?.map_name_en ?? row?.map?.name_en ?? "",
    },
    locale
  );

  const continentName = pickContinentName(
    {
      ...row,
      continent_name:
        row?.continent_name ??
        row?.map?.continent_name ??
        row?.map?.continent?.name ??
        "",
      continent_name_en:
        row?.continent_name_en ??
        row?.map?.continent_name_en ??
        row?.map?.continent?.name_en ??
        "",
      continent:
        row?.continent ??
        row?.map?.continent ??
        row?.map?.continent_name ??
        "",
      continent_en:
        row?.continent_en ??
        row?.map?.continent_en ??
        row?.map?.continent_name_en ??
        "",
    },
    locale
  );

  return {
    id: row?.id ?? null,
    __key: row?.id
      ? `spawn-${row.id}`
      : `spawn-${Date.now()}-${Math.random().toString(36).slice(2)}`,

    monster_id: row?.monster_id ?? row?.monster?.id ?? null,
    monster_name: monsterName,

    map_id: row?.map_id ?? row?.map?.id ?? null,
    map_layer_id: row?.map_layer_id ?? row?.map_layer?.id ?? null,

    area: typeof area === "string" ? area : JSON.stringify(area ?? []),
    coords,

    spawn_time: row?.spawn_time ?? "いつでも",
    spawn_count: row?.spawn_count ?? "",
    symbol_count: row?.symbol_count ?? "",

    imported_note: row?.imported_note ?? "",
    note: row?.note ?? "",

    is_hunting_ground: Boolean(row?.is_hunting_ground ?? false),

    map_name: mapName,
    continent_name: continentName,

    map_layer_name: mapLayerName,

    map_layer_floor_no:
      row?.map_layer_floor_no ??
      row?.floor_no ??
      row?.map_layer?.floor_no ??
      null,

    map_image_url: resolveImageUrl(rawLayerImagePath),

    grid_mode: row?.grid_mode ?? "block",
  };
}

function extractList(json, locale = "ja") {
  if (Array.isArray(json)) {
    return json.map((row) => normalizeSpawn(row, locale));
  }

  if (Array.isArray(json?.data)) {
    return json.data.map((row) => normalizeSpawn(row, locale));
  }

  if (Array.isArray(json?.data?.data)) {
    return json.data.data.map((row) => normalizeSpawn(row, locale));
  }

  return [];
}

function buildSpawnPayload(spawn = {}, fixedMonsterId = null, fixedMapId = null) {
  const coords = Array.isArray(spawn?.coords)
    ? spawn.coords
    : parseCoords(spawn?.area);

  return {
    monster_id: spawn?.monster_id
      ? Number(spawn.monster_id)
      : fixedMonsterId
        ? Number(fixedMonsterId)
        : null,

    map_id: fixedMapId
      ? Number(fixedMapId)
      : spawn?.map_id
        ? Number(spawn.map_id)
        : null,

    map_layer_id: spawn?.map_layer_id ? Number(spawn.map_layer_id) : null,

    area: JSON.stringify(coords),

    spawn_time: spawn?.spawn_time ?? "いつでも",
    spawn_count: String(spawn?.spawn_count ?? "").trim(),
    symbol_count: String(spawn?.symbol_count ?? "").trim(),

    note: spawn?.note ?? "",
    imported_note: spawn?.imported_note ?? "",

    is_hunting_ground: Boolean(spawn?.is_hunting_ground ?? false),
  };
}

export async function fetchMonsterMapSpawns(monsterId, locale = "ja") {
  try {
    const res = await api.get(`${API_URL}/api/monster-map-spawns`, {
      params: {
        ...(monsterId ? { monster_id: monsterId } : {}),
        locale,
      },
    });

    return extractList(res.data, locale);
  } catch (error) {
    console.error(error);
    throw new Error("生息地一覧取得失敗");
  }
}

export async function fetchMapMonsterSpawns(mapId, locale = "ja") {
  try {
    const res = await api.get(`${API_URL}/api/monster-map-spawns`, {
      params: {
        ...(mapId ? { map_id: mapId } : {}),
        locale,
      },
    });

    return extractList(res.data, locale);
  } catch (error) {
    console.error(error);
    throw new Error("マップ生息モンスター取得失敗");
  }
}

export async function createMonsterMapSpawn(payload, locale = "ja") {
  try {
    const res = await api.post(`${API_URL}/api/monster-map-spawns`, payload);
    return normalizeSpawn(res.data?.data ?? res.data, locale);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("生息地作成失敗");
  }
}

export async function updateMonsterMapSpawn(id, payload, locale = "ja") {
  try {
    const res = await api.put(
      `${API_URL}/api/monster-map-spawns/${id}`,
      payload
    );

    return normalizeSpawn(res.data?.data ?? res.data, locale);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("生息地更新失敗");
  }
}

export async function deleteMonsterMapSpawn(id) {
  try {
    const res = await api.delete(`${API_URL}/api/monster-map-spawns/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);
    throw new Error("生息地削除失敗");
  }
}

export async function saveMonsterMapSpawns(
  monsterId,
  nextSpawns = [],
  prevSpawns = [],
  locale = "ja"
) {
  const nextIds = new Set(
    (nextSpawns ?? []).map((row) => row?.id).filter(Boolean)
  );

  const deleteTargets = (prevSpawns ?? []).filter(
    (row) => row?.id && !nextIds.has(row.id)
  );

  for (const row of deleteTargets) {
    await deleteMonsterMapSpawn(row.id);
  }

  const saved = [];

  for (const row of nextSpawns ?? []) {
    const payload = buildSpawnPayload(row, monsterId, null);

    if (!payload.monster_id) {
      throw new Error("monster_id が未設定の生息地がある");
    }

    if (!payload.map_id) {
      throw new Error("map_id が未設定の生息地がある");
    }

    if (row?.id) {
      const updated = await updateMonsterMapSpawn(row.id, payload, locale);
      saved.push(updated);
    } else {
      const created = await createMonsterMapSpawn(payload, locale);
      saved.push(created);
    }
  }

  return saved.map((row) => normalizeSpawn(row, locale));
}

export async function saveMapMonsterSpawns(
  mapId,
  nextSpawns = [],
  prevSpawns = [],
  locale = "ja"
) {
  if (!mapId) {
    throw new Error("map_id が未設定");
  }

  const nextIds = new Set(
    (nextSpawns ?? []).map((row) => row?.id).filter(Boolean)
  );

  const deleteTargets = (prevSpawns ?? []).filter(
    (row) => row?.id && !nextIds.has(row.id)
  );

  for (const row of deleteTargets) {
    await deleteMonsterMapSpawn(row.id);
  }

  const saved = [];

  for (const row of nextSpawns ?? []) {
    const payload = buildSpawnPayload(row, null, mapId);

    if (!payload.monster_id) {
      throw new Error("モンスター未選択の生息地がある");
    }

    if (!payload.map_id) {
      throw new Error("map_id が未設定の生息地がある");
    }

    if (row?.id) {
      const updated = await updateMonsterMapSpawn(row.id, payload, locale);
      saved.push(updated);
    } else {
      const created = await createMonsterMapSpawn(payload, locale);
      saved.push(created);
    }
  }

  return saved.map((row) => normalizeSpawn(row, locale));
}