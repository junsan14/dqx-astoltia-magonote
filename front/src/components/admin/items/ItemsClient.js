"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createItem,
  deleteItem,
  fetchItem,
  fetchItems,
  updateItem,
} from "@/lib/items";
import ItemList from "./ItemList";
import ItemForm from "./ItemForm";

import EditorShell from "@/components/admin/shared/editor/EditorShell";
import EditorSidebar from "@/components/admin/shared/editor/EditorSidebar";
import EditorHeader from "@/components/admin/shared/editor/EditorHeader";
import useEditorLayout from "@/components/admin/shared/editor/useEditorLayout";
import FloatingToast from "@/components/admin/shared/editor/FloatingToast";
import useFloatingToast from "@/components/admin/shared/editor/useFloatingToast";

function createEmptyItem() {
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

function normalizeItem(row) {
  return {
    id: row?.id ?? null,
    name: row?.name ?? "",
    name_en: row?.name_en ?? row?.nameEn ?? "",
    buy_price:
      row?.buy_price === null || row?.buy_price === undefined
        ? ""
        : row.buy_price,
    sell_price:
      row?.sell_price === null || row?.sell_price === undefined
        ? ""
        : row.sell_price,
    category: row?.category ?? "",
    drop_monsters: Array.isArray(row?.drop_monsters)
      ? row.drop_monsters.map((r, index) => ({
          id: r.id ?? null,
          monster_id: r.monster_id,
          drop_type: r.drop_type || "normal",
          sort_order: r.sort_order || index + 1,
          monster: r.monster
            ? {
                ...r.monster,
                name_en: r.monster?.name_en ?? "",
              }
            : null,
        }))
      : [],
  };
}

function buildItemPayload(form) {
  return {
    name: (form.name ?? "").trim(),
    name_en: (form.name_en ?? "").trim() || null,
    buy_price:
      form.buy_price === "" || form.buy_price === null
        ? null
        : Number(form.buy_price),
    sell_price:
      form.sell_price === "" || form.sell_price === null
        ? null
        : Number(form.sell_price),
    category: (form.category ?? "").trim() || null,
    drop_monsters: Array.isArray(form.drop_monsters)
      ? form.drop_monsters.map((row, index) => ({
          id: row.id ?? null,
          monster_id: row.monster_id,
          drop_type: row.drop_type === "rare" ? "rare" : "normal",
          sort_order: index + 1,
        }))
      : [],
  };
}

export default function ItemsClient() {
  const [items, setItems] = useState([]);
  const [initialItems, setInitialItems] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(createEmptyItem());
  const [detailLoading, setDetailLoading] = useState(false);
  const [hideSearchList, setHideSearchList] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [message, setMessage] = useState("");

  const { toast, showToast } = useFloatingToast();

  const {
    isMobile,
    sidebarOpen,
    closeSidebar,
    openSidebar,
    toggleSidebar,
  } = useEditorLayout(900);

  const categories = useMemo(() => {
    return [
      ...new Set(
        initialItems
          .map((item) => (item.category ?? "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "ja"));
  }, [initialItems]);

  async function loadItems(q = "") {
    setLoading(true);

    try {
      const list = await fetchItems(q);
      const normalized = Array.isArray(list) ? list : [];

      setItems(normalized);

      if (!q) {
        setInitialItems(normalized);
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "アイテム一覧取得失敗", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadItemDetail(id) {
    if (!id) {
      setSelectedItem(createEmptyItem());
      return;
    }

    setDetailLoading(true);

    try {
      const item = await fetchItem(id);
      setSelectedItem(normalizeItem(item));
    } catch (error) {
      console.error(error);
      showToast(error.message || "アイテム詳細取得失敗", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadItems("");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHideSearchList(false);
      loadItems(keyword);
    }, 250);

    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(createEmptyItem());
      return;
    }

    loadItemDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!isMobile) {
      setHideSearchList(false);
    }
  }, [isMobile]);

  async function handleSaved(saved, options = {}) {
    const { isEdit = false } = options;

    await loadItems(keyword);
    await loadItems("");

    if (saved?.id) {
      setSelectedId(saved.id);
      await loadItemDetail(saved.id);

      if (isMobile) {
        setHideSearchList(true);
        closeSidebar();
      }
    }

    const targetName = saved?.name || selectedItem?.name || "アイテム";
    showToast(isEdit ? `「${targetName}」を更新した` : `「${targetName}」を作成した`);
  }

  async function handleDeleted(deletedId, deletedName = "アイテム") {
    await loadItems(keyword);
    await loadItems("");

    if (selectedId === deletedId) {
      setSelectedId(null);
      setSelectedItem(createEmptyItem());
    }

    if (isMobile) {
      setHideSearchList(false);
      openSidebar();
    }

    showToast(`「${deletedName}」を削除した`);
  }

  function handleClickNew() {
    setSelectedId(null);
    setSelectedItem(createEmptyItem());
    setFormErrors({});
    setMessage("");
    setHideSearchList(false);

    if (isMobile) {
      closeSidebar();
    }
  }

  function handleSelectItem(id) {
    setSelectedId(id);
    setFormErrors({});
    setMessage("");

    if (isMobile) {
      setHideSearchList(true);
      closeSidebar();
    }
  }

  function handleKeywordChange(value) {
    setKeyword(value);
    setHideSearchList(false);
  }

  function handleItemChange(nextItem) {
    setSelectedItem(nextItem);
    setFormErrors({});
    setMessage("");
  }

  async function handleSave() {
    setMessage("");
    setFormErrors({});

    const payload = buildItemPayload(selectedItem);

    const nextErrors = {};
    if (!payload.name) nextErrors.name = "名前は必須";

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);

      const isEdit = Boolean(selectedId && selectedItem?.id);

      const saved = isEdit
        ? await updateItem(selectedItem.id, payload)
        : await createItem(payload);

      setMessage(isEdit ? "更新した" : "新規追加した");
      await handleSaved(saved, { isEdit });
    } catch (error) {
      console.error(error);
      setMessage(error.message || "保存失敗");
      showToast(error.message || "保存失敗", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId || !selectedItem?.id) return;

    const targetName = selectedItem?.name || "アイテム";
    const ok = window.confirm(`「${targetName}」を削除する?`);
    if (!ok) return;

    try {
      setDeleting(true);
      setMessage("");

      await deleteItem(selectedItem.id);
      setMessage("削除した");

      await handleDeleted(selectedItem.id, targetName);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "削除失敗");
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
          <ItemsSidebarSection
            isMobile={isMobile}
            isOpen={sidebarOpen}
            onToggle={toggleSidebar}
            keyword={keyword}
            onKeywordChange={handleKeywordChange}
            onCreateNew={handleClickNew}
            loading={loading}
            items={items}
            selectedId={selectedId}
            onSelect={handleSelectItem}
            hideSearchList={hideSearchList}
            onReopenList={() => setHideSearchList(false)}
          />
        }
      >
        <ItemsWorkspaceSection
          isMobile={isMobile}
          selectedId={selectedId}
          selectedItem={selectedItem}
          detailLoading={detailLoading}
          categories={categories}
          saving={saving}
          deleting={deleting}
          errors={formErrors}
          message={message}
          onSave={handleSave}
          onDelete={handleDelete}
          onChange={handleItemChange}
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

function ItemsSidebarSection({
  isMobile,
  isOpen,
  onToggle,
  keyword,
  onKeywordChange,
  onCreateNew,
  loading,
  items,
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
      title="アイテム編集"
      searchPlaceholder="名前・カテゴリで検索"
    >
      {!hideSearchList ? (
        <ItemList
          items={items}
          loading={loading}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <button type="button" onClick={onReopenList} style={styles.reopenButton}>
          候補を再表示
        </button>
      )}
    </EditorSidebar>
  );
}

function ItemsWorkspaceSection({
  isMobile,
  selectedId,
  selectedItem,
  detailLoading,
  categories,
  saving,
  deleting,
  errors,
  message,
  onSave,
  onDelete,
  onChange,
}) {
  return (
    <>
      <EditorHeader
        isMobile={isMobile}
        title={selectedId ? `${selectedItem.name}を編集中` : "新規アイテム作成"}
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
          <ItemForm
            item={selectedItem}
            categories={categories}
            errors={errors}
            message={message}
            onChange={onChange}
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