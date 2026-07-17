"use client";

import styles from "./RoomSidebar.module.css";
import { RainbowScheduleList, Spinner } from "./RoomParts";

export default function RoomSidebar({ controller: c }) {
  const {
    t,
    mapSelectorRef,
    registerRef,
    isTutorialTarget,
    openPanels,
    togglePanel,
    mapOptions,
    selectedMaps,
    toggleMap,
    playerName,
    setPlayerName,
    serverFrom,
    setServerFrom,
    serverTo,
    setServerTo,
    joinRoom,
    busyAction,
    redTimelineReports,
    now,
    requestUndoReport,
    getMapLabel,
  } = c;

  return (
    <aside className={styles.side}>
      <div
        ref={mapSelectorRef}
        className={`${styles.card} ${styles.accordionCard} ${
          isTutorialTarget("maps") ? styles.tutorialTarget : ""
        }`}
      >
        <button type="button" className={styles.accordionHead} onClick={() => togglePanel("maps")}>
          <span>{t("side.mapsTitle")}</span>
          <strong>{openPanels.maps ? "−" : "+"}</strong>
        </button>
        <div className={`${styles.accordionBody} ${openPanels.maps ? styles.accordionOpen : ""}`}>
          <div className={styles.mapCheckList}>
            {mapOptions.map((map) => (
              <button
                key={map.value}
                type="button"
                className={`${styles.mapCheckButton} ${selectedMaps.includes(map.value) ? styles.mapSelected : ""}`}
                onClick={() => toggleMap(map.value)}
              >
                {map.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={registerRef}
        className={`${styles.card} ${styles.accordionCard} ${
          isTutorialTarget("register") ? styles.tutorialTarget : ""
        }`}
      >
        <button type="button" className={styles.accordionHead} onClick={() => togglePanel("register")}>
          <span>{t("side.registerTitle")}</span>
          <strong>{openPanels.register ? "−" : "+"}</strong>
        </button>
        <div className={`${styles.accordionBody} ${openPanels.register ? styles.accordionOpen : ""}`}>
          <div className={styles.formGrid}>
            <label>
              {t("form.name")}
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder={t("form.namePlaceholder")} />
            </label>
            <div className={styles.twoCols}>
              <label>
                {t("form.serverFrom")}
                <input type="number" min="1" max="40" value={serverFrom} onChange={(e) => setServerFrom(e.target.value)} placeholder="1" />
              </label>
              <label>
                {t("form.serverTo")}
                <input type="number" min="1" max="40" value={serverTo} onChange={(e) => setServerTo(e.target.value)} placeholder="10" />
              </label>
            </div>
            <button type="button" onClick={joinRoom} disabled={busyAction === "join-room"}>
              {busyAction === "join-room" ? <><Spinner />{t("form.submitting")}</> : t("form.submit")}
            </button>
          </div>
        </div>
      </div>

      <div className={`${styles.card} ${styles.sideScheduleCard}`}>
        <div className={styles.panelHead}>
          <h2>{t("side.scheduleTitle")}</h2>
          <span>{t("side.scheduleCaption")}</span>
        </div>
        <RainbowScheduleList
          reports={redTimelineReports}
          now={now}
          onUndo={requestUndoReport}
          getMapLabel={getMapLabel}
          t={t}
        />
      </div>
    </aside>
  );
}
