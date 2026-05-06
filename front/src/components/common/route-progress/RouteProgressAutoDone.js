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
    done();
  }, [pathname, searchParams, visible, done]);

  return null;
}