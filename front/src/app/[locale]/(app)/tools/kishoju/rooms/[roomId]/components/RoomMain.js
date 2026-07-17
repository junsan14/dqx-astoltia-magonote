"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./RoomMain.module.css";
import RoomHeaderPanel from "./RoomHeaderPanel";
import RoomMapPanel from "./RoomMapPanel";
import RoomReportPanel from "./RoomReportPanel";
import { QuickCell } from "./RoomParts";

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
   * selectedMapsの配列順を、そのままクイック登録の表示順として使います。
   * 並び替え後はcontroller側のselectedMapsを更新し、
   * RoomParts.js側でlocalStorageへ保存します。
   */
  const orderedMaps = selectedMaps;

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

  /*
   * 指定した探査場所を別の探査場所の位置へ移動します。
   */
  const reorderMap = (sourceMap, targetMap) => {
    if (!sourceMap || !targetMap) return;
    if (sourceMap === targetMap) return;
    if (typeof setSelectedMaps !== "function") return;

    setSelectedMaps((currentMaps) => {
      const sourceIndex = currentMaps.indexOf(sourceMap);
      const targetIndex = currentMaps.indexOf(targetMap);

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentMaps;
      }

      const nextMaps = [...currentMaps];
      const [removedMap] = nextMaps.splice(sourceIndex, 1);

      nextMaps.splice(targetIndex, 0, removedMap);

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
    if (typeof setSelectedMaps !== "function") return;

    setSelectedMaps((currentMaps) => {
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
