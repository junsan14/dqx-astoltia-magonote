"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createAccessory,
  createEmptyAccessory,
  deleteAccessory,
  fetchAccessory,
  fetchAccessories,
  updateAccessory,
} from "@/lib/accessories";

import AccessoryList from "./AccessoryList";
import AccessoryForm from "./AccessoryForm";

import EditorShell from "@/components/admin/shared/editor/EditorShell";
import EditorSidebar from "@/components/admin/shared/editor/EditorSidebar";
import EditorHeader from "@/components/admin/shared/editor/EditorHeader";
import useEditorLayout from "@/components/admin/shared/editor/useEditorLayout";
import FloatingToast from "@/components/admin/shared/editor/FloatingToast";
import useFloatingToast from "@/components/admin/shared/editor/useFloatingToast";

export default function AccessoriesClient() {
  const [accessories, setAccessories] = useState([]);
  const [initialAccessories, setInitialAccessories] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [selectedAccessory, setSelectedAccessory] = useState(() =>
    createEmptyAccessory()
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [hideSearchList, setHideSearchList] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { toast, showToast } = useFloatingToast();

  const {
    isMobile,
    sidebarOpen,
    closeSidebar,
    openSidebar,
    toggleSidebar,
  } = useEditorLayout(900);

  const slots = useMemo(() => {
    return [
      ...new Set(
        initialAccessories
          .map((item) => (item.slot ?? "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "ja"));
  }, [initialAccessories]);

  const accessoryTypes = useMemo(() => {
    return [
      ...new Set(
        initialAccessories
          .map((item) => (item.accessory_type ?? "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "ja"));
  }, [initialAccessories]);

  async function loadAccessories(q = "") {
    setLoading(true);

    try {
      const list = await fetchAccessories(q);
      const safeList = Array.isArray(list) ? list : [];

      setAccessories(safeList);

      if (!q) {
        setInitialAccessories(safeList);
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "アクセサリ一覧取得失敗", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadAccessoryDetail(id) {
    if (!id) {
      setSelectedAccessory(createEmptyAccessory());
      return;
    }

    setDetailLoading(true);

    try {
      const accessory = await fetchAccessory(id);
      setSelectedAccessory(accessory ?? createEmptyAccessory());
    } catch (error) {
      console.error(error);
      showToast(error.message || "アクセサリ詳細取得失敗", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadAccessories("");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHideSearchList(false);
      loadAccessories(keyword);
    }, 250);

    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedAccessory(createEmptyAccessory());
      return;
    }

    loadAccessoryDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!isMobile) {
      setHideSearchList(false);
    }
  }, [isMobile]);

  async function handleSaved(saved, options = {}) {
    const { isEdit = false } = options;

    await loadAccessories(keyword);
    await loadAccessories("");

    if (saved?.id) {
      setSelectedId(saved.id);
      await loadAccessoryDetail(saved.id);

      if (isMobile) {
        setHideSearchList(true);
        closeSidebar();
      }
    }

    const targetName = saved?.name || selectedAccessory?.name || "アクセサリ";

    showToast(
      isEdit
        ? `「${targetName}」を更新した`
        : `「${targetName}」を作成した`
    );
  }

  async function handleDeleted(deletedId, deletedName = "アクセサリ") {
    await loadAccessories(keyword);
    await loadAccessories("");

    if (selectedId === deletedId) {
      setSelectedId(null);
      setSelectedAccessory(createEmptyAccessory());
    }

    if (isMobile) {
      setHideSearchList(false);
      openSidebar();
    }

    showToast(`「${deletedName}」を削除した`);
  }

  function handleClickNew() {
    setSelectedId(null);
    setSelectedAccessory(createEmptyAccessory());
    setHideSearchList(false);

    if (isMobile) {
      closeSidebar();
    }
  }

  function handleSelectAccessory(id) {
    setSelectedId(id);

    if (isMobile) {
      setHideSearchList(true);
      closeSidebar();
    }
  }

  function handleKeywordChange(value) {
    setKeyword(value);
    setHideSearchList(false);
  }

  function handleAccessoryChange(nextAccessory) {
    setSelectedAccessory(nextAccessory);
  }

  async function handleSave() {
    try {
      setSaving(true);

      const isEdit = Boolean(selectedId && selectedAccessory?.id);

      const saved = isEdit
        ? await updateAccessory(selectedAccessory.id, selectedAccessory)
        : await createAccessory(selectedAccessory);

      await handleSaved(saved, { isEdit });
    } catch (error) {
      console.error(error);
      showToast(error.message || "保存失敗", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId || !selectedAccessory?.id) return;

    const targetName = selectedAccessory?.name || "アクセサリ";

    const ok = window.confirm(`「${targetName}」を削除する？`);
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteAccessory(selectedAccessory.id);
      await handleDeleted(selectedAccessory.id, targetName);
    } catch (error) {
      console.error(error);
      showToast(error.message || "削除失敗", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <EditorShell
        isMobile={isMobile}
        sidebar={
          <AccessoriesSidebarSection
            isMobile={isMobile}
            isOpen={sidebarOpen}
            onToggle={toggleSidebar}
            keyword={keyword}
            onKeywordChange={handleKeywordChange}
            onCreateNew={handleClickNew}
            loading={loading}
            accessories={accessories}
            selectedId={selectedId}
            onSelect={handleSelectAccessory}
            hideSearchList={hideSearchList}
            onReopenList={() => setHideSearchList(false)}
          />
        }
      >
        <AccessoriesWorkspaceSection
          isMobile={isMobile}
          selectedId={selectedId}
          selectedAccessory={selectedAccessory}
          detailLoading={detailLoading}
          slots={slots}
          accessoryTypes={accessoryTypes}
          saving={saving}
          deleting={deleting}
          onSave={handleSave}
          onDelete={handleDelete}
          onChange={handleAccessoryChange}
        />
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

function AccessoriesSidebarSection({
  isMobile,
  isOpen,
  onToggle,
  keyword,
  onKeywordChange,
  onCreateNew,
  loading,
  accessories,
  selectedId,
  onSelect,
  hideSearchList,
  onReopenList,
}) {
  return (
    <EditorSidebar
      isMobile={isMobile}
      isOpen={isOpen}
      onToggle={onToggle}
      keyword={keyword}
      onKeywordChange={onKeywordChange}
      onCreateNew={onCreateNew}
      createLabel="新規追加"
      loading={loading}
      title="アクセサリ編集"
      searchPlaceholder="名前 / 種別 / 部位で検索"
    >
      {!hideSearchList ? (
        <AccessoryList
          accessories={accessories}
          loading={loading}
          selectedId={selectedId}
          onSelect={onSelect}
          isMobile={isMobile}
        />
      ) : (
        <button type="button" onClick={onReopenList} style={styles.reopenButton}>
          候補を再表示
        </button>
      )}
    </EditorSidebar>
  );
}

function AccessoriesWorkspaceSection({
  isMobile,
  selectedId,
  selectedAccessory,
  detailLoading,
  slots,
  accessoryTypes,
  saving,
  deleting,
  onSave,
  onDelete,
  onChange,
}) {
  return (
    <>
      <EditorHeader
        isMobile={isMobile}
        title={
          selectedId
            ? `${selectedAccessory?.name || "アクセサリ"}を編集中`
            : "新規アクセサリ作成"
        }
        onSave={onSave}
        onDelete={onDelete}
        saving={saving}
        saveDisabled={detailLoading || saving || deleting}
        deleteDisabled={detailLoading || saving || deleting || !selectedId}
      />

      {detailLoading ? (
        <div style={styles.loadingPanel}>読み込み中...</div>
      ) : (
        <div style={styles.panel}>
          <AccessoryForm
            accessory={selectedAccessory}
            onChange={onChange}
            slots={slots}
            accessoryTypes={accessoryTypes}
            isMobile={isMobile}
          />
        </div>
      )}
    </>
  );
}

const styles = {
  panel: {
    border: "1px solid var(--panel-border)",
    borderRadius: 12,
    background: "var(--panel-bg)",
    padding: 16,
    boxSizing: "border-box",
    color: "var(--page-text)",
    minWidth: 0,
  },

  loadingPanel: {
    border: "1px solid var(--panel-border)",
    borderRadius: 12,
    background: "var(--panel-bg)",
    padding: 16,
    boxSizing: "border-box",
    color: "var(--page-text)",
    minWidth: 0,
  },

  reopenButton: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--soft-border)",
    background: "var(--soft-bg)",
    color: "var(--text-sub)",
    cursor: "pointer",
    fontWeight: 700,
  },
};