"use client";

import { Link } from "@/i18n/navigation";
import { useRouteProgress } from "@/components/common/route-progress/RouteProgressProvider";

export default function ProgressIntlLink({ onClick, target, href, ...props }) {
  const { start } = useRouteProgress();

  return (
    <Link
      href={href}
      target={target}
      {...props}
      onClick={(e) => {
        onClick?.(e);

        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (target === "_blank") return;

        start();
      }}
    />
  );
}