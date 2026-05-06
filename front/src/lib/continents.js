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

/*
--------------------------------
大陸一覧
--------------------------------
*/
export async function fetchContinents(q = "") {
  try {
    const params = {};

    if (q) params.q = q;

    const res = await api.get("/api/continents", { params });

    const json = res.data;

    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.data?.data)) return json.data.data;

    return [];
  } catch (error) {
    console.error(error);
    throw new Error("大陸一覧取得失敗");
  }
}

/*
--------------------------------
大陸1件
--------------------------------
*/
export async function fetchContinent(id) {
  try {
    const res = await api.get(`/api/continents/${id}`);
    return res.data.data;
  } catch (error) {
    console.error(error);
    throw new Error("大陸取得失敗");
  }
}

/*
--------------------------------
作成
--------------------------------
*/
export async function createContinent(data) {
  try {
    const res = await api.post("/api/continents", data);
    return res.data.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("大陸作成失敗");
  }
}

/*
--------------------------------
更新
--------------------------------
*/
export async function updateContinent(id, data) {
  try {
    const res = await api.put(`/api/continents/${id}`, data);
    return res.data.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("大陸更新失敗");
  }
}

/*
--------------------------------
削除
--------------------------------
*/
export async function deleteContinent(id) {
  try {
    const res = await api.delete(`/api/continents/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("大陸削除失敗");
  }
}