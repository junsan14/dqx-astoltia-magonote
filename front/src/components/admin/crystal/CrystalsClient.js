"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import CrystalForm from "@/components/admin/crystal/CrystalForm";
import CrystalTable from "@/components/admin/crystal/CrystalTable";
import EditorShell from "@/components/admin/shared/editor/EditorShell";
import EditorHeader from "@/components/admin/shared/editor/EditorHeader";
import useEditorLayout from "@/components/admin/shared/editor/useEditorLayout";
import FloatingToast from "@/components/admin/shared/editor/FloatingToast";
import useFloatingToast from "@/components/admin/shared/editor/useFloatingToast";
import {
  fetchCrystalRules,
  createCrystalRule,
  updateCrystalRule,
  deleteCrystalRule,
} from "@/lib/crystalRules";

const emptyCreateForm = {
  min_level: "",
  max_level: "",
  plus0: "",
  plus1: "",
  plus2: "",
  plus3: "",
};

const emptyEditForm = {
  id: "",
  min_level: "",
  max_level: "",
  plus0: "",
  plus1: "",
  plus2: "",
  plus3: "",
};

function toEditForm(rule) {
  return {
    id: String(rule.id),
    min_level: String(rule.min_level ?? ""),
    max_level: String(rule.max_level ?? ""),
    plus0: String(rule.plus0 ?? ""),
    plus1: String(rule.plus1 ?? ""),
    plus2: String(rule.plus2 ?? ""),
    plus3: String(rule.plus3 ?? ""),
  };
}

function normalizePayload(source) {
  return {
    min_level: Number(source.min_level),
    max_level: Number(source.max_level),
    plus0: Number(source.plus0),
    plus1: Number(source.plus1),
    plus2: Number(source.plus2),
    plus3: Number(source.plus3),
  };
}

function validatePayload(payload) {
  const values = Object.values(payload);

  if (values.some((value) => Number.isNaN(value))) {
    throw new Error("数値の入力が不正");
  }

  if (payload.min_level > payload.max_level) {
    throw new Error("最小レベルは最大レベル以下にして");
  }
}

