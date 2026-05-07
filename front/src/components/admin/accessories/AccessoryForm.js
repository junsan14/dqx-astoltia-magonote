"use client";

import { useEffect, useState } from "react";
import MonsterPicker from "@/components/admin/shared/MonsterPicker";
import {
  ACCESSORY_BASE_EFFECT_FIELDS,
  createEmptyAccessory,
  normalizeAccessory,
} from "@/lib/accessories";

const DROP_TYPE_OPTIONS = [
  { value: "normal", label: "通常" },
  { value: "rare", label: "レア" },
  { value: "steal", label: "ぬすむ" },
  { value: "other", label: "その他" },
];

export default function AccessoryForm({
  accessory,
  onChange,
  slots = [],
  accessoryTypes = [],
  isMobile = false,
}) {
  const [form, setForm] = useState(() => createEmptyAccessory());

  useEffect(() => {
    if (accessory) {
      setForm(normalizeAccessory(accessory));
      return;
    }

    setForm(createEmptyAccessory());
  }, [accessory]);

  function updateForm(nextForm) {
    setForm(nextForm);
    onChange?.(nextForm);
  }

  function updateField(key, value) {
    updateForm({
      ...form,
      [key]: value,
    });
  }

  function updateJsonRow(key, index, field, value) {
    const rows = Array.isArray(form[key]) ? [...form[key]] : [];

    rows[index] = {
      ...rows[index],
      [field]: value,
    };

    updateField(key, rows);
  }

  function addJsonRow(key, text = "") {
    const rows = Array.isArray(form[key]) ? [...form[key]] : [];

    rows.push({
      text,
    });

    updateField(key, rows);
  }

  function removeJsonRow(key, index) {
    const rows = Array.isArray(form[key]) ? [...form[key]] : [];
    rows.splice(index, 1);
    updateField(key, rows);
  }

  return (
    <div style={formStyle}>
      <div style={headerStyle(isMobile)}>
        <h2 style={headingStyle}>
          {form?.id ? "アクセサリ編集" : "アクセサリ新規作成"}
        </h2>
      </div>

      <Section title="基本情報">
        <div style={gridStyle(isMobile)}>
          <Field label="アイテムID">
            <input
              value={form.item_id}
              onChange={(e) => updateField("item_id", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="名前">
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="英語名">
            <input
              value={form.name_en}
              onChange={(e) => updateField("name_en", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="装備レベル">
            <input
              type="number"
              value={form.equip_level}
              onChange={(e) => updateField("equip_level", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="部位">
            <>
              <input
                list="accessory-slot-list"
                value={form.slot}
                onChange={(e) => updateField("slot", e.target.value)}
                style={inputStyle}
              />
              <datalist id="accessory-slot-list">
                {slots.map((slot) => (
                  <option key={slot} value={slot} />
                ))}
              </datalist>
            </>
          </Field>

          <Field label="アクセサリータイプ">
            <>
              <input
                list="accessory-type-list"
                value={form.accessory_type}
                onChange={(e) => updateField("accessory_type", e.target.value)}
                style={inputStyle}
              />
              <datalist id="accessory-type-list">
                {accessoryTypes.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </>
          </Field>
        </div>
      </Section>

      <Section title="基礎効果">
        <div style={effectTwoColumnsStyle(isMobile)}>
          <div style={effectColumnStyle}>
            {[
              "attack",
              "defense",
              "max_hp",
              "max_mp",
              "charm",
            ].map((key) => {
              const field = ACCESSORY_BASE_EFFECT_FIELDS.find(
                (item) => item.key === key
              );

              if (!field) return null;

              return (
                <Field key={field.key} label={field.label}>
                  <input
                    type="number"
                    value={form[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              );
            })}
          </div>

          <div style={effectColumnStyle}>
            {[
              "agility",
              "dexterity",
              "magic_attack",
              "healing_power",
              "weight",
            ].map((key) => {
              const field = ACCESSORY_BASE_EFFECT_FIELDS.find(
                (item) => item.key === key
              );

              if (!field) return null;

              return (
                <Field key={field.key} label={field.label}>
                  <input
                    type="number"
                    value={form[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              );
            })}
          </div>
        </div>
      </Section>
      <JsonTabsEditor
        title="基礎効果JSON"
        rows={form.effects_json}
        onAdd={(text) => addJsonRow("effects_json", text)}
        onRemove={(index) => removeJsonRow("effects_json", index)}
        onChange={(index, field, value) =>
          updateJsonRow("effects_json", index, field, value)
        }
        isMobile={isMobile}
      />

      <Section title="説明">
        <Field label="説明文">
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            style={textareaStyle}
          />
        </Field>
      </Section>

      <JsonTabsEditor
        title="付く合成効果"
        rows={form.synthesis_effects_json}
        onAdd={(text) => addJsonRow("synthesis_effects_json", text)}
        onRemove={(index) => removeJsonRow("synthesis_effects_json", index)}
        onChange={(index, field, value) =>
          updateJsonRow("synthesis_effects_json", index, field, value)
        }
        isMobile={isMobile}
      />

      <JsonTabsEditor
        title="補足"
        rows={form.obtain_methods_json}
        onAdd={(text) => addJsonRow("obtain_methods_json", text)}
        onRemove={(index) => removeJsonRow("obtain_methods_json", index)}
        onChange={(index, field, value) =>
          updateJsonRow("obtain_methods_json", index, field, value)
        }
        isMobile={isMobile}
      />

      <Section title="画像・URL">
        <Field label="画像URL">
          <input
            value={form.image_url}
            onChange={(e) => updateField("image_url", e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="参照元URL">
          <input
            value={form.source_url}
            onChange={(e) => updateField("source_url", e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="詳細URL">
          <input
            value={form.detail_url}
            onChange={(e) => updateField("detail_url", e.target.value)}
            style={inputStyle}
          />
        </Field>
      </Section>

      <Section title="落とすモンスター">
        <MonsterPicker
          value={form.drop_monsters ?? []}
          onChange={(nextRows) => updateField("drop_monsters", nextRows)}
          defaultDropType="normal"
          dropTypeOptions={DROP_TYPE_OPTIONS}
          enableDropTypeSelect={true}
          titleWhenEmpty="まだモンスターが登録されていない"
        />
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      <div style={sectionBodyStyle}>{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label style={fieldStyle}>
      <div style={labelStyle}>{label}</div>
      {children}
    </label>
  );
}

function JsonTabsEditor({
  title,
  rows = [],
  onAdd,
  onRemove,
  onChange,
  isMobile = false,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [draftText, setDraftText] = useState("");

  const safeRows = Array.isArray(rows) ? rows : [];
  const activeRow = safeRows[activeIndex] ?? null;

  function handleAddFromInput() {
    const text = draftText.trim();
    if (!text) return;

    onAdd?.(text);
    setDraftText("");
    setActiveIndex(safeRows.length);
  }

  function handleKeyDown(e) {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      handleAddFromInput();
    }
  }

  function handleRemove(index) {
    onRemove?.(index);

    if (activeIndex >= safeRows.length - 1) {
      setActiveIndex(Math.max(0, safeRows.length - 2));
    }
  }

  return (
    <Section title={title}>
      <div style={jsonEditorStyle}>
        <Field label="追加する内容">
          <input
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={inputStyle}
            placeholder="入力して Tab または Enter で追加"
          />
        </Field>

        <div style={jsonTabsHeaderStyle}>
          <div style={jsonTabsStyle}>
            {safeRows.map((row, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveIndex(index)}
                style={tabButtonStyle(activeIndex === index)}
              >
                {row?.text || index + 1}
              </button>
            ))}
          </div>
        </div>

        {safeRows.length === 0 ? (
          <div style={emptyBoxStyle}>
            まだ登録されていない。入力して Tab または Enter で追加できる。
          </div>
        ) : (
          <div style={jsonPanelStyle}>
            <div style={jsonPanelHeaderStyle(isMobile)}>
              <strong>
                {title} {activeIndex + 1}
              </strong>

              <button
                type="button"
                onClick={() => handleRemove(activeIndex)}
                style={dangerButtonStyle}
              >
                削除
              </button>
            </div>

            <Field label="内容">
              <input
                value={activeRow?.text ?? ""}
                onChange={(e) => onChange(activeIndex, "text", e.target.value)}
                style={inputStyle}
                placeholder="例：さいだいHP +2"
              />
            </Field>
          </div>
        )}
      </div>
    </Section>
  );
}
const formStyle = {
  display: "grid",
  gap: 16,
  minWidth: 0,
  color: "var(--text-main)",
};

const headerStyle = (isMobile) => ({
  display: "flex",
  flexDirection: isMobile ? "column" : "row",
  justifyContent: "space-between",
  alignItems: isMobile ? "stretch" : "center",
  gap: 12,
});

const headingStyle = {
  margin: 0,
  lineHeight: 1.3,
  color: "var(--text-title)",
};

const sectionStyle = {
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid var(--border-main, #ddd)",
  borderRadius: 12,
  background: "var(--card-bg, transparent)",
};
const effectTwoColumnsStyle = (isMobile) => ({
  display: "grid",
  gridTemplateColumns: isMobile
    ? "minmax(0, 1fr)"
    : "repeat(2, minmax(0, 1fr))",
  gap: 14,
});

const effectColumnStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minWidth: 0,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 16,
  color: "var(--text-title)",
};

const sectionBodyStyle = {
  display: "grid",
  gap: 12,
};

const gridStyle = (isMobile) => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
  gap: 12,
});

const fieldStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const labelStyle = {
  fontWeight: 700,
  fontSize: 14,
  color: "var(--text-sub)",
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  padding: "10px 12px",
  border: "1px solid var(--input-border)",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  background: "var(--input-bg)",
  color: "var(--input-text)",
};

const textareaStyle = {
  width: "100%",
  minWidth: 0,
  padding: "10px 12px",
  border: "1px solid var(--input-border)",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  resize: "vertical",
  background: "var(--input-bg)",
  color: "var(--input-text)",
};

const jsonEditorStyle = {
  display: "grid",
  gap: 12,
};

const jsonTabsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const jsonTabsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const tabButtonStyle = (isActive) => ({
  border: "1px solid var(--input-border)",
  borderRadius: 999,
  padding: "7px 12px",
  cursor: "pointer",
  background: isActive ? "var(--text-title)" : "var(--input-bg)",
  color: isActive ? "var(--bg-main, #fff)" : "var(--input-text)",
  fontWeight: 700,
});



const dangerButtonStyle = {
  border: "1px solid #ef4444",
  borderRadius: 8,
  padding: "7px 12px",
  cursor: "pointer",
  background: "transparent",
  color: "#ef4444",
  fontWeight: 700,
};

const jsonPanelStyle = {
  display: "grid",
  gap: 12,
  padding: 12,
  border: "1px dashed var(--input-border)",
  borderRadius: 10,
};

const jsonPanelHeaderStyle = (isMobile) => ({
  display: "flex",
  flexDirection: isMobile ? "column" : "row",
  justifyContent: "space-between",
  alignItems: isMobile ? "stretch" : "center",
  gap: 8,
});

const emptyBoxStyle = {
  padding: 14,
  border: "1px dashed var(--input-border)",
  borderRadius: 10,
  color: "var(--text-sub)",
};