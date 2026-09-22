"use client";

import type * as React from "react";
import { RestTimerPill } from "@/components/session/rest-timer-pill";
import { SessionProvider } from "@/lib/session-context";
import { AppToaster } from "./app-toaster";
import { SessionBar } from "./session-bar";

/**
 * Tutto cio' che deve esistere a prescindere dalla rotta: la sessione attiva condivisa,
 * la barra "sessione in corso", la pill del timer (che sopravvive al cambio di tab,
 * design system 6.2) e i toast.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <SessionBar />
      <RestTimerPill />
      <AppToaster />
    </SessionProvider>
  );
}
