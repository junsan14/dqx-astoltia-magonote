"use client";

import styles from "./RoomMain.module.css";
import {
  Spinner,
  formatTime,
  getColorClass,
  getGaugeLabel,
  getRainbowInfo,
} from "./RoomParts";

export default function RoomReportPanel({
  t,
  activeReports,
  now,
  busyAction,
  requestUndoReport,
  getMapLabel,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.panelHead}>
        <h2>{t("log.title")}</h2>
        <span>{t("log.caption")}</span>
      </div>

      <div className={styles.reportList}>
        {activeReports.length === 0 ? (
          <p className={styles.empty}>{t("log.empty")}</p>
        ) : (
          activeReports.map((report) => {
            const info = getRainbowInfo(report, now);
            const isDeleting =
              busyAction === `delete-report-${report.id}`;
            const isRed = report.gauge_color === "赤";

            return (
              <article key={report.id} className={styles.reportItem}>
                <button
                  type="button"
                  className={styles.reportUndoButton}
                  onClick={() => requestUndoReport(report.id)}
                  aria-label={t("log.undoLabel")}
                  disabled={Boolean(busyAction) || report.isTemporary}
                >
                  {isDeleting ? <Spinner small /> : "×"}
                </button>

                <div className={styles.reportMain}>
                  <p className={styles.reportTopLine}>
                    <span className={styles.reportServerBadge}>
                      {report.server_no}
                    </span>

                    <strong>{getMapLabel(report.map_name)}</strong>

                    <span
                      className={`${styles.reportColorBadge} ${getColorClass(
                        report.gauge_color,
                        styles
                      )}`}
                    >
                      {getGaugeLabel(report.gauge_color, t)}
                    </span>
                  </p>

                  <p className={styles.reportBottomLine}>
                    <span>
                      {t("log.registeredAt", {
                        name: report.reported_by,
                        time: formatTime(report.created_at),
                      })}
                    </span>

                    {isRed && (
                      <span>
                        {t("log.remaining", {
                          minutes: info.remainingMinutes,
                        })}
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
  );
}
