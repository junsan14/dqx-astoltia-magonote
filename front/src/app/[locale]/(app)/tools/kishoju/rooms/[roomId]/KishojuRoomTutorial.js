"use client";

import { useTranslations } from "next-intl";
import styles from "./KishojuRoom.module.css";

export const TUTORIAL_STORAGE_KEY = "kishoju_room_tutorial_status";

export const TUTORIAL_STEPS = [
  {
    target: "maps",
    titleKey: "steps.maps.title",
    descriptionKey: "steps.maps.description",
  },
  {
    target: "register",
    titleKey: "steps.register.title",
    descriptionKey: "steps.register.description",
  },
  {
    target: "quick",
    titleKey: "steps.quick.title",
    descriptionKey: "steps.quick.description",
  },
];

export default function KishojuRoomTutorial({
  isPromptOpen,
  isActive,
  step,
  stepIndex,
  totalSteps,
  onStart,
  onSkip,
  onNext,
  onPrev,
  onFinish,
}) {
  const t = useTranslations("KishojuRoom.tutorial");

  if (isPromptOpen) {
    return (
      <div className={styles.tutorialModalBackdrop}>
        <section className={styles.tutorialStartModal}>
          <span className={styles.tutorialBadge}>
            {t("badge")}
          </span>

          <h2>{t("promptTitle")}</h2>

          <p>{t("promptText")}</p>

          <div className={styles.tutorialStartActions}>
            <button
              type="button"
              onClick={onSkip}
              className={styles.tutorialGhostButton}
            >
              {t("skip")}
            </button>

            <button
              type="button"
              onClick={onStart}
              className={styles.tutorialPrimaryButton}
            >
              {t("start")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!isActive || !step) return null;

  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <>
      <div className={styles.tutorialShade} />

      <section className={styles.tutorialGuidePanel}>
        <div className={styles.tutorialGuideHead}>
          <span>
            {t("stepCounter", {
              current: stepIndex + 1,
              total: totalSteps,
            })}
          </span>

          <button
            type="button"
            onClick={onFinish}
            aria-label={t("closeAria")}
          >
            ×
          </button>
        </div>

        <h2>{t(step.titleKey)}</h2>

        <p>{t(step.descriptionKey)}</p>

        <div className={styles.tutorialDots} aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, index) => (
            <span
              key={index}
              className={index === stepIndex ? styles.tutorialDotActive : ""}
            />
          ))}
        </div>

        <div className={styles.tutorialGuideActions}>
          <button
            type="button"
            onClick={onPrev}
            className={styles.tutorialGhostButton}
            disabled={stepIndex === 0}
          >
            {t("prev")}
          </button>

          <button
            type="button"
            onClick={onNext}
            className={styles.tutorialPrimaryButton}
          >
            {isLastStep ? t("finish") : t("next")}
          </button>
        </div>
      </section>
    </>
  );
}