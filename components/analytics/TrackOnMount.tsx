"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

/** Records a page view on each public-page navigation. */
export function PageView() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) track({ event: "page_viewed", properties: { path: pathname } });
  }, [pathname]);
  return null;
}

/** Records that a candidate opened a finished debrief. */
export function DebriefViewed({ mode, sessionId }: { mode: string; sessionId: string }) {
  useEffect(() => {
    track({ event: "debrief_viewed", properties: { mode, session_id: sessionId } });
  }, [mode, sessionId]);
  return null;
}
