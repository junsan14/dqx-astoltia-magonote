"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouteProgress } from "./RouteProgressProvider";

export default function RouteProgressAutoDone() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { visible, done } = useRouteProgress();

  useEffect(() => {
    if (!visible) return;

    let frame1 = null;
    let frame2 = null;
    let timer = null;
    let cancelled = false;

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          if (cancelled) return;
          done();
        }, 120);
      });
    });

    return () => {
      cancelled = true;

      if (frame1) cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
      if (timer) clearTimeout(timer);
    };
  }, [pathname, searchParams, visible, done]);

  return null;
}