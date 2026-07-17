"use client";

import styles from "./RoomNotifications.module.css";
import { RainbowNoticeCard, RainbowScheduleList } from "./RoomParts";

export default function RoomNotifications({ controller: c }) {
  const {
    t,
    toastReports,
    redTimelineReports,
    importantReports,
    now,
    dismissToast,
    requestUndoReport,
    getMapLabel,
    isScheduleDrawerOpen,
    setIsScheduleDrawerOpen,
    handleDrawerTouchStart,
    handleDrawerTouchMove,
    handleDrawerTouchEnd,
  } = c;

  return (
    <>
      {toastReports.length > 0 && (
        <div className={styles.toastStack}>
          {toastReports.map((report) => (
            <RainbowNoticeCard
              key={report.id}
              report={report}
              now={now}
              variant="toast"
              actionLabel="×"
              onAction={() => dismissToast(report.id)}
              onSwipeRight={() => dismissToast(report.id)}
              getMapLabel={getMapLabel}
              t={t}
            />
          ))}
        </div>
      )}

      {redTimelineReports.length > 0 && (
        <button type="button" className={styles.schedulePeek} onClick={() => setIsScheduleDrawerOpen(true)}>
          <span>{t("toast.schedule")}</span>
          <strong>{redTimelineReports.length}</strong>
        </button>
      )}

      {isScheduleDrawerOpen && (
        <div className={styles.scheduleDrawerBackdrop} onClick={() => setIsScheduleDrawerOpen(false)}>
          <section
            className={styles.scheduleDrawer}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
          >
            <span className={styles.drawerSwipeHint} />
            <div className={styles.drawerHead}>
              <div><p>{t("drawer.kicker")}</p><h2>{t("drawer.title")}</h2></div>
              <button type="button" onClick={() => setIsScheduleDrawerOpen(false)} aria-label={t("drawer.closeLabel")}>×</button>
            </div>
            <RainbowScheduleList reports={redTimelineReports} now={now} onUndo={requestUndoReport} getMapLabel={getMapLabel} t={t} />
          </section>
        </div>
      )}

      <section className={styles.importantPanel}>
        <div className={styles.panelHead}>
          <h2>{t("important.title")}</h2>
          <span>{t("important.caption")}</span>
        </div>
        {importantReports.length === 0 ? (
          <p className={styles.empty}>{t("important.empty")}</p>
        ) : (
          <div className={styles.importantList}>
            {importantReports.map((report) => (
              <RainbowNoticeCard
                key={report.id}
                report={report}
                now={now}
                variant="important"
                actionLabel="×"
                onAction={() => requestUndoReport(report.id)}
                getMapLabel={getMapLabel}
                t={t}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
