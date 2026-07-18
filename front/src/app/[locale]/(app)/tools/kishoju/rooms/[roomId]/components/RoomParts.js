"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./RoomParts.module.css";
import {
  createKishojuReport,
  deleteKishojuMember,
  deleteKishojuReport,
  fetchKishojuReports,
  fetchKishojuRoom,
  joinKishojuRoom,
} from "@/lib/kishoju";
import { TUTORIAL_STORAGE_KEY, TUTORIAL_STEPS } from "../KishojuRoomTutorial";

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

// 選択中の場所を配列で保存し、その配列順をクイック登録の表示順として使います。
const SELECTED_MAPS_STORAGE_KEY = "kishoju_enabled_maps";
const LEGACY_SELECTED_MAPS_STORAGE_KEY = "kishoju_selected_maps";

const RAINBOW_AFTER_MINUTES = 60;
const RED_REPORT_KEEP_MINUTES = 70;
const IMPORTANT_BEFORE_MINUTES = 15;
const TOAST_AUTO_DISMISS_MS = 20000;
const MOBILE_CARD_GAP = 12;
const EXCLUDED_SERVER_NUMBERS = new Set([18, 19]);

// 手動で赤・黄を押した直後に、自動更新で古いDB状態を拾って表示が戻るのを防ぐ
const MANUAL_REPORT_REFRESH_PAUSE_MS = 1800;
const MANUAL_REPORT_FORCE_REFRESH_DELAY_MS = 700;

