"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNavHistory } from "@/lib/nav-history";

/** 监听路由变化，自动记录到导航历史栈 */
export function useNavTracker() {
  const pathname = usePathname();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevRef.current && prevRef.current !== pathname) {
      useNavHistory.getState().push(pathname);
    }
    if (!prevRef.current) {
      useNavHistory.getState().push(pathname);
    }
    prevRef.current = pathname;
  }, [pathname]);
}
