"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ProgressIntlLink from "@/components/common/route-progress/ProgressIntlLink";
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

const TOOLS = [
  ["craft", "/tools/craft-profit"],
  ["search", "/tools/monster-search"],
  ["map", "/tools/map-monster-browser"],
  ["encyclopedia", "/tools/monster-zukan"],
  ["accessory", "/tools/accessory-guide"],
  ["room", "/tools/kishoju"],
];

export default function HomeHero() {
  const t = useTranslations("HomePage.hero");
  const content = useTranslations("HomePage.discovery");
  const [visibleQuestions, setVisibleQuestions] = useState([]);

  useEffect(() => {
    const timers = [];
    setVisibleQuestions([]);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const questions = [
      "orbDrop", "slimeMap", "gigantesArea", "materialDrop",
      "craftCost", "profit", "accessoryWhere", "inheritance",
    ].map(key => t(`questions.${key}`));
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
  }, [t]);

  return (
    <>
    <section className={styles.hero} aria-labelledby="home-title">
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

        <h1 id="home-title" className={styles.title}>
          <span className={styles.titleSmall}>{t("titleLine1")}</span>
          <span className={styles.titleMain}>{t("titleHighlight")}</span>
          <span className={styles.titleSmall}>{t("titleLine2")}</span>
        </h1>

        <p className={styles.description}>{t("description")}</p>
        <div className={styles.actions}>
          <a className={`${styles.button} ${styles.primary}`} href="#home-tools">
            {t("button")} <span aria-hidden="true">↘</span>
          </a>
          <ProgressIntlLink className={styles.secondaryLink} href="/about">
            {content("aboutLink")} <span aria-hidden="true">→</span>
          </ProgressIntlLink>
        </div>
      </div>
    </section>

    <section id="home-tools" className={styles.discovery} aria-labelledby="home-tools-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>EXPLORE THE TOOLS</p>
        <h2 id="home-tools-title">{content("title")}</h2>
        <p>{content("intro")}</p>
      </div>
      <div className={styles.toolGrid}>
        {TOOLS.map(([key, href], index) => (
          <article key={key} className={styles.toolCard}>
            <span className={styles.toolNumber} aria-hidden="true">0{index + 1}</span>
            <p className={styles.toolUse}>{content(`tools.${key}.use`)}</p>
            <h3>
              <ProgressIntlLink href={href} className={styles.toolLink}>
                {content(`tools.${key}.title`)}
                <span className={styles.toolArrow} aria-hidden="true">↗</span>
              </ProgressIntlLink>
            </h3>
            <p className={styles.toolDescription}>{content(`tools.${key}.description`)}</p>
          </article>
        ))}
      </div>
      <div className={styles.guide}>
        <div>
          <p className={styles.eyebrow}>A LITTLE GUIDANCE</p>
          <h2>{content("guideTitle")}</h2>
        </div>
        <ol className={styles.guideSteps}>
          {["find", "compare", "check"].map(key => (
            <li key={key}>
              <h3>{content(`steps.${key}.title`)}</h3>
              <p>{content(`steps.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.siteNote}>
        <p>{content("note")}</p>
        <ProgressIntlLink href="/announcements">{content("updatesLink")} →</ProgressIntlLink>
      </div>
    </section>
    </>
  );
}