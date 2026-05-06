"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import PageHeroTitle from "@/components/PageHeroTitle";
import {
  createKishojuRoom,
  fetchKishojuRoom,
  normalizeRoomCode,
} from "@/lib/kishoju";
import styles from "./KishojuHome.module.css";

export default function KishojuHomeClient({ locale, initialNotice }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("KishojuHome");

  const [roomName, setRoomName] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");

  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (initialNotice === "room-not-found") {
      setNotice("room-not-found");
    }
  }, [initialNotice]);

  const closeNotice = () => {
    setNotice("");

    if (initialNotice) {
      router.replace(pathname, { scroll: false });
    }
  };

  const createRoom = async () => {
    try {
      setIsCreating(true);
      setCreateError("");
      setNotice("");

      const room = await createKishojuRoom({
        name: roomName || t("defaultRoomName"),
      });

      if (!room.public_id) {
        throw new Error(t("errors.roomIdFailed"));
      }

      router.push(`/${locale}/tools/kishoju/rooms/${room.public_id}`);
    } catch (err) {
      setCreateError(err.message || t("errors.common"));
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    try {
      setIsJoining(true);
      setJoinError("");
      setNotice("");

      const roomId = normalizeRoomCode(accessCode);

      if (!roomId) {
        throw new Error(t("errors.roomCodeRequired"));
      }

      /*
        ここで存在チェックする。
        ルームがなければ catch に入り、ページ遷移せずにポップアップを出す。
      */
      await fetchKishojuRoom(roomId);

      router.push(`/${locale}/tools/kishoju/rooms/${roomId}`);
    } catch (err) {
      setNotice("room-not-found");
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinKeyDown = (e) => {
    if (e.key === "Enter") {
      joinRoom();
    }
  };

  const features = [
    t("hero.features.roomSharing"),
    t("hero.features.serverReports"),
    t("hero.features.redRainbowCheck"),
  ];

  return (
    <main>
      <RoomNotice
        isOpen={notice === "room-not-found"}
        title={t("notice.roomNotFoundTitle")}
        text={t("notice.roomNotFoundText")}
        kicker={t("notice.roomNotFoundKicker")}
        buttonLabel={t("notice.ok")}
        closeLabel={t("notice.close")}
        onClose={closeNotice}
      />

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <PageHeroTitle kicker={t("hero.kicker")} title={t("hero.title")} />

          <p className={styles.lead}>{t("hero.lead")}</p>

          <div className={styles.featureList}>
            {features.map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.actionSection}>
        <div className={styles.sectionHead}>
          <p className={styles.sectionKicker}>{t("section.kicker")}</p>
          <h2 className={styles.sectionTitle}>{t("section.title")}</h2>
          <p className={styles.sectionLead}>{t("section.lead")}</p>
        </div>

        <div className={styles.roomGrid}>
          <div className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.cardNumber}>01</span>
              <div>
                <p className={styles.cardKicker}>{t("create.kicker")}</p>
                <h3 className={styles.cardTitle}>{t("create.title")}</h3>
              </div>
            </div>

            <p className={styles.cardLead}>{t("create.lead")}</p>

            <label className={styles.label}>
              {t("create.roomNameLabel")}
              <input
                className={styles.input}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={t("create.roomNamePlaceholder")}
              />
            </label>

            {createError && <p className={styles.error}>{createError}</p>}

            <button
              type="button"
              className={styles.button}
              onClick={createRoom}
              disabled={isCreating}
            >
              {isCreating ? t("create.loading") : t("create.button")}
            </button>
          </div>

          <div className={`${styles.card} ${styles.joinCard}`}>
            <div className={styles.cardTop}>
              <span className={styles.cardNumber}>02</span>
              <div>
                <p className={styles.cardKicker}>{t("join.kicker")}</p>
                <h3 className={styles.cardTitle}>{t("join.title")}</h3>
              </div>
            </div>

            <p className={styles.cardLead}>{t("join.lead")}</p>

            <label className={styles.label}>
              {t("join.roomCodeLabel")}
              <input
                className={styles.input}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={handleJoinKeyDown}
                placeholder={t("join.roomCodePlaceholder")}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
            </label>

            {joinError && <p className={styles.error}>{joinError}</p>}

            <button
              type="button"
              className={`${styles.button} ${styles.joinButton}`}
              onClick={joinRoom}
              disabled={isJoining}
            >
              {isJoining ? t("join.loading") : t("join.button")}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function RoomNotice({
  isOpen,
  title,
  text,
  kicker,
  buttonLabel,
  closeLabel,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.noticeBackdrop} onClick={onClose}>
      <section
        className={styles.noticeModal}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.noticeCloseButton}
          onClick={onClose}
          aria-label={closeLabel}
        >
          ×
        </button>

        <p className={styles.noticeKicker}>{kicker}</p>
        <h2 className={styles.noticeTitle}>{title}</h2>
        <p className={styles.noticeText}>{text}</p>

        <button
          type="button"
          className={styles.noticeOkButton}
          onClick={onClose}
        >
          {buttonLabel}
        </button>
      </section>
    </div>
  );
}