export function useKishojuRoomController({ roomId }) {
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
  const [hasLoadedSelectedMaps, setHasLoadedSelectedMaps] = useState(false);

  useEffect(() => {
    const readSavedMaps = (storageKey) => {
      try {
        const savedValue = localStorage.getItem(storageKey);

        if (savedValue === null) {
          return null;
        }

        const parsedValue = JSON.parse(savedValue);

        if (!Array.isArray(parsedValue)) {
          return null;
        }

        return parsedValue.filter(
          (mapName, index) =>
            typeof mapName === "string" &&
            MAP_KEYS.some((map) => map.value === mapName) &&
            parsedValue.indexOf(mapName) === index
        );
      } catch {
        return null;
      }
    };

    /*
     * 選択中の場所は配列の順番も含めて保存します。
     * この配列順がクイック登録の表示順になります。
     */
    const savedMaps = readSavedMaps(SELECTED_MAPS_STORAGE_KEY);

    if (savedMaps !== null) {
      setSelectedMaps(savedMaps);
      setHasLoadedSelectedMaps(true);
      return;
    }

    /*
     * 旧バージョンの保存内容がある場合のみ移行します。
     */
    const legacyMaps = readSavedMaps(LEGACY_SELECTED_MAPS_STORAGE_KEY);

    if (legacyMaps !== null && legacyMaps.length > 0) {
      setSelectedMaps(legacyMaps);
    } else {
      setSelectedMaps(DEFAULT_SELECTED_MAPS);
    }

    setHasLoadedSelectedMaps(true);
  }, []);

  /*
   * 初回のlocalStorage読み込みが終わった後だけ保存します。
   * これにより、リロード直後にデフォルト3件で保存順を上書きしません。
   */
  useEffect(() => {
    if (!hasLoadedSelectedMaps) return;

    try {
      localStorage.setItem(
        SELECTED_MAPS_STORAGE_KEY,
        JSON.stringify(selectedMaps)
      );
    } catch {
      // localStorageを利用できない環境では保存しない
    }
  }, [hasLoadedSelectedMaps, selectedMaps]);

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
  const pendingReportKeysRef = useRef(new Set());

  // 追加：赤・黄の手動登録中は自動更新を止める
  const isSubmittingReportRef = useRef(false);

  // 追加：押した直後に自動更新が走らないように一時停止期限を持つ
  const autoRefreshPausedUntilRef = useRef(0);

  // 追加：古いfetch結果が新しい結果を上書きしないようにする
  const reportsFetchSeqRef = useRef(0);

  // 追加：送信後の遅延再取得タイマー
  const manualRefreshTimerRef = useRef(null);

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

  const mobileCardViewportRef = useRef(null);
  const [mobileCardStepWidth, setMobileCardStepWidth] = useState(0);
  const [mobileDragOffset, setMobileDragOffset] = useState(0);
  const [isMobileDragging, setIsMobileDragging] = useState(false);

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

    return Array.from(
      { length: to - from + 1 },
      (_, index) => from + index
    ).filter((serverNo) => !EXCLUDED_SERVER_NUMBERS.has(serverNo));
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

  const activeMobileMapIndex = useMemo(() => {
    if (!activeMobileMap) return 0;

    const index = selectedMaps.findIndex((map) => map === activeMobileMap);

    return index >= 0 ? index : 0;
  }, [activeMobileMap, selectedMaps]);

  const canSwitchMobileMap = selectedMaps.length > 1;

  const safeMobileCardStepWidth =
    mobileCardStepWidth ||
    (typeof window !== "undefined"
      ? window.innerWidth * 0.92 + MOBILE_CARD_GAP
      : 360);

  const mobileCardBaseTranslate =
    activeMobileMapIndex * -safeMobileCardStepWidth;

  const mobileCardTrackStyle = {
    transform: `translate3d(${
      mobileCardBaseTranslate + mobileDragOffset
    }px, 0, 0)`,
    transition: isMobileDragging ? "none" : undefined,
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

  const mergeReportsKeepingPending = (currentReports, nextReports) => {
    const pendingReports = currentReports.filter((report) => {
      const key = `${Number(report.server_no)}-${report.map_name}`;
      return pendingReportKeysRef.current.has(key);
    });

    if (pendingReports.length === 0) {
      return nextReports;
    }

    const nextReportKeys = new Set(
      nextReports.map(
        (report) => `${Number(report.server_no)}-${report.map_name}`
      )
    );

    const stillPendingReports = pendingReports.filter((report) => {
      const key = `${Number(report.server_no)}-${report.map_name}`;
      return !nextReportKeys.has(key);
    });

    return [...stillPendingReports, ...nextReports];
  };

  const fetchReports = async ({ force = false } = {}) => {
    const nowTime = Date.now();

    // 手動登録中・登録直後は、自動更新だけ止める
    if (!force && isSubmittingReportRef.current) return;
    if (!force && nowTime < autoRefreshPausedUntilRef.current) return;

    const fetchSeq = ++reportsFetchSeqRef.current;

    try {
      const nextReports = await fetchKishojuReports(roomId);

      // forceでない古いfetchが後から返ってきた場合は無視
      if (!force && fetchSeq !== reportsFetchSeqRef.current) return;

      setReports((currentReports) =>
        mergeReportsKeepingPending(currentReports, nextReports)
      );
    } catch {
      // 自動更新なので、ここでは画面エラーにしない
    }
  };

  const scheduleManualForceRefresh = () => {
    if (manualRefreshTimerRef.current) {
      clearTimeout(manualRefreshTimerRef.current);
    }

    manualRefreshTimerRef.current = setTimeout(() => {
      manualRefreshTimerRef.current = null;
      fetchReports({ force: true });
    }, MANUAL_REPORT_FORCE_REFRESH_DELAY_MS);
  };

  const deleteReportSilently = async (reportId) => {
    await deleteKishojuReport(roomId, reportId);
  };

  useEffect(() => {
    fetchRoom({ redirectOnError: true });

    const reportTimer = setInterval(() => {
      fetchReports();
    }, 5000);

    const clockTimer = setInterval(() => setNow(new Date()), 10000);

    return () => {
      clearInterval(reportTimer);
      clearInterval(clockTimer);

      if (manualRefreshTimerRef.current) {
        clearTimeout(manualRefreshTimerRef.current);
      }
    };
  }, [roomId]);

  useLayoutEffect(() => {
    const viewport = mobileCardViewportRef.current;
    if (!viewport) return;

    const updateStepWidth = () => {
      const firstSlide = viewport.querySelector(
        "[data-mobile-map-slide]"
      );

      if (!firstSlide) return;

      const slideWidth = firstSlide.getBoundingClientRect().width;
      setMobileCardStepWidth(slideWidth + MOBILE_CARD_GAP);
    };

    const frameId = requestAnimationFrame(updateStepWidth);

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateStepWidth);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener("resize", updateStepWidth);
      };
    }

    const resizeObserver = new ResizeObserver(updateStepWidth);
    resizeObserver.observe(viewport);

    window.addEventListener("resize", updateStepWidth);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateStepWidth);
    };
  }, [selectedMemberId, selectedMaps.length, activeMobileMap, serverRows.length]);

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
      if (report.isTemporary) return false;

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

      fetchReports({ force: true });
    });
  }, [reports, now, roomId]);

  useEffect(() => {
    const savedName = localStorage.getItem("kishoju_player_name");
    const savedServerFrom = localStorage.getItem("kishoju_server_from");
    const savedServerTo = localStorage.getItem("kishoju_server_to");
    if (savedName) setPlayerName(savedName);
    if (savedServerFrom) setServerFrom(savedServerFrom);
    if (savedServerTo) setServerTo(savedServerTo);
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

  const moveMobileMap = (direction) => {
    if (!canSwitchMobileMap) return;

    setIsMobileDragging(false);
    setMobileDragOffset(0);

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

    setIsMobileDragging(true);
    setMobileDragOffset(0);
  };

  const handleMobileMapTouchMove = (e) => {
    if (!canSwitchMobileMap) return;

    const touch = e.touches[0];

    mobileMapTouchCurrentXRef.current = touch.clientX;
    mobileMapTouchCurrentYRef.current = touch.clientY;

    const startX = mobileMapTouchStartXRef.current;
    const startY = mobileMapTouchStartYRef.current;
    const diffX = touch.clientX - startX;
    const diffY = Math.abs(touch.clientY - startY);

    const isHorizontalMove =
      Math.abs(diffX) > 8 && Math.abs(diffX) > diffY * 1.15;

    if (!isHorizontalMove) return;

    const maxOffset = Math.max(80, safeMobileCardStepWidth * 0.86);
    const nextOffset = Math.max(Math.min(diffX, maxOffset), -maxOffset);

    setMobileDragOffset(nextOffset);
  };

  const handleMobileMapTouchEnd = () => {
    if (!canSwitchMobileMap) {
      setIsMobileDragging(false);
      setMobileDragOffset(0);
      return;
    }

    const startX = mobileMapTouchStartXRef.current;
    const startY = mobileMapTouchStartYRef.current;
    const endX = mobileMapTouchCurrentXRef.current;
    const endY = mobileMapTouchCurrentYRef.current;

    const diffX = endX - startX;
    const diffY = Math.abs(endY - startY);

    const threshold = Math.max(55, safeMobileCardStepWidth * 0.22);
    const isHorizontalSwipe =
      Math.abs(diffX) > threshold && Math.abs(diffX) > diffY * 1.25;

    if (isHorizontalSwipe) {
      if (diffX < 0) {
        moveMobileMap(1);
      } else {
        moveMobileMap(-1);
      }
    }

    setIsMobileDragging(false);
    setMobileDragOffset(0);

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
    setSelectedMaps((current) =>
      current.includes(targetMap)
        ? current.filter((map) => map !== targetMap)
        : [...current, targetMap]
    );
  };

  const submitQuickReport = async ({
    targetServer,
    targetMap,
    targetColor,
  }) => {
    const reportKey = `${Number(targetServer)}-${targetMap}`;
    const busyKey = `report-${targetServer}-${targetMap}-${targetColor}`;
    const temporaryId = `temp-${Date.now()}-${targetServer}-${targetMap}`;

    if (!selectedMember) {
      setError(t("errors.memberRequired"));
      return;
    }

    // 同じセルの連打を防ぐ
    if (pendingReportKeysRef.current.has(reportKey)) {
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
      isSubmittingReportRef.current = true;
      autoRefreshPausedUntilRef.current =
        Date.now() + MANUAL_REPORT_REFRESH_PAUSE_MS;

      setError("");
      setMessage("");
      setBusyAction(busyKey);
      pendingReportKeysRef.current.add(reportKey);

      // 先に画面を更新
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

      // APIから返った正式データに差し替え
      setReports((current) => {
        const filtered = current.filter(
          (report) =>
            !(
              Number(report.server_no) === Number(targetServer) &&
              report.map_name === targetMap
            )
        );

        return [createdReport, ...filtered];
      });

      // DB反映直後に少し待ってから強制再取得
      scheduleManualForceRefresh();
    } catch (err) {
      setReports((current) =>
        current.filter((report) => report.id !== temporaryId)
      );

      setError(err.message || t("errors.common"));
    } finally {
      pendingReportKeysRef.current.delete(reportKey);
      isSubmittingReportRef.current = false;
      setBusyAction("");
    }
  };

  const undoReport = async (reportId) => {
    await deleteKishojuReport(roomId, reportId);

    setDismissedToastIds((current) => current.filter((id) => id !== reportId));
    setMessage(t("messages.reportDeleted"));

    await fetchReports({ force: true });
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

  return {
    t, roomId, room, reports, members, playerName, setPlayerName,
    serverFrom, setServerFrom, serverTo, setServerTo, selectedMemberId,
    setSelectedMemberId, selectedMaps, setSelectedMaps, activeMobileMap, setActiveMobileMap,
    message, error, now, openPanels, isScheduleDrawerOpen,
    setIsScheduleDrawerOpen, confirmAction, busyAction, tutorialPromptOpen,
    tutorialActive, tutorialStepIndex, tutorialStep, mapOptions, getMapLabel,
    selectedMember, serverRows, activeReports, latestReportMap,
    importantReports, redTimelineReports, toastReports, canSwitchMobileMap,
    mobileCardTrackStyle, mapSelectorRef, registerRef, quickReportRef,
    mobileCardViewportRef, isTutorialTarget, togglePanel, joinRoom, toggleMap,
    submitQuickReport, requestUndoReport, requestDeleteMember, dismissToast,
    handleDrawerTouchStart, handleDrawerTouchMove, handleDrawerTouchEnd,
    handleMobileMapTouchStart, handleMobileMapTouchMove, handleMobileMapTouchEnd,
    setIsMobileDragging, setMobileDragOffset, closeConfirm, runConfirmedAction,
    startTutorial, skipTutorial, finishTutorial, goNextTutorialStep,
    goPrevTutorialStep, copyUrl,
  };
}

export function QuickCell({
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
  const isTemporary = Boolean(latest?.isTemporary);

  return (
    <div className={styles.quickCell}>
      <button
        type="button"
        className={`${styles.quickColorButton} ${
          isYellow ? styles.yellowGauge : ""
        } ${busyColor === "黄" ? styles.quickButtonBusy : ""}`}
        onClick={() => onClick("黄")}
        disabled={Boolean(busyColor || isDeleting || isTemporary)}
      >
        {busyColor === "黄" ? <Spinner small /> : t("colors.yellow")}
      </button>

      <button
        type="button"
        className={`${styles.quickColorButton} ${
          isRed ? styles.redGauge : ""
        } ${busyColor === "赤" ? styles.quickButtonBusy : ""}`}
        onClick={() => onClick("赤")}
        disabled={Boolean(busyColor || isDeleting || isTemporary)}
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
              disabled={Boolean(busyColor || isDeleting || isTemporary)}
            >
              {isDeleting ? <Spinner small /> : "×"}
            </button>

            {isTemporary ? (
              <strong className={styles.stateLine}>
                <Spinner small />
                登録中
              </strong>
            ) : latest.gauge_color === "赤" ? (
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

export function RainbowScheduleList({ reports, now, onUndo, getMapLabel, t }) {
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

export function RainbowNoticeCard({
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
    ? `あと${info.remainingToExpireMinutes}分で自動削除`
    : `あと${info.remainingMinutes}分で虹`;

  const subLabel = info.isRainbow
    ? `虹発生`
    : `${formatTime(info.rainbowAt)} 虹予定`;

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

export function ConfirmModal({ action, isBusy, onCancel, onConfirm, t }) {
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

export function Spinner({ small = false }) {
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

export function getRainbowInfo(report, now) {
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

export function formatTime(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getColorClass(color, styles) {
  if (color === "黄") return styles.yellowGauge;
  if (color === "赤") return styles.redGauge;
  return styles.unknownGauge;
}

export function getGaugeLabel(color, t) {
  if (color === "黄") return t("colors.yellow");
  if (color === "赤") return t("colors.red");
  return color;
}