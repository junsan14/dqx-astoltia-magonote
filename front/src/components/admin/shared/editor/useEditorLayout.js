"use client";

import { useEffect, useState } from "react";

export default function useEditorLayout(breakpoint = 960) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => {
      const mobile = window.innerWidth <= breakpoint;
      setIsMobile(mobile);
      setSidebarOpen((prev) => {
        if (!mobile) return true;
        return prev;
      });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => window.removeEventListener("resize", syncViewport);
  }, [breakpoint]);

  return {
    isMobile,
    sidebarOpen,
    setSidebarOpen,
    openSidebar: () => setSidebarOpen(true),
    closeSidebar: () => setSidebarOpen(false),
    toggleSidebar: () => setSidebarOpen((prev) => !prev),
  };
}