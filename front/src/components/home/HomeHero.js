"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./HomeHero.module.css";

const DESKTOP_POSITIONS = [
  { top: "8%", left: "5%" },
  { top: "8%", right: "5%" },
  { top: "24%", left: "8%" },
  { top: "24%", right: "8%" },
  { bottom: "24%", left: "7%" },
  { bottom: "24%", right: "7%" },
  { bottom: "8%", left: "18%" },
  { bottom: "8%", right: "18%" },
];

const MOBILE_POSITIONS = [
  { top: "3%", left: "10px" },
  { top: "6%", right: "18px" },
  { top: "12%", left: "34px" },
  { top: "16%", right: "8px" },
  { bottom: "18%", left: "12px" },
  { bottom: "14%", right: "32px" },
  { bottom: "5%", left: "38px" },
  { bottom: "3%", right: "10px" },
];

const SHOW_INTERVAL = 1000;
const MOBILE_BREAKPOINT = 640;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT;
}

function getPositionSlots() {
  return isMobile() ? MOBILE_POSITIONS : DESKTOP_POSITIONS;
}

function openHeaderMenu() {
  window.dispatchEvent(new CustomEvent("open-header-menu"));
}

export default function HomeHero() {
  const t = useTranslations("HomePage.hero");
  const [visibleQuestions, setVisibleQuestions] = useState([]);

  const questions = [
    t("questions.orbDrop"),
    t("questions.slimeMap"),
    t("questions.gigantesArea"),
    t("questions.materialDrop"),
    t("questions.craftCost"),
    t("questions.profit"),
    t("questions.accessoryWhere"),
    t("questions.inheritance"),
  ];

  useEffect(() => {
    const timers = [];
    const shuffledQuestions = shuffleArray(questions);
    const shuffledPositions = shuffleArray(getPositionSlots());

    shuffledQuestions.forEach((text, index) => {
      const timer = window.setTimeout(() => {
        const newQuestion = {
          id: `${index}-${Date.now()}`,
          text,
          position: shuffledPositions[index % shuffledPositions.length],
        };

        setVisibleQuestions((prev) => [...prev, newQuestion]);
      }, index * SHOW_INTERVAL);

      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <section className={styles.hero}>
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.bubbles} aria-hidden="true">
        {visibleQuestions.map((question) => (
          <div
            key={question.id}
            className={styles.bubble}
            style={question.position}
          >
            {question.text}
          </div>
        ))}
      </div>

      <div className={styles.content}>
        <p className={styles.label}>{t("label")}</p>

        <h1 className={styles.title}>
          <span className={styles.titleSmall}>{t("titleLine1")}</span>
          <span className={styles.titleMain}>{t("titleHighlight")}</span>
          <span className={styles.titleSmall}>{t("titleLine2")}</span>
        </h1>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={openHeaderMenu}
          >
            {t("button")}
          </button>
        </div>
      </div>
    </section>
  );
}