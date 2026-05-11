"use client";

import { useEffect } from "react";
import { useRouteProgress } from "./route-progress/RouteProgressProvider";

export default function RouteProgressDoneOnDataReady({ ready }) {
  const { visible, done } = useRouteProgress();

  useEffect(() => {
    if (!visible) return;
    if (!ready) return;

    done();
  }, [visible, ready, done]);

  return null;
}