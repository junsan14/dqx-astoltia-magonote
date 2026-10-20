export const ITEM_CATEGORIES = [
  { value: "消費アイテム", label: "消費アイテム", legacyValue: "consumable" },
  { value: "レシピ", label: "レシピ", legacyValue: "recipe" },
  { value: "素材", label: "素材", legacyValue: "material" },
  { value: "スカウトの書", label: "スカウトの書", legacyValue: "scout" },
];

export function normalizeItemCategory(value = "") {
  const text = String(value ?? "").trim();
  const category = ITEM_CATEGORIES.find(
    (option) => option.legacyValue === text.toLowerCase() || option.value === text
  );
  return category?.value ?? text;
}

export function itemCategoryLabel(value = "") {
  return normalizeItemCategory(value);
}
