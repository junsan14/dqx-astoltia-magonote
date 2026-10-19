"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { updateSearchQuery } from "@/lib/searchQuery.mjs";

export default function useSearchQuery() {
  const searchParams = useSearchParams();
  const updateQuery = useCallback((changes) => {
    const nextUrl = updateSearchQuery(window.location.href, changes);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      // Next's native History integration updates useSearchParams without a
      // server navigation, scroll reset, or a history entry per keystroke.
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);
  return [searchParams, updateQuery];
}
