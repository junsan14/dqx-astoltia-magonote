"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./KishojuRoom.module.css";
import PageHeroTitle from "@/components/PageHeroTitle";
import {
  createKishojuReport,
  deleteKishojuMember,
  deleteKishojuReport,
  fetchKishojuReports,
  fetchKishojuRoom,
  joinKishojuRoom,
} from "@/lib/kishoju";
import KishojuRoomTutorial, {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_STEPS,
} from "./KishojuRoomTutorial";
import {
  FiChevronLeft,
  FiChevronRight,
  FiSmartphone,
} from "react-icons/fi";


const MAP_KEYS = [
  {
    key: "geruhena",
    value: "ゲルヘナ幻野",
  },
  {
    key: "gudaderu",
    value: "グラデル台地",
  },
  {
    key: "beruvain",
    value: "ベルヴァインの森",
  },
  {
    key: "bardia",
    value: "バルディア山岳地帯",
  },
  {
    key: "jarim",
    value: "ジャリムバハ砂漠",
  },
  {
    key: "oldNecrodea",
    value: "旧ネクロデア領",
  },
];

const DEFAULT_SELECTED_MAPS = [
  "ゲルヘナ幻野",
  "グラデル台地",
  "ベルヴァインの森",
];

const RAINBOW_AFTER_MINUTES = 60;
const RED_REPORT_KEEP_MINUTES = 90;
const IMPORTANT_BEFORE_MINUTES = 15;
const TOAST_AUTO_DISMISS_MS = 20000;

