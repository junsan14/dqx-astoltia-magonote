import axios from "axios";

let cache = null;
let csrfReady = false;

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
    "X-Requested-With": "XMLHttpRequest",
  },
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

async function ensureCsrfCookie() {
  if (csrfReady) return;
  await api.get("/sanctum/csrf-cookie");
  csrfReady = true;
}

function buildErrorMessage(error, fallback) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (status === 419) {
    return "419エラー。CSRF認証に失敗した";
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.errors) {
    const firstError = Object.values(data.errors)?.flat?.()?.[0];
    if (firstError) return firstError;
  }

  return fallback;
}

export async function fetchCrystalRules() {
  if (cache) return cache;

  try {
    const res = await api.get("/api/crystal-rules");
    cache = res.data?.data ?? [];
    return cache;
  } catch (error) {
    throw new Error(buildErrorMessage(error, "結晶ルールの取得に失敗した"));
  }
}

export async function getCrystalByEquipLevel(level) {
  const rules = await fetchCrystalRules();

  const rule = rules.find(
    (r) => level >= r.min_level && level <= r.max_level
  );

  if (!rule) return null;

  return {
    plus0: rule.plus0,
    plus1: rule.plus1,
    plus2: rule.plus2,
    plus3: rule.plus3,
  };
}

export async function createCrystalRule(payload) {
  try {
    await ensureCsrfCookie();
    const res = await api.post("/api/crystal-rules", payload);
    cache = null;
    return res.data;
  } catch (error) {
    throw new Error(buildErrorMessage(error, "結晶ルールの追加に失敗した"));
  }
}

export async function updateCrystalRule(id, payload) {
  try {
    await ensureCsrfCookie();
    const res = await api.put(`/api/crystal-rules/${id}`, payload);
    cache = null;
    return res.data;
  } catch (error) {
    throw new Error(buildErrorMessage(error, "結晶ルールの更新に失敗した"));
  }
}

export async function deleteCrystalRule(id) {
  try {
    await ensureCsrfCookie();
    const res = await api.delete(`/api/crystal-rules/${id}`);
    cache = null;
    return res.data;
  } catch (error) {
    throw new Error(buildErrorMessage(error, "結晶ルールの削除に失敗した"));
  }
}