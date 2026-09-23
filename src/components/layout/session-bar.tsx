"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { elapsedSessionMs, formatStopwatch, restPhase, restRemainingMs, formatCountdown, speakDuration } from "@/lib/logic/timer";
import { useNow } from "@/lib/hooks/use-now";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useActiveSession } from "@/lib/session-context";
import { markSessionEntry } from "@/lib/session-entry";
import { cn } from "@/lib/utils";

/**
 * `SessionBar` — §4.12, nella versione **telefono**: fissa sopra la bottom nav.
 *
 * Il ponte che rende la sessione minimizzabile senza perderla: finche' esiste, la
 * sessione non e' finita. Non e' nel DOM quando non c'e' una sessione attiva, e non
 * compare dentro `/sessione` (li' la sessione e' gia' davanti).
 *
 * Da 1024px in su questa non si monta: al suo posto c'e' `SidebarSessionBar` (§4.19.5),
 * che vive dentro la sidebar. Due barre insieme sarebbero due richiami alla stessa
 * azione sullo stesso schermo.
 */
export function SessionBar() {
  const pathname = usePathname();
  const desktop = useIsDesktop();
  const { data: session, status } = useActiveSession();
  const now = useNow(1000, status === "ready" && Boolean(session));
  const reduced = useReducedMotion();

  if (status !== "ready" || !session) return null;
  if (pathname.startsWith("/sessione")) return null;
  if (desktop) return null;

  const elapsed = now === 0 ? 0 : elapsedSessionMs(session, now);
  const rest = {
    startedAt: session.restStartedAt,
    durationSec: session.restDurationSec,
    pausedAt: session.restPausedAt,
    pausedMs: session.restPausedMs ?? 0,
  };
  const phase = now === 0 ? "idle" : restPhase(rest, now);
  const resting = phase === "running" || phase === "warning" || phase === "paused";
  const remaining = restRemainingMs(rest, now) ?? 0;

  const clock = now === 0 ? "--:--" : formatStopwatch(elapsed);
  const current = session.exercises.find((exercise) =>
    exercise.sets.some((set) => !set.completed),
  );

  const label = resting
    ? `Riprendi l'allenamento in corso. Recupero, ${speakDuration(remaining)} rimanenti.`
    : `Riprendi l'allenamento in corso, ${speakDuration(elapsed)}`;

  return (
    <Link
      href="/sessione"
      onClick={markSessionEntry}
      aria-label={label}
      className={cn(
        "fixed inset-x-0 z-[var(--z-session-bar)] flex h-12 items-center gap-3",
        "bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))]",
        "border-t border-[var(--border-strong)] bg-[var(--popover)] px-5 shadow-[var(--elev-2)]",
        "transition-[background-color,transform] duration-[var(--dur-1)] ease-[var(--ease-tap)]",
        "hover:bg-[var(--surface-hover)] active:scale-[0.99] motion-reduce:active:scale-100",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          resting ? "bg-[var(--pr)]" : "bg-[var(--blue-brand)]",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          resting ? "bg-[var(--pr)]" : "bg-[var(--blue-brand)]",
        )}
        style={reduced ? undefined : { animation: "lifted-dot 2s ease-in-out infinite" }}
      />
      <span aria-hidden="true" className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
        {resting ? (
          <>
            Recupero · <span className="tnum">{formatCountdown(remaining)}</span>
          </>
        ) : (
          <>
            Sessione in corso · <span className="tnum">{clock}</span>
            {current ? ` · ${current.exerciseName}` : null}
          </>
        )}
      </span>
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--accent-blue)]"
      >
        Riprendi
        <ChevronRight className="size-5" strokeWidth={1.75} />
      </span>
    </Link>
  );
}

/**
 * `SidebarSessionBar` — §4.19.5.
 *
 * La stessa informazione della `SessionBar`, nella forma che la colonna di sinistra
 * permette: due righe in `--sidebar-foot-h`, larghezza piena, sopra il blocco stato
 * locale. Non e' `fixed`: e' dentro il flusso della sidebar, quindi non copre niente.
 *
 * Si monta solo da 1024 in su (lo decide la `Sidebar`, che esiste solo li') e mai
 * dentro `/sessione`.
 */
export function SidebarSessionBar() {
  const pathname = usePathname();
  const { data: session, status } = useActiveSession();
  const now = useNow(1000, status === "ready" && Boolean(session));
  const reduced = useReducedMotion();

  if (status !== "ready" || !session) return null;
  if (pathname.startsWith("/sessione")) return null;

  const elapsed = now === 0 ? 0 : elapsedSessionMs(session, now);
  const rest = {
    startedAt: session.restStartedAt,
    durationSec: session.restDurationSec,
    pausedAt: session.restPausedAt,
    pausedMs: session.restPausedMs ?? 0,
  };
  const phase = now === 0 ? "idle" : restPhase(rest, now);
  const resting = phase === "running" || phase === "warning" || phase === "paused";
  const remaining = restRemainingMs(rest, now) ?? 0;
  const current = session.exercises.find((exercise) =>
    exercise.sets.some((set) => !set.completed),
  );

  return (
    <Link
      href="/sessione"
      onClick={markSessionEntry}
      aria-label={
        resting
          ? `Riprendi l'allenamento in corso. Recupero, ${speakDuration(remaining)} rimanenti.`
          : `Riprendi l'allenamento in corso, ${speakDuration(elapsed)}`
      }
      className={cn(
        "relative mt-3 flex min-h-[var(--sidebar-foot-h)] flex-col justify-center gap-0.5",
        "overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-strong)]",
        "bg-[var(--popover)] px-4 pl-5",
        "transition-[background-color] duration-[var(--dur-1)] ease-[var(--ease-out)]",
        "hover:bg-[var(--surface-hover)]",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          resting ? "bg-[var(--pr)]" : "bg-[var(--blue-brand)]",
        )}
      />
      <span aria-hidden="true" className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            resting ? "bg-[var(--pr)]" : "bg-[var(--blue-brand)]",
          )}
          style={reduced ? undefined : { animation: "lifted-dot 2s ease-in-out infinite" }}
        />
        <span className="text-sm text-[var(--text-primary)]">
          {resting ? "Recupero" : "Sessione in corso"}
        </span>
      </span>
      <span aria-hidden="true" className="truncate text-sm text-[var(--text-secondary)]">
        <span className="tnum">
          {resting
            ? formatCountdown(remaining)
            : now === 0
              ? "--:--"
              : formatStopwatch(elapsed)}
        </span>
        {current ? ` · ${current.exerciseName}` : null}
      </span>
    </Link>
  );
}
