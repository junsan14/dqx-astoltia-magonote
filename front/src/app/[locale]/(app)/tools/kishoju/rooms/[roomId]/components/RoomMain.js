"use client";

import { useEffect, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiSmartphone,
} from "react-icons/fi";

import styles from "./RoomMain.module.css";

import {
  QuickCell,
  Spinner,
  formatTime,
  getColorClass,
  getGaugeLabel,
  getRainbowInfo,
} from "./RoomParts";

const SELECTED_MAPS_STORAGE_KEY = "kishoju_selected_maps";
const MOBILE_TAB_LONG_PRESS_MS = 420;
const MOBILE_CARD_GAP = 12;

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
  const [mobileCardStepWidth, setMobileCardStepWidth] = useState(0);
  const [mobileSwipeOffset, setMobileSwipeOffset] = useState(0);
  const [isMobileSwiping, setIsMobileSwiping] = useState(false);

  const mobileTabLongPressTimerRef = useRef(null);
  const mobileTabPointerStartRef = useRef({ x: 0, y: 0 });
  const mobileTabLongPressTriggeredRef = useRef(false);
  const mobileSwipeStartRef = useRef({ x: 0, y: 0 });
  const mobileSwipeCurrentRef = useRef({ x: 0, y: 0 });

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

      return [...mapsFromSavedOrder, ...newlySelectedMaps];
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
    setMobileSwipeOffset(0);
    setActiveMobileMap(orderedMaps[nextIndex]);
  };

  const clearMobileTabLongPressTimer = () => {
    if (!mobileTabLongPressTimerRef.current) return;

    clearTimeout(mobileTabLongPressTimerRef.current);
    mobileTabLongPressTimerRef.current = null;
  };

  const finishMobileTabReorder = () => {
    clearMobileTabLongPressTimer();
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

    if (!targetMap || targetMap === mobileDraggingMap) return;

    setMobileDragOverMap(targetMap);
    reorderMap(mobileDraggingMap, targetMap);
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

    setIsMobileDragging(false);
    setMobileDragOffset(0);
    setMobileSwipeOffset(0);
    setActiveMobileMap(targetMap);
  };

  const handleMobileTabPointerCancel = () => {
    mobileTabLongPressTriggeredRef.current = false;
    finishMobileTabReorder();
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

  const safeActiveOrderedMapIndex =
    activeOrderedMapIndex >= 0 ? activeOrderedMapIndex : 0;

  const safeMobileCardStepWidth =
    mobileCardStepWidth ||
    (typeof window !== "undefined"
      ? window.innerWidth * 0.92 + MOBILE_CARD_GAP
      : 360);

  const roomMainMobileCardTrackStyle = {
    transform: `translate3d(${
      safeActiveOrderedMapIndex * -safeMobileCardStepWidth + mobileSwipeOffset
    }px, 0, 0)`,
    transition: isMobileSwiping ? "none" : undefined,
  };

  useEffect(() => {
    const viewport = mobileCardViewportRef.current;
    if (!viewport) return;

    const updateStepWidth = () => {
      const firstSlide = viewport.querySelector("[data-mobile-map-slide]");
      if (!firstSlide) return;

      setMobileCardStepWidth(
        firstSlide.getBoundingClientRect().width + MOBILE_CARD_GAP
      );
    };

    const frameId = requestAnimationFrame(updateStepWidth);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateStepWidth)
        : null;

    observer?.observe(viewport);
    window.addEventListener("resize", updateStepWidth);

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", updateStepWidth);
    };
  }, [mobileCardViewportRef, orderedMaps.length, selectedMemberId]);

  useEffect(() => {
    return () => clearMobileTabLongPressTimer();
  }, []);

  const handleRoomMainMobileTouchStart = (event) => {
    if (!canSwitchMobileMap || isMobileTabReordering) return;

    const touch = event.touches[0];
    mobileSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    mobileSwipeCurrentRef.current = { x: touch.clientX, y: touch.clientY };
    setIsMobileSwiping(true);
    setMobileSwipeOffset(0);
  };

  const handleRoomMainMobileTouchMove = (event) => {
    if (!canSwitchMobileMap || isMobileTabReordering) return;

    const touch = event.touches[0];
    mobileSwipeCurrentRef.current = { x: touch.clientX, y: touch.clientY };

    const diffX = touch.clientX - mobileSwipeStartRef.current.x;
    const diffY = Math.abs(touch.clientY - mobileSwipeStartRef.current.y);

    if (Math.abs(diffX) <= 8 || Math.abs(diffX) <= diffY * 1.15) return;

    const maxOffset = Math.max(80, safeMobileCardStepWidth * 0.86);
    setMobileSwipeOffset(Math.max(Math.min(diffX, maxOffset), -maxOffset));
  };

  const handleRoomMainMobileTouchEnd = () => {
    if (!canSwitchMobileMap || isMobileTabReordering) {
      setIsMobileSwiping(false);
      setMobileSwipeOffset(0);
      return;
    }

    const diffX =
      mobileSwipeCurrentRef.current.x - mobileSwipeStartRef.current.x;
    const diffY = Math.abs(
      mobileSwipeCurrentRef.current.y - mobileSwipeStartRef.current.y
    );
    const threshold = Math.max(55, safeMobileCardStepWidth * 0.22);

    if (Math.abs(diffX) > threshold && Math.abs(diffX) > diffY * 1.25) {
      switchMobileMapByDirection(diffX < 0 ? 1 : -1);
    }

    setIsMobileSwiping(false);
    setMobileSwipeOffset(0);
  };

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
          isTutorialTarget("quick")
            ? styles.tutorialTarget
            : ""
        }`}
      >
        <div className={styles.panelHead}>
          <h2>{t("quick.title")}</h2>
          <span>{t("quick.caption")}</span>
        </div>

        {members.length > 0 && (
          <div className={styles.memberTabs}>
            {members.map((member) => {
              const isSelected =
                String(member.id) ===
                String(selectedMemberId);

              const memberBusy =
                busyAction ===
                `delete-member-${member.id}`;

              return (
                <div
                  key={member.id}
                  className={`${styles.memberTab} ${
                    isSelected
                      ? styles.memberTabActive
                      : ""
                  } ${
                    memberBusy ? styles.isBusy : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!busyAction) {
                      setSelectedMemberId(
                        String(member.id)
                      );
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !busyAction
                    ) {
                      setSelectedMemberId(
                        String(member.id)
                      );
                    }
                  }}
                >
                  <button
                    type="button"
                    className={
                      styles.memberDeleteButton
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDeleteMember(member);
                    }}
                    aria-label={t(
                      "quick.deleteMemberLabel",
                      {
                        name: member.name,
                      }
                    )}
                    disabled={Boolean(busyAction)}
                  >
                    {memberBusy ? (
                      <Spinner small />
                    ) : (
                      "×"
                    )}
                  </button>

                  <span
                    className={
                      styles.memberServerBadge
                    }
                  >
                    {member.server_from}〜
                    {member.server_to}
                  </span>

                  <strong
                    className={styles.memberName}
                  >
                    {member.name}
                  </strong>
                </div>
              );
            })}
          </div>
        )}

        {!selectedMember ? (
          <p className={styles.empty}>
            {t("quick.noMember")}
          </p>
        ) : orderedMaps.length === 0 ? (
          <p className={styles.empty}>
            {t("quick.noMap")}
          </p>
        ) : (
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

            <div
              className={
                styles.desktopQuickTableWrap
              }
            >
              <div
                className={styles.quickTableWrap}
              >
                <table className={styles.quickTable}>
                  <thead>
                    <tr>
                      <th>{t("quick.server")}</th>

                      {orderedMaps.map(
                        (targetMap) => {
                          const isDragging =
                            draggingMap ===
                            targetMap;

                          const isDragOver =
                            dragOverMap ===
                            targetMap;

                          return (
                            <th
                              key={targetMap}
                              className={`${
                                styles.draggableMapHeader
                              } ${
                                isDragging
                                  ? styles.draggingMapHeader
                                  : ""
                              } ${
                                isDragOver
                                  ? styles.dragOverMapHeader
                                  : ""
                              }`}
                              draggable
                              onDragStart={(
                                event
                              ) =>
                                handleMapDragStart(
                                  event,
                                  targetMap
                                )
                              }
                              onDragEnter={(
                                event
                              ) =>
                                handleMapDragEnter(
                                  event,
                                  targetMap
                                )
                              }
                              onDragOver={
                                handleMapDragOver
                              }
                              onDrop={(event) =>
                                handleMapDrop(
                                  event,
                                  targetMap
                                )
                              }
                              onDragEnd={
                                handleMapDragEnd
                              }
                              title="ドラッグして列を並べ替え"
                            >
                              <span
                                className={
                                  styles.mapHeaderContent
                                }
                              >
                                <span
                                  className={
                                    styles.mapDragHandle
                                  }
                                  aria-hidden="true"
                                >
                                  <FiMenu />
                                </span>

                                <span
                                  className={
                                    styles.mapHeaderLabel
                                  }
                                >
                                  {getMapLabel(
                                    targetMap
                                  )}
                                </span>
                              </span>
                            </th>
                          );
                        }
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {serverRows.map(
                      (targetServer) => (
                        <tr key={targetServer}>
                          <th>{targetServer}</th>

                          {orderedMaps.map(
                            (targetMap) => (
                              <td
                                key={`${targetServer}-${targetMap}`}
                              >
                                {renderCell(
                                  targetServer,
                                  targetMap
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              ref={mobileCardViewportRef}
              className={
                styles.mobileMapCardViewport
              }
              onTouchStart={handleRoomMainMobileTouchStart}
              onTouchMove={handleRoomMainMobileTouchMove}
              onTouchEnd={handleRoomMainMobileTouchEnd}
            >
              <div
                className={
                  styles.mobileMapCardTrack
                }
                style={roomMainMobileCardTrackStyle}
              >
                {orderedMaps.map(
                  (targetMap) => (
                    <div
                      key={targetMap}
                      data-mobile-map-slide
                      className={`${
                        styles.mobileMapCardSlide
                      } ${
                        activeMobileMap ===
                        targetMap
                          ? styles.mobileMapCardSlideActive
                          : ""
                      }`}
                    >
                      <div
                        className={
                          styles.quickTableWrap
                        }
                      >
                        <table
                          className={
                            styles.quickTable
                          }
                        >
                          <thead>
                            <tr>
                              <th>
                                {t(
                                  "quick.server"
                                )}
                              </th>

                              <th>
                                {getMapLabel(
                                  targetMap
                                )}
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {serverRows.map(
                              (
                                targetServer
                              ) => (
                                <tr
                                  key={`${targetMap}-${targetServer}`}
                                >
                                  <th>
                                    {
                                      targetServer
                                    }
                                  </th>

                                  <td>
                                    {renderCell(
                                      targetServer,
                                      targetMap
                                    )}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.panelHead}>
          <h2>{t("log.title")}</h2>
          <span>{t("log.caption")}</span>
        </div>

        <div className={styles.reportList}>
          {activeReports.length === 0 ? (
            <p className={styles.empty}>
              {t("log.empty")}
            </p>
          ) : (
            activeReports.map((report) => {
              const info = getRainbowInfo(
                report,
                now
              );

              const isDeleting =
                busyAction ===
                `delete-report-${report.id}`;

              const isRed =
                report.gauge_color === "赤";

              return (
                <article
                  key={report.id}
                  className={styles.reportItem}
                >
                  <button
                    type="button"
                    className={
                      styles.reportUndoButton
                    }
                    onClick={() =>
                      requestUndoReport(report.id)
                    }
                    aria-label={t(
                      "log.undoLabel"
                    )}
                    disabled={
                      Boolean(busyAction) ||
                      report.isTemporary
                    }
                  >
                    {isDeleting ? (
                      <Spinner small />
                    ) : (
                      "×"
                    )}
                  </button>

                  <div
                    className={styles.reportMain}
                  >
                    <p
                      className={
                        styles.reportTopLine
                      }
                    >
                      <span
                        className={
                          styles.reportServerBadge
                        }
                      >
                        {report.server_no}
                      </span>

                      <strong>
                        {getMapLabel(
                          report.map_name
                        )}
                      </strong>

                      <span
                        className={`${
                          styles.reportColorBadge
                        } ${getColorClass(
                          report.gauge_color,
                          styles
                        )}`}
                      >
                        {getGaugeLabel(
                          report.gauge_color,
                          t
                        )}
                      </span>
                    </p>

                    <p
                      className={
                        styles.reportBottomLine
                      }
                    >
                      <span>
                        {t(
                          "log.registeredAt",
                          {
                            name:
                              report.reported_by,
                            time: formatTime(
                              report.created_at
                            ),
                          }
                        )}
                      </span>

                      {isRed && (
                        <span>
                          {t(
                            "log.remaining",
                            {
                              minutes: info.isRainbow
                                ? "虹"
                                : info.remainingMinutes,
                            }
                          )}
                        </span>
                      )}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}