"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const RouteProgressContext = createContext(null);

const MIN_VISIBLE_MS = 300;
const MAX_VISIBLE_MS = 10000;

export function RouteProgressProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const startAtRef = useRef(0);
  const finishTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const progressTimersRef = useRef([]);

  const clearProgressTimers = useCallback(() => {
    progressTimersRef.current.forEach(clearTimeout);
    progressTimersRef.current = [];
  }, []);

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const hardReset = useCallback(() => {
    clearProgressTimers();
    clearFinishTimer();
    clearMaxTimer();
    setVisible(false);
    setProgress(0);
  }, [clearFinishTimer, clearMaxTimer, clearProgressTimers]);

  const done = useCallback(() => {
    clearProgressTimers();
    clearFinishTimer();

    if (!startAtRef.current) {
      hardReset();
      return;
    }

    const elapsed = Date.now() - startAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    finishTimerRef.current = setTimeout(() => {
      setProgress(100);

      finishTimerRef.current = setTimeout(() => {
        hardReset();
      }, 180);
    }, remaining);
  }, [clearFinishTimer, clearProgressTimers, hardReset]);

  const start = useCallback(() => {
    clearProgressTimers();
    clearFinishTimer();
    clearMaxTimer();

    startAtRef.current = Date.now();
    setVisible(true);
    setProgress(10);

    progressTimersRef.current.push(
      setTimeout(() => setProgress(25), 80),
      setTimeout(() => setProgress(45), 180),
      setTimeout(() => setProgress(62), 320),
      setTimeout(() => setProgress(76), 520),
      setTimeout(() => setProgress(86), 900)
    );

    maxTimerRef.current = setTimeout(() => {
      done();
    }, MAX_VISIBLE_MS);
  }, [clearFinishTimer, clearMaxTimer, clearProgressTimers, done]);

  const value = useMemo(
    () => ({ visible, progress, start, done, hardReset }),
    [visible, progress, start, done, hardReset]
  );

  return (
    <RouteProgressContext.Provider value={value}>
      {children}
    </RouteProgressContext.Provider>
  );
}

export function useRouteProgress() {
  const context = useContext(RouteProgressContext);

  if (!context) {
    throw new Error("useRouteProgress must be used within RouteProgressProvider");
  }

  return context;
}