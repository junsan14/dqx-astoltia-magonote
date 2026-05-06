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

function normalizeGameJob(row = {}) {
  return {
    id: row?.id ?? null,
    name: row?.name ?? "",
    key: row?.key ?? "",
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function fetchGameJobs(q = "") {
  try {
    const res = await api.get(`${API_URL}/api/game-jobs`, {
      params: q ? { q } : {},
    });

    const json = res.data;

    if (Array.isArray(json?.data)) return json.data.map(normalizeGameJob);
    if (Array.isArray(json?.data?.data)) {
      return json.data.data.map(normalizeGameJob);
    }

    return [];
  } catch (error) {
    console.error(error);
    throw new Error("職業一覧取得失敗");
  }
}

export async function fetchGameJob(id) {
  try {
    const res = await api.get(`${API_URL}/api/game-jobs/${id}`);
    return normalizeGameJob(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);
    throw new Error("職業取得失敗");
  }
}

export async function createGameJob(data) {
  try {
    const res = await api.post(`${API_URL}/api/game-jobs`, data);
    return normalizeGameJob(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("職業作成失敗");
  }
}

export async function updateGameJob(id, data) {
  try {
    const res = await api.put(`${API_URL}/api/game-jobs/${id}`, data);
    return normalizeGameJob(res.data?.data ?? res.data);
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("職業更新失敗");
  }
}

export async function deleteGameJob(id) {
  try {
    const res = await api.delete(`${API_URL}/api/game-jobs/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("職業削除失敗");
  }
}
export async function updateGameJobEquipableTypes(id, equipmentTypeIds = []) {
  try {
    const res = await api.put(`${API_URL}/api/game-jobs/${id}/equipable-types`, {
      equipment_type_ids: equipmentTypeIds.map(Number).filter((v) => v > 0),
    });

    return res.data?.data ?? res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("職業の装備可能タイプ更新失敗");
  }
}