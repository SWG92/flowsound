"use client";

import { useKeyboard } from "@/hooks/use-keyboard";

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  useKeyboard();
  return <>{children}</>;
}

