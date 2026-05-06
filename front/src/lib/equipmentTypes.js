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

function normalizeEquipmentType(row = {}) {
  return {
    id: row?.id ?? null,
    key: row?.key ?? "",
    name: row?.name ?? "",
    kind: row?.kind ?? "",
    craftTypeId:
      row?.craft_type_id == null ? null : Number(row.craft_type_id),
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
    equipableTypes: Array.isArray(row?.equipable_types)
      ? row.equipable_types.map((item) => ({
          id: item?.id ?? null,
          gameJobId:
            item?.game_job_id == null ? null : Number(item.game_job_id),
          equipmentTypeId:
            item?.equipment_type_id == null
              ? null
              : Number(item.equipment_type_id),
          createdAt: item?.created_at ?? null,
          updatedAt: item?.updated_at ?? null,
          gameJob: item?.game_job
            ? {
                id: item.game_job?.id ?? null,
                name: item.game_job?.name ?? "",
                key: item.game_job?.key ?? "",
              }
            : null,
        }))
      : [],
  };
}

export async function fetchEquipmentTypes(q = "") {
  try {
    const res = await api.get(`${API_URL}/api/equipment-types`, {
      params: q ? { q } : {},
    });

    const json = res.data;

    if (Array.isArray(json?.data)) {
      return json.data.map(normalizeEquipmentType);
    }

    if (Array.isArray(json?.data?.data)) {
      return json.data.data.map(normalizeEquipmentType);
    }

    return [];
  } catch (error) {
    console.error(error);
    throw new Error("装備種別一覧取得失敗");
  }
}

export async function fetchEquipmentType(id) {
  try {
    const res = await api.get(`${API_URL}/api/equipment-types/${id}`);
    return normalizeEquipmentType(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);
    throw new Error("装備種別取得失敗");
  }
}

export async function createEquipmentType(data) {
  try {
    const res = await api.post(`${API_URL}/api/equipment-types`, data);
    return normalizeEquipmentType(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("装備種別作成失敗");
  }
}

export async function updateEquipmentType(id, data) {
  try {
    const res = await api.put(`${API_URL}/api/equipment-types/${id}`, data);
    return normalizeEquipmentType(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("装備種別更新失敗");
  }
}

export async function deleteEquipmentType(id) {
  try {
    const res = await api.delete(`${API_URL}/api/equipment-types/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("装備種別削除失敗");
  }
}