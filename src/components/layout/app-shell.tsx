"use client";

import type * as React from "react";
import { BottomNav } from "./bottom-nav";
import { useActiveSession } from "@/lib/session-context";
import { cn } from "@/lib/utils";

/**
 * Guscio delle cinque tab. Il `<main>` somma alla propria imbottitura l'altezza della
 * nav e, quando c'e', quella della `SessionBar`: il contenuto non finisce mai sotto (§4.11).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useActiveSession();
  const hasSession = status === "ready" && Boolean(session);

  return (
    <div className={cn("min-h-dvh lg:pl-60")}>
      <main
        id="contenuto"
        tabIndex={-1}
        data-session={hasSession ? "true" : "false"}
        className="app-main"
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
