"use client";

import { MoreVertical, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb } from "@/lib/db/db";
import {
  ActiveSessionExistsError,
  deleteSession,
  routineFromSession,
  startSession,
} from "@/lib/db/mutations";
import { MUSCLE_GROUP_LABEL, type Session } from "@/lib/db/schema";
import { formatDay, formatRelativeDay, formatVolumeKg } from "@/lib/format";
import { useMounted } from "@/lib/hooks/use-now";
import { formatMinutes } from "@/lib/logic/timer";
import { markSessionEntry } from "@/lib/session-entry";
import { cn } from "@/lib/utils";

const VISIBILI = 3;

export interface FeedCardData {
  session: Session;
  prCount: number;
  /** id degli esercizi in cui e' caduto un record, per la corsia della riga */
  prExerciseIds: Set<string>;
  /** iniziali del gruppo muscolare, per il quadratino 40x40 */
  muscleByExerciseId: Map<string, keyof typeof MUSCLE_GROUP_LABEL>;
}

/**
 * `WorkoutFeedCard` — §4.21. La card del riferimento, spogliata di tutto cio' che e'
 * sociale.
 *
 * Le tre differenze dal riferimento, e perche':
 *  1. **niente intestazione avatar + username** — in un'app a un solo utente ripetere
 *     il proprio nome su ogni card e' rumore, e l'avatar e' un cerchio colorato che non
 *     dice niente. Al loro posto il nome dell'allenamento e la data;
 *  2. **niente piede sociale** — la card finisce con l'elenco esercizi. Nessun like,
 *     nessun campo commento, nessuna condivisione;
 *  3. **niente miniature fotografiche** — §11.6 vieta le immagini raster; al loro posto
 *     il quadratino 40x40 con l'iniziale del gruppo muscolare gia' definito in §4.8.
 *
 * E il conteggio dei record e' `Trophy` + numero + la parola, **mai** l'emoji della
 * medaglia del riferimento.
 */
