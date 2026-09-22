"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { elapsedSessionMs, formatStopwatch, restPhase, restRemainingMs, formatCountdown, speakDuration } from "@/lib/logic/timer";
import { useNow } from "@/lib/hooks/use-now";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useActiveSession } from "@/lib/session-context";
import { markSessionEntry } from "@/lib/session-entry";
import { cn } from "@/lib/utils";

/**
 * `SessionBar` — §4.12.
 *
 * Il ponte che rende la sessione minimizzabile senza perderla: finche' esiste, la
 * sessione non e' finita. Non e' nel DOM quando non c'e' una sessione attiva, e non
 * compare dentro `/sessione` (li' la sessione e' gia' davanti).
 */
export function SessionBar() {
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
        // dentro il rail la barra sta in fondo e **sopra** la nav: stesso strato, ma
        // viene dopo nel DOM, quindi vince senza inventare uno z-index nuovo
        "lg:inset-x-auto lg:bottom-0 lg:left-0 lg:h-16 lg:w-60 lg:border-r lg:z-[var(--z-nav)]",
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
