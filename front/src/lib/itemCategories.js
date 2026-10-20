export const ITEM_CATEGORIES = [
  { value: "consumable", label: "消費アイテム" },
  { value: "recipe", label: "レシピ" },
  { value: "material", label: "素材" },
  { value: "scout", label: "スカウトの書" },
];

export function normalizeItemCategory(value = "") {
  const text = String(value ?? "").trim();
  const category = ITEM_CATEGORIES.find(
    (option) => option.value === text.toLowerCase() || option.label === text
  );
  return category?.value ?? text;
}

export function itemCategoryLabel(value = "") {
  const key = normalizeItemCategory(value);
  return ITEM_CATEGORIES.find((option) => option.value === key)?.label ?? key;
}
