"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./RoomMain.module.css";
import RoomHeaderPanel from "./RoomHeaderPanel";
import RoomMapPanel from "./RoomMapPanel";
import RoomReportPanel from "./RoomReportPanel";
import { QuickCell } from "./RoomParts";

const SELECTED_MAPS_STORAGE_KEY = "kishoju_selected_maps";
const MOBILE_TAB_LONG_PRESS_MS = 420;

export default function RoomMain({ controller: c }) {
  const {
    t,
    quickReportRef,
    isTutorialTarget,
    members,
    selectedMemberId,
    setSelectedMemberId,
    busyAction,
    requestDeleteMember,
    selectedMember,
    selectedMaps,
    setSelectedMaps,
    canSwitchMobileMap,
    activeMobileMap,
    setActiveMobileMap,
    setIsMobileDragging,
    setMobileDragOffset,
    getMapLabel,
    serverRows,
    latestReportMap,
    now,
    submitQuickReport,
    requestUndoReport,
    mobileCardViewportRef,
    handleMobileMapTouchStart,
    handleMobileMapTouchMove,
    handleMobileMapTouchEnd,
    mobileCardTrackStyle,
    activeReports,
  } = c;

  /*
   * selectedMapsは選択されている探査場所、
   * orderedMapsはユーザーが指定した表示順です。
   *
   * RoomParts.js側のselectedMapsを直接変更しなくても、
   * このコンポーネント内の表示順だけを管理できます。
   */
  const [orderedMaps, setOrderedMaps] = useState(selectedMaps);

  const [draggingMap, setDraggingMap] = useState("");
  const [dragOverMap, setDragOverMap] = useState("");

  const [isMobileTabReordering, setIsMobileTabReordering] = useState(false);
  const [mobileDraggingMap, setMobileDraggingMap] = useState("");
  const [mobileDragOverMap, setMobileDragOverMap] = useState("");

  const mobileTabLongPressTimerRef = useRef(null);
  const mobileTabPointerStartRef = useRef({ x: 0, y: 0 });
  const mobileTabLongPressTriggeredRef = useRef(false);
  const mobileDraggingMapRef = useRef("");
  const mobileLastTargetMapRef = useRef("");

  const savedOrderRef = useRef([]);
  const hasLoadedSavedOrderRef = useRef(false);

  /*
   * localStorageからユーザーの並び順を読み込みます。
   *
   * selectedMapsには現在選択中の場所だけが入るため、
   * 保存済みの順番から未選択の場所を除外します。
   */
  useEffect(() => {
    if (hasLoadedSavedOrderRef.current) return;

    hasLoadedSavedOrderRef.current = true;

    let savedOrder = [];

    try {
      const savedValue = localStorage.getItem(SELECTED_MAPS_STORAGE_KEY);
      const parsedValue = savedValue ? JSON.parse(savedValue) : [];

      if (Array.isArray(parsedValue)) {
        savedOrder = parsedValue.filter(
          (mapName, index) =>
            typeof mapName === "string" &&
            parsedValue.indexOf(mapName) === index
        );
      }
    } catch {
      savedOrder = [];
    }

    savedOrderRef.current = savedOrder;

    setOrderedMaps(() => {
      const mapsFromSavedOrder = savedOrder.filter((mapName) =>
        selectedMaps.includes(mapName)
      );

      const newlySelectedMaps = selectedMaps.filter(
        (mapName) => !mapsFromSavedOrder.includes(mapName)
      );

      const nextMaps = [...mapsFromSavedOrder, ...newlySelectedMaps];

      queueMicrotask(() => syncControllerMapOrder(nextMaps));

      return nextMaps;
    });
  }, [selectedMaps]);

  /*
   * 探査場所の選択・解除が行われた際に、
   * 現在のユーザー指定順を維持しながらorderedMapsを更新します。
   */
  useEffect(() => {
    if (!hasLoadedSavedOrderRef.current) return;

    setOrderedMaps((currentMaps) => {
      /*
       * 選択解除された場所を取り除きます。
       */
      const remainingMaps = currentMaps.filter((mapName) =>
        selectedMaps.includes(mapName)
      );

      /*
       * 新しく選択された場所を最後に追加します。
       */
      const addedMaps = selectedMaps.filter(
        (mapName) => !remainingMaps.includes(mapName)
      );

      const nextMaps = [...remainingMaps, ...addedMaps];

      savedOrderRef.current = nextMaps;

      try {
        localStorage.setItem(
          SELECTED_MAPS_STORAGE_KEY,
          JSON.stringify(nextMaps)
        );
      } catch {
        // localStorageを利用できない環境では何もしない
      }

      queueMicrotask(() => syncControllerMapOrder(nextMaps));

      return nextMaps;
    });
  }, [selectedMaps]);

  /*
   * 並び順をlocalStorageへ保存します。
   */
  const saveMapOrder = (nextMaps) => {
    savedOrderRef.current = nextMaps;

    try {
      localStorage.setItem(
        SELECTED_MAPS_STORAGE_KEY,
        JSON.stringify(nextMaps)
      );
    } catch {
      // localStorageを利用できない環境では何もしない
    }
  };


  /*
   * 表示順とコントローラー側のselectedMapsを同じ順番に保ちます。
   *
   * SPのスライド位置・スワイプ判定はRoomParts.jsのselectedMapsを
   * 基準に計算されるため、ここがずれると並び替え後のタブ切り替えで
   * 別の場所が表示されます。
   */
  const syncControllerMapOrder = (nextMaps) => {
    if (typeof setSelectedMaps !== "function") return;

    setSelectedMaps((currentMaps) => {
      const isSameOrder =
        currentMaps.length === nextMaps.length &&
        currentMaps.every((mapName, index) => mapName === nextMaps[index]);

      return isSameOrder ? currentMaps : nextMaps;
    });
  };

  /*
   * 指定した探査場所を別の探査場所の位置へ移動します。
   */
  const reorderMap = (sourceMap, targetMap) => {
    if (!sourceMap || !targetMap) return;
    if (sourceMap === targetMap) return;

    setOrderedMaps((currentMaps) => {
      const sourceIndex = currentMaps.indexOf(sourceMap);
      const targetIndex = currentMaps.indexOf(targetMap);

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentMaps;
      }

      const nextMaps = [...currentMaps];
      const [removedMap] = nextMaps.splice(sourceIndex, 1);

      nextMaps.splice(targetIndex, 0, removedMap);

      saveMapOrder(nextMaps);
      queueMicrotask(() => syncControllerMapOrder(nextMaps));

      return nextMaps;
    });
  };

  const switchMobileMapByDirection = (direction) => {
    if (orderedMaps.length === 0) return;

    const currentIndex = orderedMaps.indexOf(activeMobileMap);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (safeIndex + direction + orderedMaps.length) % orderedMaps.length;

    setIsMobileDragging(false);
    setMobileDragOffset(0);
    setActiveMobileMap(orderedMaps[nextIndex]);
  };

  const clearMobileTabLongPressTimer = () => {
    if (!mobileTabLongPressTimerRef.current) return;

    clearTimeout(mobileTabLongPressTimerRef.current);
    mobileTabLongPressTimerRef.current = null;
  };

  const finishMobileTabReorder = () => {
    clearMobileTabLongPressTimer();
    mobileDraggingMapRef.current = "";
    mobileLastTargetMapRef.current = "";
    setIsMobileTabReordering(false);
    setMobileDraggingMap("");
    setMobileDragOverMap("");
  };

  const handleMobileTabPointerDown = (event, targetMap) => {
    if (event.pointerType === "mouse") return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearMobileTabLongPressTimer();

    mobileTabPointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    mobileTabLongPressTriggeredRef.current = false;
    mobileDraggingMapRef.current = targetMap;
    mobileLastTargetMapRef.current = targetMap;

    mobileTabLongPressTimerRef.current = setTimeout(() => {
      mobileTabLongPressTriggeredRef.current = true;
      setIsMobileTabReordering(true);
      setMobileDraggingMap(targetMap);
      setMobileDragOverMap(targetMap);

      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }, MOBILE_TAB_LONG_PRESS_MS);
  };

  const handleMobileTabPointerMove = (event) => {
    const startPoint = mobileTabPointerStartRef.current;
    const movedX = Math.abs(event.clientX - startPoint.x);
    const movedY = Math.abs(event.clientY - startPoint.y);

    if (!mobileTabLongPressTriggeredRef.current) {
      if (movedX > 10 || movedY > 10) {
        clearMobileTabLongPressTimer();
      }
      return;
    }

    event.preventDefault();

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const tabElement = element?.closest?.("[data-mobile-map-tab]");
    const targetMap = tabElement?.dataset?.mobileMapTab;
    const sourceMap = mobileDraggingMapRef.current;

    if (!sourceMap || !targetMap || targetMap === sourceMap) return;
    if (mobileLastTargetMapRef.current === targetMap) return;

    mobileLastTargetMapRef.current = targetMap;
    setMobileDragOverMap(targetMap);
    reorderMap(sourceMap, targetMap);
  };

  const handleMobileTabPointerUp = (event, targetMap) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    clearMobileTabLongPressTimer();

    if (mobileTabLongPressTriggeredRef.current) {
      event.preventDefault();
      finishMobileTabReorder();
      mobileTabLongPressTriggeredRef.current = false;
      return;
    }

    mobileDraggingMapRef.current = "";
    mobileLastTargetMapRef.current = "";
    setIsMobileDragging(false);
    setMobileDragOffset(0);
    setActiveMobileMap(targetMap);
  };

  const handleMobileTabPointerCancel = () => {
    mobileTabLongPressTriggeredRef.current = false;
    finishMobileTabReorder();
  };

  useEffect(() => {
    return () => clearMobileTabLongPressTimer();
  }, []);

  /*
   * SP用です。
   *
   * 現在表示中の探査場所を左右へ1つ移動します。
   */
  const moveMapByDirection = (targetMap, direction) => {
    if (!targetMap) return;

    setOrderedMaps((currentMaps) => {
      const currentIndex = currentMaps.indexOf(targetMap);

      if (currentIndex < 0) {
        return currentMaps;
      }

      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= currentMaps.length) {
        return currentMaps;
      }

      const nextMaps = [...currentMaps];

      [nextMaps[currentIndex], nextMaps[nextIndex]] = [
        nextMaps[nextIndex],
        nextMaps[currentIndex],
      ];

      saveMapOrder(nextMaps);
      queueMicrotask(() => syncControllerMapOrder(nextMaps));

      return nextMaps;
    });
  };

  /*
   * PC：ドラッグ開始
   */
  const handleMapDragStart = (event, targetMap) => {
    setDraggingMap(targetMap);
    setDragOverMap("");

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", targetMap);
  };

  /*
   * PC：別の列へ入ったとき
   */
  const handleMapDragEnter = (event, targetMap) => {
    event.preventDefault();

    if (!draggingMap) return;
    if (draggingMap === targetMap) return;

    setDragOverMap(targetMap);
  };

  /*
   * PC：ドロップを許可
   */
  const handleMapDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  /*
   * PC：ドロップ
   */
  const handleMapDrop = (event, targetMap) => {
    event.preventDefault();

    const sourceMap =
      draggingMap || event.dataTransfer.getData("text/plain");

    reorderMap(sourceMap, targetMap);

    setDraggingMap("");
    setDragOverMap("");
  };

  /*
   * PC：ドラッグ終了
   */
  const handleMapDragEnd = () => {
    setDraggingMap("");
    setDragOverMap("");
  };

  const activeOrderedMapIndex = orderedMaps.findIndex(
    (mapName) => mapName === activeMobileMap
  );

  const canMoveActiveMapLeft = activeOrderedMapIndex > 0;

  const canMoveActiveMapRight =
    activeOrderedMapIndex >= 0 &&
    activeOrderedMapIndex < orderedMaps.length - 1;

  const renderCell = (targetServer, targetMap) => {
    const latest = latestReportMap.get(
      `${targetServer}-${targetMap}`
    );

    const busyColor =
      busyAction === `report-${targetServer}-${targetMap}-黄`
        ? "黄"
        : busyAction === `report-${targetServer}-${targetMap}-赤`
          ? "赤"
          : "";

    const isDeleting =
      latest &&
      busyAction === `delete-report-${latest.id}`;

    return (
      <QuickCell
        latest={latest}
        now={now}
        busyColor={busyColor}
        isDeleting={isDeleting}
        onClick={(color) =>
          submitQuickReport({
            targetServer,
            targetMap,
            targetColor: color,
          })
        }
        onUndo={requestUndoReport}
        t={t}
      />
    );
  };

  return (
    <section className={styles.main}>
      <div
        ref={quickReportRef}
        className={`${styles.card} ${
          isTutorialTarget("quick") ? styles.tutorialTarget : ""
        }`}
      >
        <RoomHeaderPanel
          t={t}
          members={members}
          selectedMemberId={selectedMemberId}
          setSelectedMemberId={setSelectedMemberId}
          busyAction={busyAction}
          requestDeleteMember={requestDeleteMember}
        />

        <RoomMapPanel
          t={t}
          selectedMember={selectedMember}
          orderedMaps={orderedMaps}
          canSwitchMobileMap={canSwitchMobileMap}
          activeMobileMap={activeMobileMap}
          setActiveMobileMap={setActiveMobileMap}
          setIsMobileDragging={setIsMobileDragging}
          setMobileDragOffset={setMobileDragOffset}
          getMapLabel={getMapLabel}
          switchMobileMapByDirection={switchMobileMapByDirection}
          isMobileTabReordering={isMobileTabReordering}
          mobileDraggingMap={mobileDraggingMap}
          mobileDragOverMap={mobileDragOverMap}
          handleMobileTabPointerDown={handleMobileTabPointerDown}
          handleMobileTabPointerMove={handleMobileTabPointerMove}
          handleMobileTabPointerUp={handleMobileTabPointerUp}
          handleMobileTabPointerCancel={handleMobileTabPointerCancel}
          moveMapByDirection={moveMapByDirection}
          canMoveActiveMapLeft={canMoveActiveMapLeft}
          canMoveActiveMapRight={canMoveActiveMapRight}
          draggingMap={draggingMap}
          dragOverMap={dragOverMap}
          handleMapDragStart={handleMapDragStart}
          handleMapDragEnter={handleMapDragEnter}
          handleMapDragOver={handleMapDragOver}
          handleMapDrop={handleMapDrop}
          handleMapDragEnd={handleMapDragEnd}
          serverRows={serverRows}
          renderCell={renderCell}
          mobileCardViewportRef={mobileCardViewportRef}
          handleMobileMapTouchStart={handleMobileMapTouchStart}
          handleMobileMapTouchMove={handleMobileMapTouchMove}
          handleMobileMapTouchEnd={handleMobileMapTouchEnd}
          mobileCardTrackStyle={mobileCardTrackStyle}
        />
      </div>

      <RoomReportPanel
        t={t}
        activeReports={activeReports}
        now={now}
        busyAction={busyAction}
        requestUndoReport={requestUndoReport}
        getMapLabel={getMapLabel}
      />
    </section>
  );
}
