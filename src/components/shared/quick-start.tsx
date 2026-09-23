"use client";

import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { unlockAudio } from "@/lib/audio";
import { getDb } from "@/lib/db/db";
import { ActiveSessionExistsError, startSession } from "@/lib/db/mutations";
import type { Routine } from "@/lib/db/schema";
import { useNow } from "@/lib/hooks/use-now";
import { elapsedSessionMs, formatStopwatch } from "@/lib/logic/timer";
import { markSessionEntry } from "@/lib/session-entry";
import { useActiveSession } from "@/lib/session-context";
import { cn } from "@/lib/utils";

/**
 * `QuickStart` — §4.6, in due taglie.
 *
 * E' **lo stesso componente** su `/home` e su `/allenamento`, non due che si somigliano.
 * La duplicazione dell'azione primaria su due schermate e' voluta: e' l'azione primaria
 * dell'app intera, e il percorso critico di §6.2 (due tocchi dall'apertura al primo
 * campo) non si tocca.
 *
 * Nella taglia `compact` l'azione secondaria mostra **il nome dell'ultima routine
 * usata** invece del generico «Scegli una routine» (§6.7): chi parte sempre dalla stessa
 * routine torna a due tocchi anche aprendo la home.
 */
export function QuickStart({
  size = "full",
  lastRoutine,
}: {
  size?: "full" | "compact";
  lastRoutine?: Routine | null;
}) {
  const router = useRouter();
  const { data: session, status } = useActiveSession();
  const active = status === "ready" ? session : undefined;
  const now = useNow(1000, Boolean(active));

  const start = async () => {
    // il gesto che avvia la sessione e' anche quello che sblocca l'audio del timer
    unlockAudio();
    try {
      await startSession(getDb());
      markSessionEntry();
      router.push("/sessione");
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        toast.error("C'è già un allenamento in corso.", {
          action: {
            label: "Riprendi",
            onClick: () => {
              markSessionEntry();
              router.push("/sessione");
            },
          },
        });
        return;
      }
      toast.error("Non riesco ad avviare l'allenamento su questo dispositivo.");
    }
  };

  if (status === "loading") {
    // Stesso guscio della card, non un rettangolo di altezza indovinata: e' cosi' che
    // il CLS di questa schermata va a zero.
    return (
      <section
        aria-hidden="true"
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
      >
        <Skeleton className="h-6 w-40 rounded-[var(--radius-sm)]" />
        <div className="mt-4">
          <Skeleton className="h-14 w-full rounded-[var(--radius-btn)]" />
        </div>
        <Skeleton className="mt-3 h-5 w-52 rounded-[var(--radius-sm)]" />
      </section>
    );
  }

  const compact = size === "compact";

  return (
    <section
      aria-labelledby="titolo-quickstart"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
    >
      <h2
        id="titolo-quickstart"
        className={cn("text-h3 text-[var(--text-primary)]", compact && "sr-only")}
      >
        Inizia ad allenarti
      </h2>

      <div className={cn(compact ? "flex flex-col gap-3 sm:flex-row" : "mt-4")}>
        {active ? (
          <Button variant="secondary" size="lg" block asChild>
            <Link href="/sessione" onClick={markSessionEntry}>
              Riprendi sessione ·{" "}
              <span className="tnum">
                {now === 0 ? "--:--:--" : formatStopwatch(elapsedSessionMs(active, now))}
              </span>
            </Link>
          </Button>
        ) : (
          <Button size="lg" block onClick={() => void start()}>
            <Play aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Avvia allenamento
          </Button>
        )}

        {compact && !active ? (
          <Button variant="secondary" size="lg" block asChild>
            <Link href={lastRoutine ? `/allenamento/routine/${lastRoutine.id}` : "/allenamento"}>
              <span className="min-w-0 truncate">
                {lastRoutine ? `Riprendi ${lastRoutine.name}` : "Scegli una routine"}
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
            </Link>
          </Button>
        ) : null}
      </div>

      {compact ? null : (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {active
            ? "L'allenamento continua finché non lo termini."
            : "Oppure scegli una routine."}
        </p>
      )}
    </section>
  );
}