export function WorkoutFeedCard({ data }: { data: FeedCardData }) {
  const { session, prCount, prExerciseIds, muscleByExerciseId } = data;
  const router = useRouter();
  const mounted = useMounted();
  const [espansa, setEspansa] = React.useState(false);

  const esercizi = session.exercises;
  const nascosti = Math.max(0, esercizi.length - VISIBILI);
  const mostrati = espansa ? esercizi : esercizi.slice(0, VISIBILI);

  const dataBreve = mounted ? formatDay(session.startedAt) : "";

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="min-w-0 truncate text-h3">
            <Link
              href={`/profilo/sessione/${session.id}`}
              className={cn(
                "rounded-[var(--radius-sm)] text-[var(--text-primary)]",
                "hover:bg-[var(--surface-hover)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
              )}
            >
              {session.routineName ?? "Sessione libera"}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {mounted ? formatRelativeDay(session.startedAt) : "—"}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Azioni per ${session.routineName ?? "Sessione libera"} del ${dataBreve}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <MoreVertical aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => router.push(`/profilo/sessione/${session.id}`)}
            >
              Apri il dettaglio
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void (async () => {
                  try {
                    await startSession(getDb(), { fromSessionId: session.id });
                    markSessionEntry();
                    router.push("/sessione");
                  } catch (error) {
                    if (error instanceof ActiveSessionExistsError) {
                      toast.error("C'è già un allenamento in corso.");
                      return;
                    }
                    toast.error("Non riesco ad avviare l'allenamento.");
                  }
                })();
              }}
            >
              Ripeti come sessione
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void (async () => {
                  const routine = await routineFromSession(getDb(), session.id);
                  if (routine) toast.success(`Routine «${routine.name}» creata`);
                })();
              }}
            >
              Salva come routine
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={() => {
                void (async () => {
                  await deleteSession(getDb(), session.id);
                  toast.success("Allenamento eliminato");
                })();
              }}
            >
              Elimina allenamento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <hr className="my-4 border-t border-[var(--border)]" />

      {/* il blocco metriche: etichetta sopra, valore sotto, tre celle in griglia */}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-label text-[var(--text-secondary)]">Durata</dt>
          <dd className="tnum mt-0.5 text-num-md text-[var(--text-primary)]">
            {formatMinutes(session.durationSec * 1000)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-label text-[var(--text-secondary)]">Volume</dt>
          <dd className="tnum mt-0.5 truncate text-num-md text-[var(--text-primary)]">
            {formatVolumeKg(session.totalVolumeKg)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-label text-[var(--text-secondary)]">Record</dt>
          <dd className="mt-0.5 flex items-center gap-1">
            {prCount > 0 ? (
              <>
                <Trophy
                  aria-hidden="true"
                  className="size-4 shrink-0 text-[var(--pr)]"
                  strokeWidth={1.75}
                />
                <span className="tnum text-num-md text-[var(--pr)]">{prCount}</span>
              </>
            ) : (
              /* zero record non si scrive «0»: si tace, e lo si dice a chi ascolta */
              <span
                className="text-num-md text-[var(--text-disabled)]"
                aria-label="Nessun record in questo allenamento"
              >
                —
              </span>
            )}
          </dd>
        </div>
      </dl>

      <hr className="my-4 border-t border-[var(--border)]" />

      <ul className="flex flex-col">
        {mostrati.map((exercise) => {
          const tutteComplete =
            exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);
          const haPr = prExerciseIds.has(exercise.exerciseId);
          const muscolo = muscleByExerciseId.get(exercise.exerciseId);
          return (
            <li
              key={exercise.id}
              className="relative flex min-h-10 items-center gap-3 py-1 pl-4"
            >
              {/* la corsia: piena blu se tutto completato, ambra se c'e' un record */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-1 left-0 w-[3px] rounded-[var(--radius-xs)]",
                  haPr
                    ? "bg-[var(--pr)]"
                    : tutteComplete
                      ? "bg-[var(--blue-brand)]"
                      : "bg-transparent",
                )}
              />
              <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--popover)] text-label text-[var(--text-secondary)]"
              >
                {muscolo ? MUSCLE_GROUP_LABEL[muscolo].slice(0, 2) : "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-base text-[var(--text-primary)]">
                <span className="tnum text-num-md">{exercise.sets.length}</span>
                {" × "}
                {exercise.exerciseName}
              </span>
            </li>
          );
        })}
      </ul>

      {nascosti > 0 ? (
        <button
          type="button"
          aria-expanded={espansa}
          onClick={() => setEspansa((value) => !value)}
          className={cn(
            "mt-2 h-11 w-full rounded-[var(--radius-sm)] text-left text-sm font-semibold",
            "text-[var(--accent-blue)] hover:bg-[var(--surface-hover)]",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
          )}
        >
          {espansa
            ? "Mostra meno"
            : `Visualizza altri ${nascosti} ${nascosti === 1 ? "esercizio" : "esercizi"}`}
        </button>
      ) : null}
    </article>
  );
}

/**
 * Lo scheletro della card: **il blocco metriche e' gia' disegnato**, quindi quando il
 * dato arriva non si sposta niente (CLS 0). Solo al primo mount.
 */
export function WorkoutFeedCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
    >
      <Skeleton className="h-6 w-40 rounded-[var(--radius-sm)]" />
      <Skeleton className="mt-2 h-5 w-24 rounded-[var(--radius-sm)]" />
      <hr className="my-4 border-t border-[var(--border)]" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((cell) => (
          <div key={cell}>
            <Skeleton className="h-4 w-16 rounded-[var(--radius-sm)]" />
            <Skeleton className="mt-1 h-6 w-20 rounded-[var(--radius-sm)]" />
          </div>
        ))}
      </div>
      <hr className="my-4 border-t border-[var(--border)]" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-10 w-full rounded-[var(--radius-sm)]" />
        ))}
      </div>
    </div>
  );
}
