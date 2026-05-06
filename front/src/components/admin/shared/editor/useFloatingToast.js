"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function createToastState() {
  return {
    visible: false,
    message: "",
    type: "success",
  };
}

export default function useFloatingToast(hideAfterMs = 2200) {
  const [toast, setToast] = useState(createToastState());
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setToast({
      visible: true,
      message,
      type,
    });

    timerRef.current = setTimeout(() => {
      setToast((prev) => ({
        ...prev,
        visible: false,
      }));
    }, hideAfterMs);
  }, [hideAfterMs]);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setToast((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
}