export default function CrystalsClient() {
  const [rulesState, setRulesState] = useState([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const { toast, showToast } = useFloatingToast();

  const { isMobile } = useEditorLayout(768);

  useEffect(() => {
    let active = true;

    async function loadRules() {
      try {
        setIsLoading(true);
        setError("");
        const rules = await fetchCrystalRules();

        if (!active) return;
        setRulesState(Array.isArray(rules) ? rules : []);
      } catch (e) {
        if (!active) return;
        setError(e?.message || "結晶ルールの取得に失敗した");
        showToast(e?.message || "結晶ルールの取得に失敗した", "error");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadRules();

    return () => {
      active = false;
    };
  }, [showToast]);

  const rules = useMemo(() => {
    return [...(rulesState || [])].sort((a, b) => a.min_level - b.min_level);
  }, [rulesState]);

  const activeForm = editingId ? editForm : createForm;
  const headerTitle = editingId ? "新規結晶ルール作成" : "新規結晶ルール作成";
  const headerDescription = editingId
    ? `編集中 ID: ${editingId}`
    : "追加、一覧確認、編集、削除を行う";

  function handleCreateChange(key, value) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCreateReset() {
    setCreateForm(emptyCreateForm);
    setMessage("");
    setError("");
  }

  function handleEditStart(rule) {
    setMessage("");
    setError("");
    setEditingId(rule.id);
    setEditForm(toEditForm(rule));
  }

  function handleEditChange(key, value) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditForm(emptyEditForm);
    setMessage("");
    setError("");
  }

  function syncCreatedRule(createdRule) {
    if (!createdRule?.id) return;
    setRulesState((prev) => [...prev, createdRule]);
  }

  function syncUpdatedRule(id, payload) {
    setRulesState((prev) =>
      prev.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              ...payload,
            }
          : rule
      )
    );
  }

  function syncDeletedRule(id) {
    setRulesState((prev) => prev.filter((rule) => rule.id !== id));
  }

  function handleHeaderSave() {
    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        if (editingId) {
          const id = Number(editForm.id);
          if (!id) {
            throw new Error("IDが不正");
          }

          const payload = normalizePayload(editForm);
          validatePayload(payload);

          const updated = await updateCrystalRule(id, payload);
          const targetName = `Lv${payload.min_level}〜${payload.max_level}`;

          syncUpdatedRule(id, payload);
          setMessage(updated?.message || "更新した");
          setEditingId(null);
          setEditForm(emptyEditForm);
          showToast(`「${targetName}」を更新した`);
        } else {
          const payload = normalizePayload(createForm);
          validatePayload(payload);

          const created = await createCrystalRule(payload);
          const targetName = `Lv${payload.min_level}〜${payload.max_level}`;

          if (created?.id != null) {
            syncCreatedRule({
              id: Number(created.id),
              ...payload,
            });
          } else if (created?.data?.id != null) {
            syncCreatedRule({
              id: Number(created.data.id),
              ...payload,
            });
          } else {
            const refreshed = await fetchCrystalRules();
            setRulesState(Array.isArray(refreshed) ? refreshed : []);
          }

          setMessage(created?.message || "結晶ルールを追加した");
          setCreateForm(emptyCreateForm);
          showToast(`「${targetName}」を作成した`);
        }
      } catch (e) {
        setError(e?.message || (editingId ? "更新失敗" : "追加に失敗した"));
        showToast(
          e?.message || (editingId ? "更新失敗" : "追加に失敗した"),
          "error"
        );
      }
    });
  }

  function handleHeaderDelete(targetId) {
    const id = Number(targetId ?? editingId);
    if (!id) return;

    const ok = window.confirm("削除する？");
    if (!ok) return;

    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        const targetName = editingId
          ? `Lv${editForm.min_level}〜${editForm.max_level}`
          : `ID:${id}`;

        await deleteCrystalRule(id);
        syncDeletedRule(id);
        setMessage("削除した");
        showToast(`「${targetName}」を削除した`);

        if (editingId === id) {
          setEditingId(null);
          setEditForm(emptyEditForm);
        }
      } catch (e) {
        setError(e?.message || "削除失敗");
        showToast(e?.message || "削除失敗", "error");
      }
    });
  }

  return (
    <>
      <EditorShell isMobile={isMobile}>
        <EditorHeader
          isMobile={isMobile}
          title={headerTitle}
          
          description={headerDescription}
          notice={editingId ? `編集中 ID: ${editingId}` : ""}
          onSave={handleHeaderSave}
          onDelete={handleHeaderDelete}
          saving={isPending || isLoading}
          saveDisabled={isPending || isLoading}
          deleteDisabled={isPending || isLoading || !editingId}
        />

        <div style={styles.stack}>
          <div style={styles.panel}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>
                {editingId ? "結晶ルール編集" : "結晶ルール追加"}
              </h2>
              <p style={styles.sectionDesc}>
                {editingId
                  ? "選択中の結晶価格ルールを編集する"
                  : "新しいレベル帯の結晶価格ルールを追加する"}
              </p>
            </div>

            <CrystalForm
              form={activeForm}
              isPending={isPending || isLoading}
              message={message}
              error={error}
              onChange={editingId ? handleEditChange : handleCreateChange}
              onReset={editingId ? handleEditCancel : handleCreateReset}
              isMobile={isMobile}
              submitLabel={editingId ? "更新" : "追加"}
              resetLabel={editingId ? "編集をやめる" : "リセット"}
              hideSubmitButton
            />
          </div>

          <div style={styles.panel}>
            <CrystalTable
              rules={rules}
              editingId={editingId}
              editForm={editForm}
              isPending={isPending || isLoading}
              onEditStart={handleEditStart}
              onEditChange={handleEditChange}
              onEditCancel={handleEditCancel}
              onEditSave={handleHeaderSave}
              onDelete={handleHeaderDelete}
              isMobile={isMobile}
            />
          </div>
        </div>
      </EditorShell>

      <FloatingToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isMobile={isMobile}
      />
    </>
  );
}

const styles = {
  stack: {
    display: "grid",
    gap: 16,
  },

  panel: {
    border: "1px solid var(--panel-border, #d1d5db)",
    borderRadius: 14,
    background: "var(--panel-bg, #ffffff)",
    padding: 16,
    color: "var(--page-text, #111827)",
    minWidth: 0,
  },

  sectionHeader: {
    display: "grid",
    gap: 4,
    marginBottom: 12,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 18,
    color: "var(--text-title, var(--page-text, #111827))",
  },

  sectionDesc: {
    margin: 0,
    fontSize: 13,
    color: "var(--text-muted, #64748b)",
    lineHeight: 1.6,
  },
};