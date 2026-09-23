"use client";

import { Minus, Pause, Plus, VolumeX, X } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { isAudioBlocked, playRestEndTone, unlockAudio, vibrate } from "@/lib/audio";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import { adjustRest, stopRest, toggleRestPause } from "@/lib/db/mutations";
import { useNow } from "@/lib/hooks/use-now";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  formatCountdown,
  restPhase,
  restRemainingMs,
  speakDuration,
} from "@/lib/logic/timer";
import { useActiveSession, useSettings } from "@/lib/session-context";
import { cn } from "@/lib/utils";

/**
 * `RestTimerPill` — §4.4.
 *
 * Fluttua sopra tutto e **sopravvive al cambio di tab**: e' montata nel layout root, non
 * dentro `/sessione`. Il conto alla rovescia si ricalcola da `restStartedAt` contro
 * `Date.now()`; il tick di 1s serve solo a ridisegnare.
 */
export function RestTimerPill() {
  const pathname = usePathname();
  const { data: session, status } = useActiveSession();
  const settings = useSettings();
  const reduced = useReducedMotion();

  const hasTimer = Boolean(session?.restStartedAt);
  const now = useNow(250, hasTimer);

  // Nessuno stato per l'audio: `isAudioBlocked()` e' una lettura pura del contesto
  // gia' creato e si valuta in render. Questo serve solo a ridisegnare dopo lo sblocco,
  // che avviene in un gestore di evento e non in un effetto.
  const [, redraw] = React.useReducer((value: number) => value + 1, 0);
  const firedFor = React.useRef<string | null>(null);
  const announced10 = React.useRef<string | null>(null);

  const snapshot = React.useMemo(
    () => ({
      startedAt: session?.restStartedAt ?? null,
      durationSec: session?.restDurationSec ?? null,
      pausedAt: session?.restPausedAt ?? null,
      pausedMs: session?.restPausedMs ?? 0,
    }),
    [session?.restStartedAt, session?.restDurationSec, session?.restPausedAt, session?.restPausedMs],
  );

  const remaining = now === 0 ? null : restRemainingMs(snapshot, now);
  const phase = now === 0 ? "idle" : restPhase(snapshot, now);
  const key = session?.restStartedAt ?? null;

  // Avviso di fine: suono + vibrazione, una volta sola per timer.
  React.useEffect(() => {
    if (phase !== "expired" || !key || firedFor.current === key) return;
    firedFor.current = key;
    if (settings.soundEnabled) playRestEndTone();
    if (settings.vibrationEnabled) vibrate([120, 60, 120]);
    announce("timer", "Recupero terminato.");
  }, [phase, key, settings.soundEnabled, settings.vibrationEnabled]);

  // "10 secondi", una volta sola.
  React.useEffect(() => {
    if (phase !== "warning" || !key || announced10.current === key) return;
    announced10.current = key;
    announce("timer", "10 secondi.");
  }, [phase, key]);

  // La pill scaduta si chiude da sola dopo 3 secondi (§4.4).
  React.useEffect(() => {
    if (phase !== "expired") return;
    const id = window.setTimeout(() => {
      void stopRest(getDb());
    }, 3000);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (status !== "ready" || !session || !hasTimer || remaining === null) return null;
  if (phase === "idle") return null;

  const duration = (session.restDurationSec ?? 1) * 1000;
  const progress = Math.max(0, Math.min(1, remaining / duration));
  const expired = phase === "expired";
  const warning = phase === "warning";
  const paused = phase === "paused";
  const onSessionPage = pathname.startsWith("/sessione");
  const audioBlocked = settings.soundEnabled && expired && isAudioBlocked();

  const adjust = async (deltaSec: number) => {
    unlockAudio();
    const next = await adjustRest(getDb(), deltaSec);
    if (next) {
      const left = restRemainingMs(
        {
          startedAt: next.restStartedAt,
          durationSec: next.restDurationSec,
          pausedAt: next.restPausedAt,
          pausedMs: next.restPausedMs ?? 0,
        },
        Date.now(),
      );
      announce("timer", `Recupero, ${speakDuration(left ?? 0)}.`);
    }
  };

  return (
    <div
      className={cn(
        "fixed left-1/2 z-[var(--z-timer)] w-[calc(100%-var(--space-5)*2)] max-w-[420px] -translate-x-1/2",
        "flex h-16 items-center gap-3 rounded-full border px-2",
        "bg-[var(--popover)]",
        onSessionPage
          ? "bottom-[calc(env(safe-area-inset-bottom)+var(--space-5))]"
          : "bottom-[calc(var(--nav-h)+var(--session-bar-h)+env(safe-area-inset-bottom)+var(--space-4))]",
        "lg:left-auto lg:right-9 lg:w-90 lg:translate-x-0 lg:bottom-9",
        expired
          ? "border-[var(--pr)] bg-[var(--pr-surface)] shadow-[var(--elev-2)]"
          : warning
            ? "border-[var(--pr)] shadow-[var(--elev-2)]"
            : "border-[var(--border-strong)] shadow-[var(--glow-timer)]",
      )}
      style={
        warning && !reduced
          ? { animation: "lifted-pulse 900ms ease-in-out infinite", transformOrigin: "center" }
          : undefined
      }
    >
      {expired ? (
        <>
          <p className="flex-1 pl-4 text-base font-semibold text-[var(--pr)]">
            Recupero terminato
          </p>
          <button
            type="button"
            aria-label="Chiudi l'avviso di fine recupero"
            onClick={() => void stopRest(getDb())}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <X aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            aria-label="Togli 15 secondi al recupero"
            onClick={() => void adjust(-15)}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] transition-transform duration-[var(--dur-1)] ease-[var(--ease-tap)] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <Minus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => void toggleRestPause(getDb())}
            aria-label={
              paused
                ? "Riprendi il recupero"
                : `Metti in pausa il recupero, ${speakDuration(remaining)} rimanenti`
            }
            /*
              QA MINORE 5: era alto 42px. §8.7 chiede 48 dentro `/sessione`, ed e' il
              controllo che si tocca con le mani sudate fra una serie e l'altra.
            */
            className="flex min-h-[var(--tap-gym)] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <span className="flex items-center gap-2">
              {paused ? (
                <Pause aria-hidden="true" className="size-5 text-[var(--text-muted)]" strokeWidth={1.75} />
              ) : null}
              <span
                role="timer"
                aria-live="off"
                className={cn(
                  "text-display tnum leading-none",
                  paused
                    ? "text-[var(--text-muted)]"
                    : warning
                      ? "text-[var(--pr)]"
                      : "text-[var(--text-primary)]",
                )}
              >
                {formatCountdown(remaining)}
              </span>
            </span>
            <span className="text-label text-[var(--text-secondary)]">
              {paused ? "In pausa" : warning ? "Quasi" : "Recupero"}
            </span>
            <span
              aria-hidden="true"
              className="h-1 w-full overflow-hidden rounded-[var(--radius-xs)] bg-[var(--border)]"
            >
              <span
                className={cn(
                  "block h-full w-full origin-left rounded-[var(--radius-xs)]",
                  warning ? "bg-[var(--pr)]" : "bg-[var(--blue-brand)]",
                )}
                style={{
                  transform: `scaleX(${progress})`,
                  transition: reduced ? "none" : "transform 250ms linear",
                }}
              />
            </span>
          </button>

          <button
            type="button"
            aria-label="Aggiungi 15 secondi al recupero"
            onClick={() => void adjust(15)}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] transition-transform duration-[var(--dur-1)] ease-[var(--ease-tap)] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            aria-label="Salta il recupero"
            onClick={() => void stopRest(getDb())}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <X aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </button>
        </>
      )}

      {audioBlocked ? (
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            redraw();
          }}
          className="absolute -top-9 left-1/2 flex h-8 -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--popover)] px-3 text-sm text-[var(--text-secondary)]"
        >
          <VolumeX aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Audio non attivo — tocca per attivarlo
        </button>
      ) : null}
    </div>
  );
}
