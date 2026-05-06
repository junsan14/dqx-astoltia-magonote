"use client";

import { useEffect, useState } from "react";
import ItemFormFields from "./ItemFormFields";

function createEmptyForm() {
  return {
    id: null,
    name: "",
    name_en: "",
    buy_price: "",
    sell_price: "",
    category: "",
    drop_monsters: [],
  };
}

export default function ItemForm({
  item,
  categories = [],
  errors = {},
  message = "",
  onChange,
}) {
  const [form, setForm] = useState(createEmptyForm());

  useEffect(() => {
    setForm({
      id: item?.id ?? null,
      name: item?.name ?? "",
      name_en: item?.name_en ?? item?.nameEn ?? "",
      buy_price:
        item?.buy_price === null || item?.buy_price === undefined
          ? ""
          : item.buy_price,
      sell_price:
        item?.sell_price === null || item?.sell_price === undefined
          ? ""
          : item.sell_price,
      category: item?.category ?? "",
      drop_monsters: (item?.drop_monsters ?? []).map((row, index) => ({
        id: row.id ?? null,
        monster_id: row.monster_id,
        drop_type: row.drop_type || "normal",
        sort_order: row.sort_order || index + 1,
        monster: row.monster
          ? {
              ...row.monster,
              name_en: row.monster?.name_en ?? "",
            }
          : null,
      })),
    });
  }, [item]);

  function updateForm(nextForm) {
    setForm(nextForm);
    onChange?.(nextForm);
  }

  return (
    <div style={formWrapStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>
            {form?.id ? "アイテム編集" : "アイテム新規追加"}
          </h2>
          {form?.id ? <div style={idStyle}>ID: {form.id}</div> : null}
        </div>
      </div>

      <ItemFormFields
        form={form}
        setForm={updateForm}
        errors={errors}
        categories={categories}
      />

      {message ? <div style={messageStyle}>{message}</div> : null}
    </div>
  );
}

const formWrapStyle = {
  display: "grid",
  gap: 20,
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const titleStyle = {
  margin: 0,
  fontSize: 22,
  color: "var(--text-title, var(--page-text, #111827))",
};

const idStyle = {
  marginTop: 6,
  fontSize: 13,
  color: "var(--text-muted, #64748b)",
};

const messageStyle = {
  fontSize: 14,
  color: "var(--text-sub, #334155)",
};