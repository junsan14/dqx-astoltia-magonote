"use client";

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
  canSwitchMobileMap,
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
  mobileCardViewportRef,
  handleMobileMapTouchStart,
  handleMobileMapTouchMove,
  handleMobileMapTouchEnd,
  mobileCardTrackStyle,
}) {
  if (!selectedMember) {
    return <p className={styles.empty}>{t("quick.noMember")}</p>;
  }

  if (orderedMaps.length === 0) {
    return <p className={styles.empty}>{t("quick.noMap")}</p>;
  }

  return (
    <>
      {canSwitchMobileMap && (
        <>
          <div className={styles.mobileSwipeHint}>
            <FiSmartphone />
            <span>6つの場所をタップで切り替え・長押しで並び替え</span>
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
                    activeMobileMap === targetMap
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
                  aria-label={`${getMapLabel(targetMap)}を表示。長押しで並べ替え`}
                >
                  <span className={styles.mobileMapTabLabel}>
                    {getMapLabel(targetMap)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.mobileMapNavigation}>
            <button
              type="button"
              className={styles.mobileMapNavigationButton}
              onClick={() => switchMobileMapByDirection(-1)}
              aria-label="前の探査場所を表示"
            >
              <FiChevronLeft />
            </button>

            <div className={styles.mobileMapNavigationCurrent}>
              <strong>{getMapLabel(activeMobileMap)}</strong>
              <span>タブ長押しで並び替え</span>
            </div>

            <button
              type="button"
              className={styles.mobileMapNavigationButton}
              onClick={() => switchMobileMapByDirection(1)}
              aria-label="次の探査場所を表示"
            >
              <FiChevronRight />
            </button>
          </div>
        </>
      )}

      <div className={styles.desktopQuickTableWrap}>
        <div className={styles.quickTableWrap}>
          <table className={styles.quickTable}>
            <thead>
              <tr>
                <th>{t("quick.server")}</th>

                {orderedMaps.map((targetMap) => {
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
                  {orderedMaps.map((targetMap) => (
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
        ref={mobileCardViewportRef}
        className={styles.mobileMapCardViewport}
        onTouchStart={handleMobileMapTouchStart}
        onTouchMove={handleMobileMapTouchMove}
        onTouchEnd={handleMobileMapTouchEnd}
      >
        <div
          className={styles.mobileMapCardTrack}
          style={mobileCardTrackStyle}
        >
          {orderedMaps.map((targetMap) => (
            <div
              key={targetMap}
              data-mobile-map-slide
              className={`${styles.mobileMapCardSlide} ${
                activeMobileMap === targetMap
                  ? styles.mobileMapCardSlideActive
                  : ""
              }`}
            >
              <div className={styles.quickTableWrap}>
                <table className={styles.quickTable}>
                  <thead>
                    <tr>
                      <th>{t("quick.server")}</th>
                      <th>{getMapLabel(targetMap)}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {serverRows.map((targetServer) => (
                      <tr key={`${targetMap}-${targetServer}`}>
                        <th>{targetServer}</th>
                        <td>{renderCell(targetServer, targetMap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
