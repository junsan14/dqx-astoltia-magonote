"use client";

import { useEffect, useState } from "react";
import {
  createEmptyEquipmentType,
  createEquipmentType,
  deleteEquipmentType,
  fetchEquipmentType,
  fetchEquipmentTypes,
  updateEquipmentType,
} from "@/lib/equipmentTypes";
import { fetchCraftTypes } from "@/lib/craftTypes";

import EquipmentTypeList from "./EquipmentTypeList";
import EquipmentTypeForm from "./EquipmentTypeForm";

import EditorShell from "@/components/admin/shared/editor/EditorShell";
import EditorSidebar from "@/components/admin/shared/editor/EditorSidebar";
import EditorHeader from "@/components/admin/shared/editor/EditorHeader";
import useEditorLayout from "@/components/admin/shared/editor/useEditorLayout";
import FloatingToast from "@/components/admin/shared/editor/FloatingToast";
import useFloatingToast from "@/components/admin/shared/editor/useFloatingToast";

export default function EquipmentTypesClient() {
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const [craftTypes, setCraftTypes] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [selectedEquipmentType, setSelectedEquipmentType] = useState(() =>
    createEmptyEquipmentType()
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

  async function loadEquipmentTypes(q = "") {
    setLoading(true);

    try {
      const list = await fetchEquipmentTypes(q);
      const safeList = Array.isArray(list) ? list : [];

      setEquipmentTypes(safeList);
    } catch (error) {
      console.error(error);
      showToast(error.message || "装備種別一覧取得失敗", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadCraftTypes() {
    try {
      const list = await fetchCraftTypes("");
      const safeList = Array.isArray(list) ? list : [];

      setCraftTypes(safeList);
    } catch (error) {
      console.error(error);
      showToast(error.message || "職人種別一覧取得失敗", "error");
    }
  }

  async function loadEquipmentTypeDetail(id) {
    if (!id) {
      setSelectedEquipmentType(createEmptyEquipmentType());
      return;
    }

    setDetailLoading(true);

    try {
      const equipmentType = await fetchEquipmentType(id);
      setSelectedEquipmentType(equipmentType ?? createEmptyEquipmentType());
    } catch (error) {
      console.error(error);
      showToast(error.message || "装備種別詳細取得失敗", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadEquipmentTypes("");
    loadCraftTypes();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHideSearchList(false);
      loadEquipmentTypes(keyword);
    }, 250);

    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedEquipmentType(createEmptyEquipmentType());
      return;
    }

    loadEquipmentTypeDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!isMobile) {
      setHideSearchList(false);
    }
  }, [isMobile]);

  async function handleSaved(saved, options = {}) {
    const { isEdit = false } = options;

    await loadEquipmentTypes(keyword);
    await loadCraftTypes();

    if (saved?.id) {
      setSelectedId(saved.id);
      await loadEquipmentTypeDetail(saved.id);

      if (isMobile) {
        setHideSearchList(true);
        closeSidebar();
      }
    }

    const targetName =
      saved?.name || selectedEquipmentType?.name || "装備種別";

    showToast(
      isEdit
        ? `「${targetName}」を更新した`
        : `「${targetName}」を作成した`
    );
  }

  async function handleDeleted(deletedId, deletedName = "装備種別") {
    await loadEquipmentTypes(keyword);
    await loadCraftTypes();

    if (selectedId === deletedId) {
      setSelectedId(null);
      setSelectedEquipmentType(createEmptyEquipmentType());
    }

    if (isMobile) {
      setHideSearchList(false);
      openSidebar();
    }

    showToast(`「${deletedName}」を削除した`);
  }

  function handleClickNew() {
    setSelectedId(null);
    setSelectedEquipmentType(createEmptyEquipmentType());
    setHideSearchList(false);

    if (isMobile) {
      closeSidebar();
    }
  }

  function handleSelectEquipmentType(id) {
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

  function handleEquipmentTypeChange(nextEquipmentType) {
    setSelectedEquipmentType(nextEquipmentType);
  }

  async function handleSave() {
    try {
      setSaving(true);

      const isEdit = Boolean(selectedId && selectedEquipmentType?.id);

      const saved = isEdit
        ? await updateEquipmentType(
            selectedEquipmentType.id,
            selectedEquipmentType
          )
        : await createEquipmentType(selectedEquipmentType);

      await handleSaved(saved, { isEdit });
    } catch (error) {
      console.error(error);
      showToast(error.message || "保存失敗", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId || !selectedEquipmentType?.id) return;

    const targetName = selectedEquipmentType?.name || "装備種別";

    const ok = window.confirm(`「${targetName}」を削除する？`);
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteEquipmentType(selectedEquipmentType.id);
      await handleDeleted(selectedEquipmentType.id, targetName);
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
          <EquipmentTypesSidebarSection
            isMobile={isMobile}
            isOpen={sidebarOpen}
            onToggle={toggleSidebar}
            keyword={keyword}
            onKeywordChange={handleKeywordChange}
            onCreateNew={handleClickNew}
            loading={loading}
            equipmentTypes={equipmentTypes}
            selectedId={selectedId}
            onSelect={handleSelectEquipmentType}
            hideSearchList={hideSearchList}
            onReopenList={() => setHideSearchList(false)}
          />
        }
      >
        <EquipmentTypesWorkspaceSection
          isMobile={isMobile}
          selectedId={selectedId}
          selectedEquipmentType={selectedEquipmentType}
          detailLoading={detailLoading}
          craftTypes={craftTypes}
          saving={saving}
          deleting={deleting}
          onSave={handleSave}
          onDelete={handleDelete}
          onChange={handleEquipmentTypeChange}
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

function EquipmentTypesSidebarSection({
  isMobile,
  isOpen,
  onToggle,
  keyword,
  onKeywordChange,
  onCreateNew,
  loading,
  equipmentTypes,
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
      title="装備種別編集"
      searchPlaceholder="名前 / key / 武器 / 防具 / 職人で検索"
    >
      {!hideSearchList ? (
        <EquipmentTypeList
          equipmentTypes={equipmentTypes}
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

function EquipmentTypesWorkspaceSection({
  isMobile,
  selectedId,
  selectedEquipmentType,
  detailLoading,
  craftTypes,
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
            ? `${selectedEquipmentType?.name || "装備種別"}を編集中`
            : "新規装備種別作成"
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
          <EquipmentTypeForm
            equipmentType={selectedEquipmentType}
            onChange={onChange}
            craftTypes={craftTypes}
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