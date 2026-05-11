"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouteProgress } from "./RouteProgressProvider";

export default function RouteProgressDoneOnRender() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { visible, done } = useRouteProgress();

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      done();
    }, 80);

    return () => clearTimeout(timer);
  }, [pathname, searchParams, visible, done]);

  return null;
}