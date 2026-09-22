"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type * as React from "react";
import { RestTimerPill } from "@/components/session/rest-timer-pill";
import { SessionProvider } from "@/lib/session-context";
import { AppToaster } from "./app-toaster";
import { BackupNudge } from "./backup-nudge";
import { OnboardingSheet } from "./onboarding-sheet";
import { SessionBar } from "./session-bar";

/**
 * Tutto cio' che deve esistere a prescindere dalla rotta: la sessione attiva condivisa,
 * la barra "sessione in corso", la pill del timer (che sopravvive al cambio di tab,
 * design system 6.2), i toast, e i due avvisi di §5.1 — quello del primo avvio e il
 * promemoria del backup.
 *
 * `SerwistProvider` registra il service worker: da li' in poi l'app si apre senza rete.
 * `reloadOnOnline` e' **spento** di proposito — un ricaricamento automatico quando torna
 * la connessione, con una sessione aperta e la tastiera sul campo dei chili, e' l'ultima
 * cosa che si vuole in palestra.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      reloadOnOnline={false}
      disable={process.env.NODE_ENV === "development"}
    >
      <SessionProvider>
        {children}
        <SessionBar />
        <RestTimerPill />
        <AppToaster />
        <OnboardingSheet />
        <BackupNudge />
      </SessionProvider>
    </SerwistProvider>
  );
}
