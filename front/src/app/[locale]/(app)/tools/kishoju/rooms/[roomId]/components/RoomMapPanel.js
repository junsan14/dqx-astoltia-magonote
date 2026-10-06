"use client";

import { useRef } from "react";

import {
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiSmartphone,
} from "react-icons/fi";

import styles from "./RoomMain.module.css";

export default function RoomMapPanel({
  t,
  selectedMember,
  orderedMaps,
  activeMobileMap,
  getMapLabel,
  switchMobileMapByDirection,
  isMobileTabReordering,
  mobileDraggingMap,
  mobileDragOverMap,
  handleMobileTabPointerDown,
  handleMobileTabPointerMove,
  handleMobileTabPointerUp,
  handleMobileTabPointerCancel,

  draggingMap,
  dragOverMap,
  handleMapDragStart,
  handleMapDragEnter,
  handleMapDragOver,
  handleMapDrop,
  handleMapDragEnd,
  serverRows,
  renderCell,
}) {
  const swipeRef = useRef(null);
  const suppressSwipeClickRef = useRef(false);

  const handleTableTouchStart = (event) => {
    suppressSwipeClickRef.current = false;
    const touch = event.touches[0];
    swipeRef.current = event.touches.length === 1 && orderedMaps.length > 3
      ? { x: touch.clientX, y: touch.clientY, axis: null }
      : null;
  };

  const handleTableTouchMove = (event) => {
    const swipe = swipeRef.current;
    if (!swipe) return;
    if (event.touches.length !== 1) {
      swipeRef.current = null;
      return;
    }
    const dx = event.touches[0].clientX - swipe.x;
    const dy = event.touches[0].clientY - swipe.y;
    if (!swipe.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      swipe.axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? "x" : "y";
    }
    if (swipe.axis === "x") suppressSwipeClickRef.current = true;
  };

  const handleTableTouchEnd = (event) => {
    const swipe = swipeRef.current;
    swipeRef.current = null;
    if (!swipe || event.touches.length || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - swipe.x;
    const dy = event.changedTouches[0].clientY - swipe.y;
    if (swipe.axis !== "y" && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      suppressSwipeClickRef.current = true;
      switchMobileMapByDirection(dx < 0 ? 1 : -1);
    }
  };

  const desktopMaps = orderedMaps.slice(0, 6);
  const pageIndex = Math.floor(Math.max(0, orderedMaps.indexOf(activeMobileMap)) / 3);
  const visibleMaps = orderedMaps.slice(pageIndex * 3, pageIndex * 3 + 3);
  const pageCount = Math.ceil(orderedMaps.length / 3);

  if (!selectedMember) {
    return <p className={styles.empty}>{t("quick.noMember")}</p>;
  }

  if (orderedMaps.length === 0) {
    return <p className={styles.empty}>{t("quick.noMap")}</p>;
  }

  return (
    <>
      {orderedMaps.length > 1 && (
        <>
          <div className={styles.mobileSwipeHint}>
            <FiSmartphone />
            <span>表を左右にスワイプで切り替え・タブ長押しで並び替え</span>
          </div>

          <div
            className={`${styles.mobileMapTabs} ${
              isMobileTabReordering
                ? styles.mobileMapTabsReordering
                : ""
            }`}
          >
            {orderedMaps.map((targetMap) => {
              const isDragging = mobileDraggingMap === targetMap;
              const isDragOver = mobileDragOverMap === targetMap;

              return (
                <button
                  key={targetMap}
                  type="button"
                  data-mobile-map-tab={targetMap}
                  className={`${styles.mobileMapTab} ${
                    visibleMaps.includes(targetMap)
                      ? styles.mobileMapTabActive
                      : ""
                  } ${
                    isDragging ? styles.mobileMapTabDragging : ""
                  } ${
                    isDragOver ? styles.mobileMapTabDropTarget : ""
                  }`}
                  onPointerDown={(event) =>
                    handleMobileTabPointerDown(event, targetMap)
                  }
                  onPointerMove={handleMobileTabPointerMove}
                  onPointerUp={(event) =>
                    handleMobileTabPointerUp(event, targetMap)
                  }
                  onPointerCancel={handleMobileTabPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                  aria-pressed={visibleMaps.includes(targetMap)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleMobileTabPointerUp(event, targetMap);
                    }
                  }}
                  aria-label={`${getMapLabel(targetMap)}を表示。長押しで並べ替え`}
                >
                  <span className={styles.mobileMapTabLabel}>
                    {getMapLabel(targetMap)}
                  </span>
                </button>
              );
            })}
          </div>

          {pageCount > 1 && <div className={styles.mobileMapNavigation}>
            <button
              type="button"
              className={styles.mobileMapNavigationButton}
              onClick={() => switchMobileMapByDirection(-1)}
              aria-label="前の3エリアを表示"
            >
              <FiChevronLeft />
            </button>

            <div className={styles.mobileMapNavigationCurrent}>
              <strong>{pageIndex * 3 + 1}〜{Math.min((pageIndex + 1) * 3, orderedMaps.length)} / {orderedMaps.length}エリア</strong>
              <span>矢印で3エリアずつ切り替え</span>
            </div>

            <button
              type="button"
              className={styles.mobileMapNavigationButton}
              onClick={() => switchMobileMapByDirection(1)}
              aria-label="次の3エリアを表示"
            >
              <FiChevronRight />
            </button>
          </div>}
        </>
      )}

      <div className={styles.desktopQuickTableWrap}>
        <div className={styles.quickTableWrap}>
          <table className={styles.quickTable}>
            <thead>
              <tr>
                <th>{t("quick.server")}</th>

                {desktopMaps.map((targetMap) => {
                  const isDragging = draggingMap === targetMap;
                  const isDragOver = dragOverMap === targetMap;

                  return (
                    <th
                      key={targetMap}
                      className={`${styles.draggableMapHeader} ${
                        isDragging ? styles.draggingMapHeader : ""
                      } ${isDragOver ? styles.dragOverMapHeader : ""}`}
                      draggable
                      onDragStart={(event) =>
                        handleMapDragStart(event, targetMap)
                      }
                      onDragEnter={(event) =>
                        handleMapDragEnter(event, targetMap)
                      }
                      onDragOver={handleMapDragOver}
                      onDrop={(event) => handleMapDrop(event, targetMap)}
                      onDragEnd={handleMapDragEnd}
                      title="ドラッグして列を並べ替え"
                    >
                      <span className={styles.mapHeaderContent}>
                        <span
                          className={styles.mapDragHandle}
                          aria-hidden="true"
                        >
                          <FiMenu />
                        </span>
                        <span className={styles.mapHeaderLabel}>
                          {getMapLabel(targetMap)}
                        </span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {serverRows.map((targetServer) => (
                <tr key={targetServer}>
                  <th>{targetServer}</th>
                  {desktopMaps.map((targetMap) => (
                    <td key={`${targetServer}-${targetMap}`}>
                      {renderCell(targetServer, targetMap)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={styles.mobileThreeMapTable}
        onTouchStart={handleTableTouchStart}
        onTouchMove={handleTableTouchMove}
        onTouchEnd={handleTableTouchEnd}
        onTouchCancel={() => { swipeRef.current = null; }}
        onClickCapture={(event) => {
          if (suppressSwipeClickRef.current && event.detail !== 0) {
            event.preventDefault();
            event.stopPropagation();
            suppressSwipeClickRef.current = false;
          }
        }}
      >
        <div className={styles.quickTableWrap}>
          <table className={styles.quickTable}>
            <thead>
              <tr>
                <th scope="col">{t("quick.server")}</th>
                {visibleMaps.map((targetMap) => (
                  <th scope="col" key={targetMap}>{getMapLabel(targetMap)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {serverRows.map((targetServer) => (
                <tr key={targetServer}>
                  <th scope="row">{targetServer}</th>
                  {visibleMaps.map((targetMap) => (
                    <td key={`${targetServer}-${targetMap}`}>
                      {renderCell(targetServer, targetMap)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
