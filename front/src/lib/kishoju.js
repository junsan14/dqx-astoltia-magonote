import axios from "axios";

function getApiUrl() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
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

export function normalizeRoomCode(value = "") {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    // 全角英数字と全角アンダースコアだけ半角化する
    .replace(/[Ａ-Ｚａ-ｚ０-９＿]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    // 全角ハイフン系は半角ハイフンに寄せる
    .replace(/[－ー―‐]/g, "-");
}

function normalizeKishojuMember(row = {}) {
  return {
    id: row?.id ?? null,
    kishoju_room_id: row?.kishoju_room_id ?? null,
    name: row?.name ?? "",
    server_from: row?.server_from ?? null,
    server_to: row?.server_to ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function normalizeKishojuReport(row = {}) {
  return {
    id: row?.id ?? null,
    kishoju_room_id: row?.kishoju_room_id ?? null,
    server_no: row?.server_no ?? null,
    map_name: row?.map_name ?? "",
    gauge_color: row?.gauge_color ?? "",
    reported_by: row?.reported_by ?? "",
    memo: row?.memo ?? "",
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function normalizeKishojuRoom(row = {}) {
  const members = Array.isArray(row?.members)
    ? row.members.map(normalizeKishojuMember)
    : [];

  const reports = Array.isArray(row?.reports)
    ? row.reports.map(normalizeKishojuReport)
    : [];

  return {
    id: row?.id ?? null,
    public_id: row?.public_id ?? "",
    name: row?.name ?? "輝晶獣 分散ルーム",
    status: row?.status ?? "open",
    members,
    reports,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function normalizeNearRainbowItem(row = {}) {
  return {
    id: row?.id ?? null,
    room_id: row?.room_id ?? null,
    room_name: row?.room_name ?? "輝晶獣 分散ルーム",
    room_public_id: row?.room_public_id ?? "",
    server_no: row?.server_no ?? null,
    map_name: row?.map_name ?? "",
    gauge_color: row?.gauge_color ?? "",
    reported_by: row?.reported_by ?? "",
    memo: row?.memo ?? "",
    created_at: row?.created_at ?? null,
  };
}

function normalizeNearRainbowSummary(json = {}) {
  return {
    roomsCount: json?.rooms_count ?? 0,
    membersCount: json?.members_count ?? 0,
  };
}

function getErrorMessage(error, fallbackMessage) {
  console.error(error);

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  return fallbackMessage;
}

export async function createKishojuRoom(data = {}) {
  try {
    const res = await api.post(`${API_URL}/api/kishoju/rooms`, {
      name: data.name || "輝晶獣 分散ルーム",
    });

    return normalizeKishojuRoom(res.data.room);
  } catch (error) {
    throw new Error(getErrorMessage(error, "ルーム作成に失敗しました"));
  }
}

export async function fetchKishojuRoom(roomId) {
  try {
    const res = await api.get(`${API_URL}/api/kishoju/rooms/${roomId}`);

    return normalizeKishojuRoom(res.data.room);
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "ルーム情報を取得できませんでした")
    );
  }
}

export async function fetchKishojuReports(roomId) {
  try {
    const res = await api.get(`${API_URL}/api/kishoju/rooms/${roomId}/reports`);

    return Array.isArray(res.data?.reports)
      ? res.data.reports.map(normalizeKishojuReport)
      : [];
  } catch (error) {
    throw new Error(getErrorMessage(error, "報告一覧を取得できませんでした"));
  }
}

export async function joinKishojuRoom(roomId, data = {}) {
  try {
    const res = await api.post(`${API_URL}/api/kishoju/rooms/${roomId}/join`, {
      name: data.name,
      server_from: data.server_from,
      server_to: data.server_to,
    });

    return normalizeKishojuMember(res.data.member);
  } catch (error) {
    throw new Error(getErrorMessage(error, "参加登録に失敗しました"));
  }
}

export async function createKishojuReport(roomId, data = {}) {
  try {
    const res = await api.post(`${API_URL}/api/kishoju/rooms/${roomId}/reports`, {
      server_no: data.server_no,
      map_name: data.map_name,
      gauge_color: data.gauge_color,
      reported_by: data.reported_by,
      memo: data.memo ?? null,
    });

    return normalizeKishojuReport(res.data.report);
  } catch (error) {
    throw new Error(getErrorMessage(error, "報告に失敗しました"));
  }
}

export async function deleteKishojuReport(roomId, reportId) {
  try {
    const res = await api.delete(
      `${API_URL}/api/kishoju/rooms/${roomId}/reports/${reportId}`
    );

    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "報告の削除に失敗しました"));
  }
}

export async function fetchKishojuNearRainbow() {
  try {
    const res = await api.get(`${API_URL}/api/admin/kishoju/near-rainbow`);

    const json = res.data;

    return {
      summary: normalizeNearRainbowSummary(json),
      items: Array.isArray(json?.items)
        ? json.items.map(normalizeNearRainbowItem)
        : [],
    };
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "虹化に近いサーバ情報の取得に失敗しました")
    );
  }
}

export async function deleteKishojuMember(roomId, memberId) {
  try {
    const res = await api.delete(
      `${API_URL}/api/kishoju/rooms/${roomId}/members/${memberId}`
    );

    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "ユーザー削除に失敗しました"));
  }
}