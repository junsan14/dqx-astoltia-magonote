export const JOB_OVERRIDE_MODE_OPTIONS = ["inherit", "add", "replace"];

export const GROUP_KIND_OPTIONS = [
  "armor_set",
  "tailoring_set",
  "shield_set",
  "weapon_set",
  "craft_tool_set",
  "single",
];

export const SLOT_OPTIONS = [
  "頭",
  "体上",
  "体下",
  "腕",
  "足",
  "盾",
  "武器",
  "その他",
];

export const GRID_TYPE_PRESETS = {
  鎧頭: { rows: 2, cols: 2, disabledCells: [] },
  鎧上: { rows: 3, cols: 2, disabledCells: [] },
  鎧下: { rows: 4, cols: 2, disabledCells: [] },
  鎧腕: { rows: 3, cols: 1, disabledCells: [] },
  鎧足: { rows: 3, cols: 2, disabledCells: [[0, 0], [1, 0]] },

  裁縫頭: { rows: 2, cols: 3, disabledCells: [[0, 0], [0, 2]] },
  裁縫上: { rows: 3, cols: 3, disabledCells: [] },
  裁縫下: { rows: 3, cols: 2, disabledCells: [] },
  裁縫腕: { rows: 2, cols: 3, disabledCells: [] },
  裁縫足: { rows: 2, cols: 2, disabledCells: [] },

  盾: { rows: 2, cols: 2, disabledCells: [] },

  片手剣: { rows: 3, cols: 1, disabledCells: [] },
  両手剣: { rows: 4, cols: 2, disabledCells: [] },
  短剣: { rows: 2, cols: 1, disabledCells: [] },
  ヤリ: { rows: 4, cols: 1, disabledCells: [] },
  オノ: { rows: 4, cols: 2, disabledCells: [[2, 1], [3, 1]] },
  ハンマー: { rows: 3, cols: 2, disabledCells: [] },
  ツメ: { rows: 2, cols: 2, disabledCells: [] },
  ムチ: { rows: 4, cols: 2, disabledCells: [[3, 1]] },
  ブーメラン: { rows: 3, cols: 2, disabledCells: [[1, 0]] },
  スティック: { rows: 2, cols: 1, disabledCells: [] },
  両手杖: { rows: 3, cols: 1, disabledCells: [] },
  棍: { rows: 3, cols: 2, disabledCells: [] },
  扇: { rows: 2, cols: 2, disabledCells: [] },
  弓: { rows: 3, cols: 2, disabledCells: [[1, 1]] },
  鎌: { rows: 4, cols: 2, disabledCells: [[1, 1], [2, 1], [3, 1]] },

  道具ハンマー: { rows: 3, cols: 2, disabledCells: [[2, 1]] },
  道具木工刀: { rows: 3, cols: 1, disabledCells: [] },
  道具錬金ツボ: { rows: 3, cols: 2, disabledCells: [] },
  道具錬金ランプ: { rows: 2, cols: 2, disabledCells: [] },
  道具さいほう針: { rows: 2, cols: 1, disabledCells: [] },
  道具フライパン: { rows: 4, cols: 2, disabledCells: [[3, 1]] },
};

export const GRID_TYPE_OPTIONS = Object.keys(GRID_TYPE_PRESETS);

