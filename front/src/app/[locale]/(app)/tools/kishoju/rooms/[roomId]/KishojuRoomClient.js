"use client";

import PageHeroTitle from "@/components/PageHeroTitle";
import styles from "./KishojuRoom.module.css";
import KishojuRoomTutorial, { TUTORIAL_STEPS } from "./KishojuRoomTutorial";
import RoomMain from "./components/RoomMain";
import RoomNotifications from "./components/RoomNotifications";
import RoomSidebar from "./components/RoomSidebar";
import {
  ConfirmModal,
  useKishojuRoomController,
} from "./components/RoomParts";

export default function KishojuRoomClient({ roomId }) {
  const controller = useKishojuRoomController({ roomId });
  const {
    t,
    room,
    message,
    error,
    isScheduleDrawerOpen,
    confirmAction,
    busyAction,
    closeConfirm,
    runConfirmedAction,
    tutorialPromptOpen,
    tutorialActive,
    tutorialStep,
    tutorialStepIndex,
    startTutorial,
    skipTutorial,
    goNextTutorialStep,
    goPrevTutorialStep,
    finishTutorial,
    copyUrl,
  } = controller;

  return (
    <main
      className={`${styles.page} ${
        isScheduleDrawerOpen ? styles.scheduleDrawerIsOpen : ""
      }`}
    >
      <ConfirmModal
        action={confirmAction}
        isBusy={Boolean(confirmAction && busyAction)}
        onCancel={closeConfirm}
        onConfirm={runConfirmedAction}
        t={t}
      />

      <KishojuRoomTutorial
        isPromptOpen={tutorialPromptOpen}
        isActive={tutorialActive}
        step={tutorialStep}
        stepIndex={tutorialStepIndex}
        totalSteps={TUTORIAL_STEPS.length}
        onStart={startTutorial}
        onSkip={skipTutorial}
        onNext={goNextTutorialStep}
        onPrev={goPrevTutorialStep}
        onFinish={finishTutorial}
      />

      <RoomNotifications controller={controller} />

      <section className={styles.header}>
        <div className={styles.headerTitle}>
          <PageHeroTitle
            kicker={t("header.kicker")}
            title={room?.name || t("header.defaultTitle")}
          />
        </div>

        <div className={styles.headerActions}>
          <p className={styles.roomId}>{t("header.roomId", { roomId })}</p>
          <button type="button" className={styles.copyButton} onClick={copyUrl}>
            {t("header.copyUrl")}
          </button>
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}
      {message && <p className={styles.message}>{message}</p>}

      <section className={styles.grid}>
        <RoomSidebar controller={controller} />
        <RoomMain controller={controller} />
      </section>
    </main>
  );
}
