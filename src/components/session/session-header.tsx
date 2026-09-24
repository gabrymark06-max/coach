"use client";

import { ChevronDown, MoreVertical, Pause } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Session } from "@/lib/db/schema";
import { formatVolume } from "@/lib/format";
import { elapsedSessionMs, formatStopwatch } from "@/lib/logic/timer";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";

/**
 * `SessionHeader` — §4.3.
 *
 * Il cronometro si ricalcola da `startedAt`; il volume **non anima** (un contatore
 * animato, a tre secondi di sguardo, e' solo rumore) e non si annuncia.
 * In SSR il cronometro e' `--:--:--`: stessa larghezza, niente mismatch e niente CLS.
 */
export function SessionHeader({
  session,
  onMinimize,
  onFinish,
  onDiscard,
  showRpe,
  onToggleRpe,
  saveError,
  onRetrySave,
}: {
  session: Session;
  onMinimize: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  showRpe: boolean;
  onToggleRpe: () => void;
  saveError: string | null;
  onRetrySave: () => void;
}) {
  const now = useNow(1000, true);
  const paused = Boolean(session.pausedAt);
  const elapsed = now === 0 ? 0 : elapsedSessionMs(session, now);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--border)] bg-[var(--card)]">
      {/*
        Sotto i 320px CSS — cioe' un telefono a 375 con lo zoom al 200% — i due tasti
        da 48, il titolo e `TERMINA` non stanno su una riga sola: la riga sborda e
        compare lo scroll orizzontale (QA, secondo audit, DIFETTO 6). Invece di
        stringere i bersagli sotto i 44px, la riga **va a capo** e `TERMINA` prende
        tutta la larghezza: e' il riflusso che WCAG 1.4.10 chiede, applicato anche
        sotto la soglia che obbliga a farlo.
      */}
      <div className="app-container flex min-h-[72px] flex-wrap items-center gap-3 py-3 max-[319px]:justify-center">
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Riduci la sessione e torna indietro"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <ChevronDown aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          {/*
            QA GRAVE 5 — l'`h1` di `/sessione`. Il nome della routine e' il titolo di
            questa pagina: era un `<p>`, e la rotta su cui si passa tutto il tempo era
            l'unica senza un punto di riferimento per uno screen reader. Il livello
            cambia, la misura no — i nomi degli esercizi restano `h2` (§4.2) e la
            gerarchia non salta.
          */}
          <h1 className="truncate text-sm font-normal tracking-normal text-[var(--text-secondary)]">
            {session.routineName ?? "Sessione libera"}
          </h1>
          <p className="flex items-baseline justify-center gap-3">
            <span
              className={cn(
                "text-display tnum",
                paused ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]",
              )}
            >
              {now === 0 ? "--:--:--" : formatStopwatch(elapsed)}
            </span>
            <span aria-live="off" className="text-num-md tnum text-[var(--text-secondary)]">
              {formatVolume(session.totalVolumeKg)}
              <span className="text-[var(--text-muted)]"> kg</span>
            </span>
          </p>
          {paused ? (
            <p className="flex items-center justify-center gap-1 text-label text-[var(--text-muted)]">
              <Pause aria-hidden="true" className="size-4" strokeWidth={1.75} />
              In pausa
            </p>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Altre azioni della sessione"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <MoreVertical aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onToggleRpe}>
              {showRpe ? "Nascondi la colonna RPE" : "Mostra la colonna RPE"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDiscard}>
              Scarta l&apos;allenamento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={onFinish} className="shrink-0 px-4 max-[319px]:w-full">
          TERMINA
        </Button>
      </div>

      {saveError ? (
        <div
          role="alert"
          className="app-container flex flex-wrap items-center gap-3 border-t border-[var(--danger-fill)] py-3"
        >
          <p className="min-w-0 flex-1 text-sm text-[var(--danger)]">
            Sessione non salvata sul dispositivo. I dati sono ancora in memoria.
          </p>
          <Button variant="secondary" onClick={onRetrySave}>
            Riprova
          </Button>
        </div>
      ) : null}
    </header>
  );
}
