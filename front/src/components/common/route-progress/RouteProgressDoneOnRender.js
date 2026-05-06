"use client";

import { useEffect } from "react";
import { useRouteProgress } from "./RouteProgressProvider";

export default function RouteProgressDoneOnRender() {
  const { done } = useRouteProgress();

  useEffect(() => {
    done();
  }, [done]);

  return null;
}