export default function KishojuRoomClient({ roomId }) {
  const t = useTranslations("KishojuRoom");
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || "ja";
  const mapOptions = useMemo(() => {
    return MAP_KEYS.map((map) => ({
      ...map,
      label: t(`maps.${map.key}`),
    }));
  }, [t]);

  const mapLabelMap = useMemo(() => {
    return new Map(mapOptions.map((map) => [map.value, map.label]));
  }, [mapOptions]);

  const getMapLabel = (mapName) => mapLabelMap.get(mapName) || mapName;

  const [room, setRoom] = useState(null);
  const [reports, setReports] = useState([]);
  const [members, setMembers] = useState([]);

  const [playerName, setPlayerName] = useState("");
  const [serverFrom, setServerFrom] = useState("");
  const [serverTo, setServerTo] = useState("");

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedMaps, setSelectedMaps] = useState(DEFAULT_SELECTED_MAPS);

  const [activeMobileMap, setActiveMobileMap] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  const [openPanels, setOpenPanels] = useState({
    maps: false,
    register: false,
  });

  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);
  const [dismissedToastIds, setDismissedToastIds] = useState([]);

  const [confirmAction, setConfirmAction] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [tutorialPromptOpen, setTutorialPromptOpen] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const deletingReportIdsRef = useRef(new Set());
  const toastTimerMapRef = useRef(new Map());

  const drawerTouchStartXRef = useRef(0);
  const drawerTouchStartYRef = useRef(0);
  const drawerTouchCurrentXRef = useRef(0);
  const drawerTouchCurrentYRef = useRef(0);
  const mapSelectorRef = useRef(null);
  const registerRef = useRef(null);
  const quickReportRef = useRef(null);
  const mobileMapTouchStartXRef = useRef(0);
  const mobileMapTouchStartYRef = useRef(0);
  const mobileMapTouchCurrentXRef = useRef(0);
  const mobileMapTouchCurrentYRef = useRef(0);

  const selectedMember = useMemo(() => {
    return members.find(
      (member) => String(member.id) === String(selectedMemberId)
    );
  }, [members, selectedMemberId]);

  const serverRows = useMemo(() => {
    if (!selectedMember) return [];

    const from = Number(selectedMember.server_from);
    const to = Number(selectedMember.server_to);

    if (!from || !to || from > to) return [];

    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }, [selectedMember]);

  const activeReports = useMemo(() => {
    return reports.filter((report) => {
      if (report.gauge_color !== "赤") return true;

      const info = getRainbowInfo(report, now);
      return !info.isExpired;
    });
  }, [reports, now]);

  const latestReportMap = useMemo(() => {
  const map = new Map();

  activeReports.forEach((report) => {
    const key = `${Number(report.server_no)}-${report.map_name}`;
    const current = map.get(key);

    if (!current) {
      map.set(key, report);
      return;
    }

    const currentTime = new Date(current.created_at).getTime();
    const reportTime = new Date(report.created_at).getTime();

    if (reportTime > currentTime) {
      map.set(key, report);
    }
  });

  return map;
}, [activeReports]);

  const importantReports = useMemo(() => {
    return activeReports
      .filter((report) => {
        if (report.gauge_color !== "赤") return false;

        const info = getRainbowInfo(report, now);
        return info.isImportant && !info.isExpired;
      })
      .sort((a, b) => {
        const aInfo = getRainbowInfo(a, now);
        const bInfo = getRainbowInfo(b, now);

        return aInfo.rainbowAt.getTime() - bInfo.rainbowAt.getTime();
      });
  }, [activeReports, now]);

  const redTimelineReports = useMemo(() => {
    return activeReports
      .filter((report) => report.gauge_color === "赤")
      .map((report) => {
        const info = getRainbowInfo(report, now);

        return {
          ...report,
          rainbowAt: info.rainbowAt,
          expireAt: info.expireAt,
          remainingMinutes: info.remainingMinutes,
          remainingToExpireMinutes: info.remainingToExpireMinutes,
          progressPercent: info.progressPercent,
          isImportant: info.isImportant,
          isRainbow: info.isRainbow,
          isExpired: info.isExpired,
        };
      })
      .filter((report) => !report.isExpired)
      .sort((a, b) => a.rainbowAt.getTime() - b.rainbowAt.getTime());
  }, [activeReports, now]);

  const toastReports = useMemo(() => {
    return importantReports
      .filter((report) => !dismissedToastIds.includes(report.id))
      .slice(0, 3);
  }, [importantReports, dismissedToastIds]);
  const tutorialStep = TUTORIAL_STEPS[tutorialStepIndex];

  const tutorialTargetRefs = useMemo(() => {
      return {
        maps: mapSelectorRef,
        register: registerRef,
        quick: quickReportRef,
      };
    }, []);

    const isTutorialTarget = (target) => {
      return tutorialActive && tutorialStep?.target === target;
    };
  const fetchRoom = async ({ redirectOnError = false } = {}) => {
    try {
      const nextRoom = await fetchKishojuRoom(roomId);
      const nextMembers = nextRoom.members || [];

      setRoom(nextRoom);
      setReports(nextRoom.reports || []);
      setMembers(nextMembers);

      setSelectedMemberId((current) => {
        if (
          current &&
          nextMembers.some((member) => String(member.id) === String(current))
        ) {
          return current;
        }

        if (nextMembers.length === 0) return "";
        return String(nextMembers[0].id);
      });
    } catch (err) {
      if (redirectOnError) {
        router.replace(`/${locale}/tools/kishoju?notice=room-not-found`);
        return;
      }

      setError(err.message || t("errors.common"));
    }
  };

  const fetchReports = async () => {
    try {
      const nextReports = await fetchKishojuReports(roomId);
      setReports(nextReports);
    } catch {
      // 自動更新なので、ここでは画面エラーにしない
    }
  };

  const deleteReportSilently = async (reportId) => {
    await deleteKishojuReport(roomId, reportId);
  };

  useEffect(() => {
  fetchRoom({ redirectOnError: true });

  const reportTimer = setInterval(fetchReports, 5000);
  const clockTimer = setInterval(() => setNow(new Date()), 10000);

  return () => {
    clearInterval(reportTimer);
    clearInterval(clockTimer);
  };
}, [roomId]);
  useEffect(() => {
  const tutorialStatus = localStorage.getItem(TUTORIAL_STORAGE_KEY);

  if (!tutorialStatus) {
    setTutorialPromptOpen(true);
  }
}, []);

  useEffect(() => {
    if (!tutorialActive || !tutorialStep) return;

    if (tutorialStep.target === "maps") {
      setOpenPanels((current) => ({ ...current, maps: true }));
    }

    if (tutorialStep.target === "register") {
      setOpenPanels((current) => ({ ...current, register: true }));
    }

    const targetRef = tutorialTargetRefs[tutorialStep.target];

    const scrollTimer = setTimeout(() => {
      targetRef?.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }, 80);

    return () => clearTimeout(scrollTimer);
  }, [tutorialActive, tutorialStep, tutorialTargetRefs]);
  useEffect(() => {
    return () => {
      toastTimerMapRef.current.forEach((timerId) => {
        clearTimeout(timerId);
      });

      toastTimerMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const visibleToastIds = new Set(toastReports.map((report) => report.id));

    toastReports.forEach((report) => {
      if (toastTimerMapRef.current.has(report.id)) return;

      const timerId = setTimeout(() => {
        setDismissedToastIds((current) => {
          if (current.includes(report.id)) return current;
          return [...current, report.id];
        });

        toastTimerMapRef.current.delete(report.id);
      }, TOAST_AUTO_DISMISS_MS);

      toastTimerMapRef.current.set(report.id, timerId);
    });

    toastTimerMapRef.current.forEach((timerId, reportId) => {
      if (visibleToastIds.has(reportId)) return;

      clearTimeout(timerId);
      toastTimerMapRef.current.delete(reportId);
    });
  }, [toastReports]);

  useEffect(() => {
    const expiredRedReports = reports.filter((report) => {
      if (report.gauge_color !== "赤") return false;
      if (deletingReportIdsRef.current.has(report.id)) return false;

      const info = getRainbowInfo(report, now);
      return info.isExpired;
    });

    if (expiredRedReports.length === 0) return;

    expiredRedReports.forEach((report) => {
      deletingReportIdsRef.current.add(report.id);
    });

    Promise.allSettled(
      expiredRedReports.map((report) => deleteReportSilently(report.id))
    ).then(() => {
      expiredRedReports.forEach((report) => {
        deletingReportIdsRef.current.delete(report.id);
      });

      setDismissedToastIds((current) =>
        current.filter(
          (id) => !expiredRedReports.some((report) => report.id === id)
        )
      );

      fetchReports();
    });
  }, [reports, now, roomId]);

  useEffect(() => {
    const savedName = localStorage.getItem("kishoju_player_name");
    const savedServerFrom = localStorage.getItem("kishoju_server_from");
    const savedServerTo = localStorage.getItem("kishoju_server_to");
    const savedMaps = localStorage.getItem("kishoju_selected_maps");

    if (savedName) setPlayerName(savedName);
    if (savedServerFrom) setServerFrom(savedServerFrom);
    if (savedServerTo) setServerTo(savedServerTo);

    if (!savedMaps) return;

    try {
      const parsed = JSON.parse(savedMaps);

      if (Array.isArray(parsed) && parsed.length > 0) {
        const sortedMaps = MAP_KEYS.map((map) => map.value).filter((map) =>
          parsed.includes(map)
        );

        setSelectedMaps(sortedMaps);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (selectedMaps.length === 0) {
      setActiveMobileMap("");
      return;
    }

    setActiveMobileMap((current) => {
      if (current && selectedMaps.includes(current)) return current;
      return selectedMaps[0];
    });
  }, [selectedMaps]);

  const activeMobileMapIndex = useMemo(() => {
    if (!activeMobileMap) return 0;

    const index = selectedMaps.findIndex((map) => map === activeMobileMap);

    return index >= 0 ? index : 0;
  }, [activeMobileMap, selectedMaps]);

  const canSwitchMobileMap = selectedMaps.length > 1;

  const moveMobileMap = (direction) => {
    if (!canSwitchMobileMap) return;

    setActiveMobileMap((current) => {
      const currentIndex = selectedMaps.findIndex((map) => map === current);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;

      const nextIndex =
        (safeIndex + direction + selectedMaps.length) % selectedMaps.length;

      return selectedMaps[nextIndex];
    });
  };

  const handleMobileMapTouchStart = (e) => {
    if (!canSwitchMobileMap) return;

    const touch = e.touches[0];

    mobileMapTouchStartXRef.current = touch.clientX;
    mobileMapTouchStartYRef.current = touch.clientY;
    mobileMapTouchCurrentXRef.current = touch.clientX;
    mobileMapTouchCurrentYRef.current = touch.clientY;
  };

  const handleMobileMapTouchMove = (e) => {
    if (!canSwitchMobileMap) return;

    const touch = e.touches[0];

    mobileMapTouchCurrentXRef.current = touch.clientX;
    mobileMapTouchCurrentYRef.current = touch.clientY;
  };

  const handleMobileMapTouchEnd = () => {
    if (!canSwitchMobileMap) return;

    const startX = mobileMapTouchStartXRef.current;
    const startY = mobileMapTouchStartYRef.current;
    const endX = mobileMapTouchCurrentXRef.current;
    const endY = mobileMapTouchCurrentYRef.current;

    const diffX = endX - startX;
    const diffY = Math.abs(endY - startY);

    const isHorizontalSwipe = Math.abs(diffX) > 55 && Math.abs(diffX) > diffY * 1.3;

    if (isHorizontalSwipe) {
      if (diffX < 0) {
        moveMobileMap(1);
      } else {
        moveMobileMap(-1);
      }
    }

    mobileMapTouchStartXRef.current = 0;
    mobileMapTouchStartYRef.current = 0;
    mobileMapTouchCurrentXRef.current = 0;
    mobileMapTouchCurrentYRef.current = 0;
  };

  const togglePanel = (panelName) => {
    setOpenPanels((current) => ({
      ...current,
      [panelName]: !current[panelName],
    }));
  };

  const openConfirm = (action) => {
    setConfirmAction(action);
  };

  const closeConfirm = () => {
    if (busyAction) return;
    setConfirmAction(null);
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;

    try {
      setError("");
      setMessage("");
      setBusyAction(confirmAction.busyKey);

      await confirmAction.onConfirm();

      setConfirmAction(null);
    } catch (err) {
      setError(err.message || t("errors.common"));
    } finally {
      setBusyAction("");
    }
  };

  const joinRoom = async () => {
    try {
      setError("");
      setMessage("");
      setBusyAction("join-room");

      if (!playerName.trim()) {
        setError(t("errors.nameRequired"));
        return;
      }

      if (!serverFrom || !serverTo) {
        setError(t("errors.serverRequired"));
        return;
      }

      if (Number(serverFrom) > Number(serverTo)) {
        setError(t("errors.serverOrder"));
        return;
      }

      if (Number(serverFrom) < 1 || Number(serverTo) > 40) {
        setError(t("errors.serverRange"));
        return;
      }

      localStorage.setItem("kishoju_player_name", playerName.trim());
      localStorage.setItem("kishoju_server_from", serverFrom);
      localStorage.setItem("kishoju_server_to", serverTo);

      const member = await joinKishojuRoom(roomId, {
        name: playerName.trim(),
        server_from: Number(serverFrom),
        server_to: Number(serverTo),
      });

      setMessage(t("messages.joined"));
      setSelectedMemberId(String(member.id));
      setOpenPanels((current) => ({ ...current, register: false }));

      await fetchRoom();
    } catch (err) {
      setError(err.message || t("errors.common"));
    } finally {
      setBusyAction("");
    }
  };

  const requestDeleteMember = (member) => {
    openConfirm({
      title: t("confirm.deleteMemberTitle", { name: member.name }),
      description: t("confirm.deleteMemberDescription"),
      confirmLabel: t("confirm.deleteMemberConfirm"),
      busyKey: `delete-member-${member.id}`,
      onConfirm: async () => {
        await deleteKishojuMember(roomId, member.id);

        setMessage(t("messages.memberDeleted"));

        if (String(selectedMemberId) === String(member.id)) {
          setSelectedMemberId("");
        }

        await fetchRoom();
      },
    });
  };

  const toggleMap = (targetMap) => {
    setSelectedMaps((current) => {
      const next = current.includes(targetMap)
        ? current.filter((map) => map !== targetMap)
        : [...current, targetMap];

      const sortedNext = MAP_KEYS.map((map) => map.value).filter((map) =>
        next.includes(map)
      );

      localStorage.setItem("kishoju_selected_maps", JSON.stringify(sortedNext));

      return sortedNext;
    });
  };

  const submitQuickReport = async ({
    targetServer,
    targetMap,
    targetColor,
  }) => {
    const busyKey = `report-${targetServer}-${targetMap}-${targetColor}`;
    const temporaryId = `temp-${Date.now()}-${targetServer}-${targetMap}`;

    if (!selectedMember) {
      setError(t("errors.memberRequired"));
      return;
    }

    const optimisticReport = {
      id: temporaryId,
      kishoju_room_id: room?.id ?? null,
      server_no: targetServer,
      map_name: targetMap,
      gauge_color: targetColor,
      reported_by: selectedMember.name,
      memo: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isTemporary: true,
    };

    try {
      setError("");
      setMessage("");
      setBusyAction(busyKey);

      setReports((current) => {
        const filtered = current.filter(
          (report) =>
            !(
              Number(report.server_no) === Number(targetServer) &&
              report.map_name === targetMap
            )
        );

        return [optimisticReport, ...filtered];
      });

      const createdReport = await createKishojuReport(roomId, {
        server_no: targetServer,
        map_name: targetMap,
        gauge_color: targetColor,
        reported_by: selectedMember.name,
        memo: null,
      });

      setReports((current) =>
        current.map((report) =>
          report.id === temporaryId ? createdReport : report
        )
      );
    } catch (err) {
      setReports((current) =>
        current.filter((report) => report.id !== temporaryId)
      );

      setError(err.message || t("errors.common"));
    } finally {
      setBusyAction("");
    }
  };

  const undoReport = async (reportId) => {
    await deleteKishojuReport(roomId, reportId);

    setDismissedToastIds((current) => current.filter((id) => id !== reportId));
    setMessage(t("messages.reportDeleted"));

    await fetchReports();
  };

  const requestUndoReport = (reportId) => {
  const targetReport = reports.find(
    (report) => String(report.id) === String(reportId)
  );

  const reportLabel = targetReport
    ? `サーバー${targetReport.server_no} / ${getMapLabel(
        targetReport.map_name
      )} / ${getGaugeLabel(targetReport.gauge_color, t)} / ${
        targetReport.reported_by || "報告者不明"
      } / ${formatTime(targetReport.created_at)}`
    : "選択した報告";

  openConfirm({
    title: "報告を削除しますか？",
    description: reportLabel,
    confirmLabel: t("confirm.deleteReportConfirm"),
    busyKey: `delete-report-${reportId}`,
    onConfirm: async () => {
      await undoReport(reportId);
    },
  });
};

  const dismissToast = (reportId) => {
    const timerId = toastTimerMapRef.current.get(reportId);

    if (timerId) {
      clearTimeout(timerId);
      toastTimerMapRef.current.delete(reportId);
    }

    setDismissedToastIds((current) => {
      if (current.includes(reportId)) return current;
      return [...current, reportId];
    });
  };

  const handleDrawerTouchStart = (e) => {
    const touch = e.touches[0];

    drawerTouchStartXRef.current = touch.clientX;
    drawerTouchStartYRef.current = touch.clientY;
    drawerTouchCurrentXRef.current = touch.clientX;
    drawerTouchCurrentYRef.current = touch.clientY;
  };

  const handleDrawerTouchMove = (e) => {
    const touch = e.touches[0];

    drawerTouchCurrentXRef.current = touch.clientX;
    drawerTouchCurrentYRef.current = touch.clientY;
  };

  const handleDrawerTouchEnd = () => {
    const startX = drawerTouchStartXRef.current;
    const startY = drawerTouchStartYRef.current;
    const endX = drawerTouchCurrentXRef.current;
    const endY = drawerTouchCurrentYRef.current;

    const diffX = endX - startX;
    const diffY = Math.abs(endY - startY);

    const isSwipeRight = diffX > 80;
    const isHorizontalSwipe = diffX > diffY * 1.4;

    if (isSwipeRight && isHorizontalSwipe) {
      setIsScheduleDrawerOpen(false);
    }

    drawerTouchStartXRef.current = 0;
    drawerTouchStartYRef.current = 0;
    drawerTouchCurrentXRef.current = 0;
    drawerTouchCurrentYRef.current = 0;
  };
  const startTutorial = () => {
  setTutorialPromptOpen(false);
  setTutorialStepIndex(0);
  setTutorialActive(true);
};

  const skipTutorial = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "skipped");
    setTutorialPromptOpen(false);
    setTutorialActive(false);
  };

  const finishTutorial = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "done");
    setTutorialActive(false);
  };

  const goNextTutorialStep = () => {
    if (tutorialStepIndex >= TUTORIAL_STEPS.length - 1) {
      finishTutorial();
      return;
    }

    setTutorialStepIndex((current) => current + 1);
  };

  const goPrevTutorialStep = () => {
    setTutorialStepIndex((current) => Math.max(0, current - 1));
  };
  const copyUrl = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setMessage(t("messages.urlCopied"));
  };

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
        <button
          type="button"
          className={styles.schedulePeek}
          onClick={() => setIsScheduleDrawerOpen(true)}
        >
          <span>{t("toast.schedule")}</span>
          <strong>{redTimelineReports.length}</strong>
        </button>
      )}

      {isScheduleDrawerOpen && (
        <div
          className={styles.scheduleDrawerBackdrop}
          onClick={() => setIsScheduleDrawerOpen(false)}
        >
          <section
            className={styles.scheduleDrawer}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
          >
            <span className={styles.drawerSwipeHint} />

            <div className={styles.drawerHead}>
              <div>
                <p>{t("drawer.kicker")}</p>
                <h2>{t("drawer.title")}</h2>
              </div>

              <button
                type="button"
                onClick={() => setIsScheduleDrawerOpen(false)}
                aria-label={t("drawer.closeLabel")}
              >
                ×
              </button>
            </div>

            <RainbowScheduleList
              reports={redTimelineReports}
              now={now}
              onUndo={requestUndoReport}
              getMapLabel={getMapLabel}
              t={t}
            />
          </section>
        </div>
      )}

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

      <section className={styles.grid}>
        <aside className={styles.side}>
          <div
              ref={mapSelectorRef}
              className={`${styles.card} ${styles.accordionCard} ${
                isTutorialTarget("maps") ? styles.tutorialTarget : ""
              }`}
            >
            <button
              type="button"
              className={styles.accordionHead}
              onClick={() => togglePanel("maps")}
            >
              <span>{t("side.mapsTitle")}</span>
              <strong>{openPanels.maps ? "−" : "+"}</strong>
            </button>

            <div
              className={`${styles.accordionBody} ${
                openPanels.maps ? styles.accordionOpen : ""
              }`}
            >
              <div className={styles.mapCheckList}>
                {mapOptions.map((map) => (
                  <button
                    key={map.value}
                    type="button"
                    className={`${styles.mapCheckButton} ${
                      selectedMaps.includes(map.value) ? styles.mapSelected : ""
                    }`}
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
            <button
              type="button"
              className={styles.accordionHead}
              onClick={() => togglePanel("register")}
            >
              <span>{t("side.registerTitle")}</span>
              <strong>{openPanels.register ? "−" : "+"}</strong>
            </button>

            <div
              className={`${styles.accordionBody} ${
                openPanels.register ? styles.accordionOpen : ""
              }`}
            >
              <div className={styles.formGrid}>
                <label>
                  {t("form.name")}
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder={t("form.namePlaceholder")}
                  />
                </label>

                <div className={styles.twoCols}>
                  <label>
                    {t("form.serverFrom")}
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={serverFrom}
                      onChange={(e) => setServerFrom(e.target.value)}
                      placeholder="1"
                    />
                  </label>

                  <label>
                    {t("form.serverTo")}
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={serverTo}
                      onChange={(e) => setServerTo(e.target.value)}
                      placeholder="10"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={joinRoom}
                  disabled={busyAction === "join-room"}
                >
                  {busyAction === "join-room" ? (
                    <>
                      <Spinner />
                      {t("form.submitting")}
                    </>
                  ) : (
                    t("form.submit")
                  )}
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

        <section className={styles.main}>
          <div
              ref={quickReportRef}
              className={`${styles.card} ${
                isTutorialTarget("quick") ? styles.tutorialTarget : ""
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
                    String(member.id) === String(selectedMemberId);
                  const memberBusy =
                    busyAction === `delete-member-${member.id}`;

                  return (
                    <div
                      key={member.id}
                      className={`${styles.memberTab} ${
                        isSelected ? styles.memberTabActive : ""
                      } ${memberBusy ? styles.isBusy : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!busyAction) setSelectedMemberId(String(member.id));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !busyAction) {
                          setSelectedMemberId(String(member.id));
                        }
                      }}
                    >
                      <button
                        type="button"
                        className={styles.memberDeleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
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

                      <strong className={styles.memberName}>
                        {member.name}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}

            {!selectedMember ? (
              <p className={styles.empty}>{t("quick.noMember")}</p>
            ) : selectedMaps.length === 0 ? (
              <p className={styles.empty}>{t("quick.noMap")}</p>
            ) : (
              <>
                <div className={styles.mobileMapSwitcher}>
                  <button
                    type="button"
                    className={styles.mobileMapNavButton}
                    onClick={() => moveMobileMap(-1)}
                    disabled={!canSwitchMobileMap}
                    aria-label="前の場所へ"
                  >
                    <FiChevronLeft />
                  </button>

                  <div className={styles.mobileMapCurrent}>
                    <span className={styles.mobileMapCurrentLabel}>
                      {getMapLabel(activeMobileMap)}
                    </span>

                    <span className={styles.mobileMapCounter}>
                      {activeMobileMapIndex + 1} / {selectedMaps.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.mobileMapNavButton}
                    onClick={() => moveMobileMap(1)}
                    disabled={!canSwitchMobileMap}
                    aria-label="次の場所へ"
                  >
                    <FiChevronRight />
                  </button>
                </div>

                {canSwitchMobileMap && (
                  <>
                    <div className={styles.mobileSwipeHint}>
                      <FiSmartphone />
                      <span>横スワイプで場所を切り替え</span>
                      <FiChevronLeft />
                      <FiChevronRight />
                    </div>

                    <div className={styles.mobileMapTabs}>
                    {selectedMaps.map((targetMap) => (
                      <button
                        key={targetMap}
                        type="button"
                        className={`${styles.mobileMapTab} ${
                          activeMobileMap === targetMap ? styles.mobileMapTabActive : ""
                        }`}
                        onClick={() => setActiveMobileMap(targetMap)}
                        aria-label={`${getMapLabel(targetMap)}を表示`}
                      >
                        <span className={styles.mobileMapTabLabel}>
                          {getMapLabel(targetMap)}
                        </span>
                      </button>
                    ))}
                  </div>
                  </>
                )}

                <div
                  className={styles.quickTableWrap}
                  onTouchStart={handleMobileMapTouchStart}
                  onTouchMove={handleMobileMapTouchMove}
                  onTouchEnd={handleMobileMapTouchEnd}
                ></div>

                <div className={styles.quickTableWrap}>
                  <table className={styles.quickTable}>
                    <thead>
                      <tr>
                        <th>{t("quick.server")}</th>

                        {selectedMaps.map((targetMap) => (
                          <th
                            key={targetMap}
                            className={styles.desktopMapColumn}
                          >
                            {getMapLabel(targetMap)}
                          </th>
                        ))}

                        {activeMobileMap && (
                          <th className={styles.mobileMapColumn}>
                            {getMapLabel(activeMobileMap)}
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {serverRows.map((targetServer) => (
                        <tr key={targetServer}>
                          <th>{targetServer}</th>

                          {selectedMaps.map((targetMap) => {
                            const latest = latestReportMap.get(
                              `${targetServer}-${targetMap}`
                            );

                            const busyColor =
                              busyAction ===
                              `report-${targetServer}-${targetMap}-黄`
                                ? "黄"
                                : busyAction ===
                                    `report-${targetServer}-${targetMap}-赤`
                                  ? "赤"
                                  : "";

                            const isDeleting =
                              latest &&
                              busyAction === `delete-report-${latest.id}`;

                            return (
                              <td
                                key={`${targetServer}-${targetMap}`}
                                className={styles.desktopMapColumn}
                              >
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
                              </td>
                            );
                          })}

                          {activeMobileMap && (
                            <td className={styles.mobileMapColumn}>
                              {(() => {
                                const latest = latestReportMap.get(
                                  `${targetServer}-${activeMobileMap}`
                                );

                                const busyColor =
                                  busyAction ===
                                  `report-${targetServer}-${activeMobileMap}-黄`
                                    ? "黄"
                                    : busyAction ===
                                        `report-${targetServer}-${activeMobileMap}-赤`
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
                                        targetMap: activeMobileMap,
                                        targetColor: color,
                                      })
                                    }
                                    onUndo={requestUndoReport}
                                    t={t}
                                  />
                                );
                              })()}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                <p className={styles.empty}>{t("log.empty")}</p>
              ) : (
                activeReports.map((report) => {
                  const info = getRainbowInfo(report, now);
                  const isDeleting = busyAction === `delete-report-${report.id}`;
                  const isRed = report.gauge_color === "赤";

                  return (
                    <article key={report.id} className={styles.reportItem}>
                      <button
                        type="button"
                        className={styles.reportUndoButton}
                        onClick={() => requestUndoReport(report.id)}
                        aria-label={t("log.undoLabel")}
                        disabled={Boolean(busyAction)}
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
        </section>
      </section>
    </main>
  );
}

function QuickCell({
  latest,
  now,
  busyColor,
  isDeleting,
  onClick,
  onUndo,
  t,
}) {
  const info = latest ? getRainbowInfo(latest, now) : null;
  const isYellow = latest?.gauge_color === "黄";
  const isRed = latest?.gauge_color === "赤";

  return (
    <div className={styles.quickCell}>
      <button
        type="button"
        className={`${styles.quickColorButton} ${
          isYellow ? styles.yellowGauge : ""
        } ${busyColor === "黄" ? styles.quickButtonBusy : ""}`}
        onClick={() => onClick("黄")}
        disabled={Boolean(busyColor || isDeleting)}
      >
        {busyColor === "黄" ? <Spinner small /> : t("colors.yellow")}
      </button>

      <button
        type="button"
        className={`${styles.quickColorButton} ${
          isRed ? styles.redGauge : ""
        } ${busyColor === "赤" ? styles.quickButtonBusy : ""}`}
        onClick={() => onClick("赤")}
        disabled={Boolean(busyColor || isDeleting)}
      >
        {busyColor === "赤" ? <Spinner small /> : t("colors.red")}
      </button>

      <div className={styles.latestState}>
        {latest ? (
          <>
            <button
              type="button"
              className={styles.cellUndoButton}
              onClick={() => onUndo(latest.id)}
              aria-label={t("quick.deleteReportLabel")}
              disabled={Boolean(busyColor || isDeleting)}
            >
              {isDeleting ? <Spinner small /> : "×"}
            </button>

            {latest.gauge_color === "赤" ? (
              <strong className={styles.stateLine}>
                {formatTime(latest.created_at)}〜{formatTime(info.rainbowAt)}
              </strong>
            ) : (
              <strong className={styles.stateLine}>
                {getGaugeLabel(latest.gauge_color, t)}
                <br />
                {formatTime(latest.created_at)}
              </strong>
            )}
          </>
        ) : (
          <span className={styles.noData}>{t("quick.empty")}</span>
        )}
      </div>
    </div>
  );
}

function RainbowScheduleList({ reports, now, onUndo, getMapLabel, t }) {
  if (reports.length === 0) {
    return <p className={styles.empty}>{t("schedule.empty")}</p>;
  }

  return (
    <div className={styles.rainbowScheduleList}>
      {reports.map((report) => (
        <RainbowNoticeCard
          key={report.id}
          report={report}
          now={now}
          variant="schedule"
          actionLabel="×"
          onAction={onUndo ? () => onUndo(report.id) : undefined}
          getMapLabel={getMapLabel}
          t={t}
        />
      ))}
    </div>
  );
}

function RainbowNoticeCard({
  report,
  now,
  variant,
  actionLabel,
  onAction,
  onSwipeRight,
  getMapLabel,
  t,
}) {
  const info = getRainbowInfo(report, now);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchCurrentXRef = useRef(0);
  const touchCurrentYRef = useRef(0);

  const handleTouchStart = (e) => {
    if (!onSwipeRight) return;

    const touch = e.touches[0];

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchCurrentXRef.current = touch.clientX;
    touchCurrentYRef.current = touch.clientY;
  };

  const handleTouchMove = (e) => {
    if (!onSwipeRight) return;

    const touch = e.touches[0];

    touchCurrentXRef.current = touch.clientX;
    touchCurrentYRef.current = touch.clientY;
  };

  const handleTouchEnd = () => {
    if (!onSwipeRight) return;

    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const endX = touchCurrentXRef.current;
    const endY = touchCurrentYRef.current;

    const diffX = endX - startX;
    const diffY = Math.abs(endY - startY);

    const isSwipeRight = diffX > 70;
    const isHorizontalSwipe = diffX > diffY * 1.3;

    if (isSwipeRight && isHorizontalSwipe) {
      onSwipeRight();
    }

    touchStartXRef.current = 0;
    touchStartYRef.current = 0;
    touchCurrentXRef.current = 0;
    touchCurrentYRef.current = 0;
  };

  const timeLabel = info.isRainbow
      ? `あと${info.remainingToExpireMinutes}分`
      : `あと${info.remainingMinutes}分`;

    const subLabel = info.isRainbow
      ? `${formatTime(info.rainbowAt)} 虹化 / 非表示まで`
      : `${formatTime(info.rainbowAt)} 虹化予定`;

  return (
    <article
      className={`${styles.rainbowNoticeCard} ${
        info.isImportant ? styles.rainbowNoticeImportant : ""
      } ${info.isRainbow ? styles.rainbowNoticeRainbow : ""} ${
        styles[`rainbowNotice_${variant}`] || ""
      } ${variant === "toast" ? styles.toastAutoFade : ""} ${
        onSwipeRight ? styles.swipeableNotice : ""
      }`}
      style={{
        "--rainbow-progress": `${info.progressPercent}%`,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {onAction && (
        <button
          type="button"
          className={styles.rainbowNoticeAction}
          onClick={onAction}
          aria-label={t("schedule.deleteLabel")}
        >
          {actionLabel}
        </button>
      )}

      <div className={styles.rainbowProgressLayer} />

      <div className={styles.rainbowNoticeMain}>
        <p className={styles.rainbowNoticeTopLine}>
          <span className={styles.rainbowServerBadge}>
            {report.server_no}
          </span>

          <strong>{getMapLabel(report.map_name)}</strong>
        </p>

        <div className={styles.rainbowGaugeTrack}>
          <span className={styles.rainbowGaugeFill} />
        </div>

        <p className={styles.rainbowNoticeBottomLine}>
          <span>{subLabel}</span>
          <span
            className={`${styles.rainbowTimeBadge} ${
              info.isRainbow ? styles.rainbowTimeBadgeRainbow : ""
            }`}
          >
            {timeLabel}
          </span>
        </p>
      </div>
    </article>
  );
}

function ConfirmModal({ action, isBusy, onCancel, onConfirm, t }) {
  if (!action) return null;

  return (
    <div className={styles.confirmBackdrop} onClick={onCancel}>
      <section
        className={styles.confirmModal}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{action.title}</h2>
        <p>{action.description}</p>

        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.confirmCancelButton}
            onClick={onCancel}
            disabled={isBusy}
          >
            {t("confirm.cancel")}
          </button>

          <button
            type="button"
            className={styles.confirmDeleteButton}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? (
              <>
                <Spinner />
                {t("confirm.processing")}
              </>
            ) : (
              action.confirmLabel || t("confirm.defaultDelete")
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function Spinner({ small = false }) {
  return (
    <span
      className={`${styles.spinner} ${small ? styles.spinnerSmall : ""}`}
      aria-hidden="true"
    />
  );
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRainbowInfo(report, now) {
  const createdAt = new Date(report.created_at);
  const rainbowAt = addMinutes(createdAt, RAINBOW_AFTER_MINUTES);
  const expireAt = addMinutes(createdAt, RED_REPORT_KEEP_MINUTES);
  const alertAt = addMinutes(rainbowAt, -IMPORTANT_BEFORE_MINUTES);

  const untilRainbowMs = rainbowAt.getTime() - now.getTime();
  const untilExpireMs = expireAt.getTime() - now.getTime();
  const elapsedMs = now.getTime() - createdAt.getTime();

  const elapsedMinutes = elapsedMs / 1000 / 60;
  const progressPercent = Math.round(
    clampNumber((elapsedMinutes / RAINBOW_AFTER_MINUTES) * 100, 0, 100)
  );

  const isRainbow = untilRainbowMs <= 0 && untilExpireMs > 0;

  return {
    createdAt,
    rainbowAt,
    expireAt,
    alertAt,
    remainingMinutes: Math.max(0, Math.ceil(untilRainbowMs / 1000 / 60)),
    remainingToExpireMinutes: Math.max(0, Math.ceil(untilExpireMs / 1000 / 60)),
    progressPercent,
    isImportant: now >= alertAt && untilRainbowMs > 0,
    isRainbow,
    isExpired: untilExpireMs <= 0,
  };
}

function formatTime(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getColorClass(color, styles) {
  if (color === "黄") return styles.yellowGauge;
  if (color === "赤") return styles.redGauge;
  return styles.unknownGauge;
}

function getGaugeLabel(color, t) {
  if (color === "黄") return t("colors.yellow");
  if (color === "赤") return t("colors.red");
  return color;
}