export const GROUP_MEMBER_PRESETS = {
  armor_set: [
    { key: "head", label: "鎧頭", slot: "頭", slotGridType: "鎧頭" },
    { key: "bodyTop", label: "鎧上", slot: "体上", slotGridType: "鎧上" },
    { key: "bodyBottom", label: "鎧下", slot: "体下", slotGridType: "鎧下" },
    { key: "arm", label: "鎧腕", slot: "腕", slotGridType: "鎧腕" },
    { key: "foot", label: "鎧足", slot: "足", slotGridType: "鎧足" },
  ],
  tailoring_set: [
    { key: "head", label: "裁縫頭", slot: "頭", slotGridType: "裁縫頭" },
    { key: "bodyTop", label: "裁縫上", slot: "体上", slotGridType: "裁縫上" },
    { key: "bodyBottom", label: "裁縫下", slot: "体下", slotGridType: "裁縫下" },
    { key: "arm", label: "裁縫腕", slot: "腕", slotGridType: "裁縫腕" },
    { key: "foot", label: "裁縫足", slot: "足", slotGridType: "裁縫足" },
  ],
  shield_set: [
    { key: "shield", label: "盾", slot: "盾", slotGridType: "盾" },
  ],
  weapon_set: [
    { key: "weapon", label: "武器", slot: "武器", slotGridType: "" },
  ],
  craft_tool_set: [
    {
      key: "needle",
      label: "さいほう針",
      slot: "その他",
      slotGridType: "道具さいほう針",
    },
    {
      key: "wood",
      label: "木工刀",
      slot: "その他",
      slotGridType: "道具木工刀",
    },
    {
      key: "lamp",
      label: "錬金ランプ",
      slot: "その他",
      slotGridType: "道具錬金ランプ",
    },
    {
      key: "pot",
      label: "錬金ツボ",
      slot: "その他",
      slotGridType: "道具錬金ツボ",
    },
    {
      key: "pan",
      label: "フライパン",
      slot: "その他",
      slotGridType: "道具フライパン",
    },
    {
      key: "hammer",
      label: "鍛冶ハンマー",
      slot: "その他",
      slotGridType: "道具ハンマー",
    },
  ],
};

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function str(v) {
  return v == null ? "" : String(v);
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

export function toJsonString(value, fallbackJson = "[]") {
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
  return `k_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function slugify(text) {
  return str(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[ ]+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

export function makeItemId(row, equipmentTypes = []) {
  const itemName = str(row?.itemName).trim();
  const equipLevel = str(row?.equipLevel).trim();
  const slot = str(row?.slot).trim();
  const equipmentTypeId = str(row?.equipmentTypeId).trim();

  const currentType =
    row?.equipmentType ??
    equipmentTypes.find((t) => String(t.id) === String(equipmentTypeId)) ??
    null;

  const typeKey = str(currentType?.key).trim().toLowerCase();
  const kind = str(currentType?.kind).trim().toLowerCase();
  const craftTypeId = String(currentType?.craft_type_id ?? "");

  const slotMap = {
    頭: "head",
    からだ上: "bodyup",
    体上: "bodyup",
    からだ下: "bodydown",
    体下: "bodydown",
    腕: "arm",
    足: "leg",
  };

  const slotKey = slotMap[slot] ?? "";

  const craftPrefixMap = {
    "3": "armor",
    "4": "tailor",
  };

  const craftPrefix = craftPrefixMap[craftTypeId] ?? "armor";

  if (kind === "weapon" && typeKey && equipLevel) {
    return `${typeKey}_${equipLevel}`;
  }

  if (kind === "shield" && typeKey && equipLevel) {
    return `${typeKey}_${equipLevel}`;
  }

  if (kind === "armor" && equipLevel && slotKey && equipmentTypeId) {
    return `${craftPrefix}_${equipLevel}_${slotKey}_${equipmentTypeId}`;
  }

  if (itemName) {
    return itemName
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
  }

  return "";
}










export function getGridPreset(gridType) {
  const type = str(gridType).trim();
  return GRID_TYPE_PRESETS[type] ?? null;
}

export function isDisabledCell(gridType, r, c) {
  const preset = getGridPreset(gridType);
  if (!preset) return false;
  return preset.disabledCells.some(([rr, cc]) => rr === r && cc === c);
}

export function normalizeGrid(gridLike, colsHint = 0) {
  if (!gridLike) return { grid: [], rows: 0, cols: colsHint };

  if (Array.isArray(gridLike) && gridLike.every((x) => Array.isArray(x))) {
    const rows = gridLike.length;
    const cols = Math.max(
      colsHint,
      ...gridLike.map((r) => (Array.isArray(r) ? r.length : 0)),
      0
    );

    return {
      grid: Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => gridLike?.[r]?.[c] ?? "")
      ),
      rows,
      cols,
    };
  }

  if (Array.isArray(gridLike)) {
    const cols = Math.max(colsHint, gridLike.length, 0);
    return {
      grid: [Array.from({ length: cols }, (_, c) => gridLike?.[c] ?? "")],
      rows: 1,
      cols,
    };
  }

  return { grid: [], rows: 0, cols: colsHint };
}

export function ensureGridSize(curGrid, rowsCount, colsCount) {
  return Array.from({ length: rowsCount }, (_, r) =>
    Array.from({ length: colsCount }, (_, c) => curGrid?.[r]?.[c] ?? "")
  );
}

export function denormalizeGrid(grid2d) {
  if (!Array.isArray(grid2d) || grid2d.length === 0) return null;
  const rows = grid2d.length;
  const cols = Math.max(...grid2d.map((r) => r.length), 0);
  const normalized = grid2d.map((r) =>
    Array.from({ length: cols }, (_, c) => r?.[c] ?? "")
  );
  return rows === 1 ? normalized[0] : normalized;
}

export function getGroupDisplayName(row) {
  return str(row.groupName).trim() || str(row.itemName).trim();
}

export function buildGroupedRows(rows) {
  const map = new Map();
  const counts = new Map();

  for (const row of rows) {
    const gid = str(row.groupId).trim();
    if (!gid) continue;
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }

  for (const row of rows) {
    const gid = str(row.groupId).trim();
    const grouped = gid && (counts.get(gid) ?? 0) > 1;

    if (!grouped) {
      map.set(`single:${row.__key}`, {
        __kind: "single",
        __key: row.__key,
        label: row.itemName,
        searchText: [
          row.itemName,
          row.groupName,
          row.slot,
          row.recipeBook,
          row.recipePlace,
          row.equipmentTypeName,
        ]
          .filter(Boolean)
          .join(" "),
        row,
      });
      continue;
    }

    const groupKey = gid;
    const existing =
      map.get(`group:${groupKey}`) ??
      {
        __kind: "group",
        __key: `group:${groupKey}`,
        groupId: groupKey,
        label: getGroupDisplayName(row),
        groupKind: row.groupKind,
        rows: [],
        items: [],
        searchText: "",
      };

    existing.rows.push(row);
    existing.items.push({
      __key: row.__key,
      itemName: row.itemName,
      slot: row.slot,
    });

    existing.searchText = [
      existing.label,
      existing.groupKind,
      ...existing.items.map((x) => `${x.itemName} ${x.slot}`),
    ]
      .filter(Boolean)
      .join(" ");

    map.set(`group:${groupKey}`, existing);
  }

  return Array.from(map.values());
}

export function buildEmptyGroupMembers(groupKind) {
  const preset = GROUP_MEMBER_PRESETS[groupKind] ?? [];
  return preset.map((x) => ({
    key: x.key,
    enabled: true,
    slotLabel: x.label,
    slot: x.slot,
    slotGridType: x.slotGridType,
    itemName: x.label,
  }));
}

export function makeGroupId(groupName) {
  return slugify(groupName);
}

export function getDefaultGroupItemName(groupName, slotLabel) {
  return `${str(groupName).trim()}${slotLabel}`.trim();
}

export function findEquipmentTypeById(equipmentTypes = [], equipmentTypeId) {
  return (
    equipmentTypes.find(
      (type) => String(type.id) === String(equipmentTypeId ?? "")
    ) ?? null
  );
}

export function getCraftGridTypeByBaseSlot(baseSlot, groupKind) {
  const slot = str(baseSlot).trim();

  if (groupKind === "armor_set") {
    const map = {
      頭: "鎧頭",
      体上: "鎧上",
      からだ上: "鎧上",
      体下: "鎧下",
      からだ下: "鎧下",
      腕: "鎧腕",
      足: "鎧足",
    };
    return map[slot] ?? "";
  }

  if (groupKind === "tailoring_set") {
    const map = {
      頭: "裁縫頭",
      体上: "裁縫上",
      からだ上: "裁縫上",
      体下: "裁縫下",
      からだ下: "裁縫下",
      腕: "裁縫腕",
      足: "裁縫足",
    };
    return map[slot] ?? "";
  }

  return "";
}

export function getAutoSlotGridType(
  slot,
  equipmentType,
  groupKind = null,
  member = null
) {
  const rawSlot = str(slot).trim();

  if (groupKind === "craft_tool_set") {
    return str(member?.slotGridType).trim();
  }

  if (!rawSlot) return "";

  if (groupKind === "armor_set" || groupKind === "tailoring_set") {
    return getCraftGridTypeByBaseSlot(rawSlot, groupKind);
  }

  const typeName = str(equipmentType?.name ?? equipmentType?.label).trim();

  if (rawSlot === "盾") return "盾";
  if (rawSlot === "武器") return typeName || "武器";

  return "";
}

export function inferSingleSlotFromEquipmentType(equipmentType) {
  const typeName = str(equipmentType?.name ?? equipmentType?.label).trim();
  const craftTypeId = String(equipmentType?.craft_type_id ?? "");
  const normalized = typeName.toLowerCase();

  const matchers = [
    {
      keywords: ["頭", "ぼうし", "helmet", "hat", "cap", "hood", "circlet"],
      slot: "頭",
    },
    {
      keywords: ["からだ上", "体上", "upper", "top"],
      slot: "体上",
    },
    {
      keywords: ["からだ下", "体下", "lower", "bottom", "pants"],
      slot: "体下",
    },
    {
      keywords: ["腕", "うで", "glove", "gloves", "gauntlet"],
      slot: "腕",
    },
    {
      keywords: ["足", "あし", "shoe", "shoes", "boots", "boot"],
      slot: "足",
    },
    { keywords: ["盾", "shield"], slot: "盾" },
    {
      keywords: [
        "武器",
        "剣",
        "片手剣",
        "両手剣",
        "短剣",
        "ヤリ",
        "オノ",
        "ハンマー",
        "ツメ",
        "ムチ",
        "ブーメラン",
        "スティック",
        "両手杖",
        "棍",
        "扇",
        "弓",
        "鎌",
        "sword",
        "axe",
        "wand",
        "staff",
        "hammer",
        "spear",
        "bow",
        "dagger",
        "claw",
      ],
      slot: "武器",
    },
  ];

  const matched = matchers.find((item) =>
    item.keywords.some((keyword) =>
      normalized.includes(String(keyword).toLowerCase())
    )
  );

  const slot = matched?.slot ?? "";

  let inferredGroupKind = null;
  if (craftTypeId === "3") inferredGroupKind = "armor_set";
  if (craftTypeId === "4") inferredGroupKind = "tailoring_set";

  if (!inferredGroupKind) {
    if (
      typeName.includes("ローブ") ||
      typeName.includes("服") ||
      typeName.includes("裁縫")
    ) {
      inferredGroupKind = "tailoring_set";
    } else if (
      typeName.includes("鎧") ||
      typeName.includes("よろい") ||
      typeName.includes("アーマー")
    ) {
      inferredGroupKind = "armor_set";
    }
  }

  return {
    slot,
    slotGridType: getAutoSlotGridType(slot, equipmentType, inferredGroupKind),
  };
}