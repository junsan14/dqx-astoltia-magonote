import axios from "axios";

function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  return apiUrl.replace(/\/$/, "");
}

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

export const ORB_COLORS = ["炎", "水", "風", "光", "闇"];

/*
--------------------------------
オーブ一覧
--------------------------------
*/
export async function fetchOrbs(q = "", color = "") {
  try {
    const params = {};

    if (q) params.q = q;
    if (color) params.color = color;

    const res = await api.get("/api/orbs", { params });

    const json = res.data;

    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.data?.data)) return json.data.data;

    return [];
  } catch (error) {
    console.error(error);
    throw new Error("オーブ一覧取得失敗");
  }
}

/*
--------------------------------
オーブ1件
--------------------------------
*/
export async function fetchOrb(id) {
  try {
    const res = await api.get(`/api/orbs/${id}`);
    return res.data.data;
  } catch (error) {
    console.error(error);
    throw new Error("オーブ取得失敗");
  }
}

/*
--------------------------------
作成
--------------------------------
*/
export async function createOrb(data) {
  try {
    const res = await api.post("/api/orbs", data);
    return res.data.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("オーブ作成失敗");
  }
}

/*
--------------------------------
更新
--------------------------------
*/
export async function updateOrb(id, data) {
    console.log(data)
  try {
    const res = await api.put(`/api/orbs/${id}`, data);
    return res.data.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("オーブ更新失敗");
  }
}

/*
--------------------------------
削除
--------------------------------
*/
export async function deleteOrb(id) {
  try {
    const res = await api.delete(`/api/orbs/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("オーブ削除失敗");
  }
}

/*
--------------------------------
モンスター検索
--------------------------------
*/
export async function searchMonsters(keyword = "") {
  try {
    const res = await api.get("/api/monsters/search", {
      params: { q: keyword },
    });

    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch (error) {
    console.error(error);
    throw new Error("モンスター検索失敗");
  }
}