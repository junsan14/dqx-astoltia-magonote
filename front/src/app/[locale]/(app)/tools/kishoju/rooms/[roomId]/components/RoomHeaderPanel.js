"use client";

import styles from "./RoomMain.module.css";
import { Spinner } from "./RoomParts";

export default function RoomHeaderPanel({
  t,
  members,
  selectedMemberId,
  setSelectedMemberId,
  busyAction,
  requestDeleteMember,
}) {
  return (
    <>
      <div className={styles.panelHead}>
        <h2>{t("quick.title")}</h2>
        <span>{t("quick.caption")}</span>
      </div>

      {members.length > 0 && (
        <div className={styles.memberTabs}>
          {members.map((member) => {
            const isSelected =
              String(member.id) === String(selectedMemberId);
            const memberBusy = busyAction === `delete-member-${member.id}`;

            return (
              <div
                key={member.id}
                className={`${styles.memberTab} ${
                  isSelected ? styles.memberTabActive : ""
                } ${memberBusy ? styles.isBusy : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!busyAction) {
                    setSelectedMemberId(String(member.id));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !busyAction) {
                    setSelectedMemberId(String(member.id));
                  }
                }}
              >
                <button
                  type="button"
                  className={styles.memberDeleteButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestDeleteMember(member);
                  }}
                  aria-label={t("quick.deleteMemberLabel", {
                    name: member.name,
                  })}
                  disabled={Boolean(busyAction)}
                >
                  {memberBusy ? <Spinner small /> : "×"}
                </button>

                <span className={styles.memberServerBadge}>
                  {member.server_from}〜{member.server_to}
                </span>

                <strong className={styles.memberName}>{member.name}</strong>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
