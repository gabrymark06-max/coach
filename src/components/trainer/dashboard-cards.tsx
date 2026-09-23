"use client";

import { CalendarX, ChevronRight, Moon, Pause, Play, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unlockAudio } from "@/lib/audio";
import { getDb } from "@/lib/db/db";
import { ActiveSessionExistsError, startSession } from "@/lib/db/mutations";
import type {
  ProgressionDecision,
  TrainerDay,
  TrainerProgram,
  TrainerWeek,
} from "@/lib/db/trainer-schema";
import { formatDay, formatShortWeekdayDay, formatVolumeKg } from "@/lib/format";
import { formatMinutes } from "@/lib/logic/timer";
import { markSessionEntry } from "@/lib/session-entry";
import { weekState, type ProgramClock } from "@/lib/trainer/clock";
import { cn } from "@/lib/utils";
import { DayExercises, daySummary } from "./day-exercises";

/**
 * Le card della dashboard — §4.24.
 *
 * La tabella degli stati di §4.24 e' implementata **letteralmente**: ogni riga di
 * quella tabella e' un componente qui dentro, e `/trainer` si limita a scegliere quale
 * montare. Una schermata che «non sa cosa dire» e' una schermata che manca uno stato.
 */

const CARD =
  "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--elev-1)]";

/** Il pulsante che avvia l'allenamento del giorno. Un tocco, come da percorso A §6.2. */
export function StartDayButton({ day, label = "Avvia l'allenamento" }: { day: TrainerDay; label?: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = React.useState(false);

  const avvia = async () => {
    // Doppio tocco: il pulsante si spegne al primo. Due sessioni per un giorno solo
    // sarebbero due progressioni sullo stesso dato.
    if (inCorso) return;
    setInCorso(true);
    unlockAudio();
    try {
      await startSession(getDb(), { trainerDayId: day.id });
      markSessionEntry();
      router.push("/sessione");
    } catch (error) {
      setInCorso(false);
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

  return (
    <Button size="lg" block onClick={() => void avvia()} loading={inCorso} loadingLabel="Apro…">
      <Play aria-hidden="true" className="size-5" strokeWidth={1.75} />
      {label}
    </Button>
  );
}

/**
 * La card «Oggi» — la piu' importante della schermata. Corsia blu a sinistra, i primi
 * esercizi con il carico e la riga del perche', e un solo primario da 56px.
 */
export function TodayCard({
  week,
  day,
  decisions,
  today,
}: {
  week: TrainerWeek;
  day: TrainerDay;
  decisions: Map<string, ProgressionDecision>;
  today: string;
}) {
  return (
    <section
      aria-labelledby="titolo-oggi"
      className={cn(CARD, "relative overflow-hidden p-5 pl-6 md:p-6 md:pl-7")}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] bg-[var(--blue-brand)]"
      />
      <p className="text-label text-[var(--accent-blue)]">Oggi · {today}</p>
      <h2 id="titolo-oggi" className="mt-1 text-h2 text-[var(--text-primary)]">
        {day.name}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {daySummary(day)} · settimana {week.index}
      </p>

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <DayExercises day={day} decisions={decisions} limit={2} />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <StartDayButton day={day} />
        <Button variant="ghost" block asChild>
          <Link href={`/trainer/giorno/${day.id}`}>Vedi tutto il giorno</Link>
        </Button>
      </div>
    </section>
  );
}

/** «Oggi è riposo» — con il prossimo allenamento nominato, non un vuoto. */
export function RestCard({
  next,
}: {
  next: { week: TrainerWeek; day: TrainerDay } | null;
}) {
  return (
    <section aria-labelledby="titolo-oggi" className={cn(CARD, "p-5 md:p-6")}>
      <div className="flex items-start gap-3">
        <Moon
          aria-hidden="true"
          className="mt-0.5 size-6 shrink-0 text-[var(--text-secondary)]"
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <h2 id="titolo-oggi" className="text-h2 text-[var(--text-primary)]">
            Oggi è riposo
          </h2>
          {next ? (
            <p className="mt-1 text-base text-[var(--text-secondary)]">
              Il prossimo allenamento è{" "}
              <strong className="text-[var(--text-primary)]">
                {next.day.plannedFor ? formatDay(next.day.plannedFor) : "il prossimo previsto"}
              </strong>
              : {next.day.name}.
            </p>
          ) : (
            <p className="mt-1 text-base text-[var(--text-secondary)]">
              Non ci sono altri allenamenti in programma.
            </p>
          )}
        </div>
      </div>

      {next ? (
        <div className="mt-5">
          <StartDayButton day={next.day} label="Allenati lo stesso" />
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Anticipa il prossimo giorno: conta come quello, non come un allenamento in più.
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** «Fatto oggi» — il primario sparisce: non si propone di rifare cio' che è appena fatto. */
export function DoneCard({
  day,
  session,
}: {
  day: TrainerDay;
  session: { id: string; durationSec: number; totalVolumeKg: number; prCount: number } | null;
}) {
  return (
    <section aria-labelledby="titolo-oggi" className={cn(CARD, "p-5 md:p-6")}>
      <p className="text-label text-[var(--success)]">Fatto oggi</p>
      <h2 id="titolo-oggi" className="mt-1 text-h2 text-[var(--text-primary)]">
        {day.name}
      </h2>
      {session ? (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-label text-[var(--text-secondary)]">Durata</dt>
            <dd className="tnum text-num-md text-[var(--text-primary)]">
              {formatMinutes(session.durationSec * 1000)}
            </dd>
          </div>
          <div>
            <dt className="text-label text-[var(--text-secondary)]">Volume</dt>
            <dd className="tnum text-num-md text-[var(--text-primary)]">
              {formatVolumeKg(session.totalVolumeKg)}
            </dd>
          </div>
          <div>
            <dt className="text-label text-[var(--text-secondary)]">Record</dt>
            <dd className="flex items-center gap-2 text-num-md text-[var(--text-primary)]">
              <Trophy aria-hidden="true" className="size-4 text-[var(--pr)]" strokeWidth={1.75} />
              <span className="tnum">{session.prCount}</span>
            </dd>
          </div>
        </dl>
      ) : null}
      {session ? (
        <div className="mt-5">
          <Button variant="secondary" block asChild>
            <Link href={`/profilo/sessione/${session.id}`}>Vedi il riepilogo</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Il banner della settimana saltata — `role="status"`, **non** `role="alert"`: non e'
 * un'emergenza e non deve interrompere.
 *
 * Tre azioni, **nessuna preselezionata**, e la frase che toglie l'ansia: «Non tocco
 * niente finché non decidi». Dalla seconda settimana saltata si aggiunge la quarta,
 * che adatta il programma invece di insistere.
 */
export function SkippedWeekBanner({
  skippedWeeks,
  daysPerWeek,
  onRepeat,
  onAdvance,
  onRegenerate,
  onReduce,
  busy,
}: {
  skippedWeeks: number[];
  daysPerWeek: number;
  onRepeat: () => void;
  onAdvance: () => void;
  onRegenerate: () => void;
  onReduce: () => void;
  busy: boolean;
}) {
  const last = skippedWeeks[skippedWeeks.length - 1];
  const due = skippedWeeks.length >= 2;

  return (
    <section
      role="status"
      aria-labelledby="titolo-saltata"
      className="rounded-[var(--radius-lg)] border border-[var(--pr-border)] bg-[var(--pr-surface)] p-5"
    >
      <div className="flex items-start gap-3">
        <CalendarX
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--pr)]"
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <h2 id="titolo-saltata" className="text-h3 text-[var(--text-primary)]">
            {due
              ? `Hai saltato le settimane ${skippedWeeks.join(" e ")}.`
              : `Hai saltato la settimana ${last}: nessun allenamento registrato.`}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Non tocco niente finché non decidi.
          </p>
          {due ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {daysPerWeek} giorni non stanno entrando nella tua settimana. Posso adattare il
              programma invece di insistere.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Button variant="secondary" block onClick={onRepeat} disabled={busy}>
          Ripeti la settimana {last}
        </Button>
        <Button variant="secondary" block onClick={onAdvance} disabled={busy}>
          Vai alla settimana {last + 1}
        </Button>
        {due && daysPerWeek > 3 ? (
          <Button variant="secondary" block onClick={onReduce} disabled={busy}>
            Riduci a 3 giorni a settimana
          </Button>
        ) : null}
        <Button variant="ghost" block onClick={onRegenerate} disabled={busy}>
          Rigenera da qui
        </Button>
      </div>
    </section>
  );
}

/** Il banner neutro del programma in pausa. */
export function PausedBanner({ since, onResume }: { since?: string; onResume: () => void }) {
  return (
    <section
      role="status"
      aria-labelledby="titolo-pausa"
      className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--card)] p-5"
    >
      <div className="flex items-start gap-3">
        <Pause
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--text-secondary)]"
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <h2 id="titolo-pausa" className="text-h3 text-[var(--text-primary)]">
            Programma in pausa{since ? ` dal ${formatDay(since)}` : ""}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Non progredisce e non conta le settimane saltate.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <Button block onClick={onResume}>
          Riprendi
        </Button>
      </div>
    </section>
  );
}

const LANE: Record<string, string> = {
  completata: "bg-[var(--success)]",
  "in-corso": "bg-[var(--blue-brand)]",
  saltata: "bg-[var(--warning)]",
  ripetuta: "bg-[var(--accent-blue)]",
  futura: "bg-transparent",
};

const STATO_LABEL: Record<string, string> = {
  completata: "completata",
  "in-corso": "in corso",
  saltata: "saltata",
  ripetuta: "ripetuta",
  futura: "futura",
};

/**
 * L'accordion delle settimane. `<details>` nativo: si apre con la tastiera, si stampa
 * aperto, e non ha bisogno di una riga di JavaScript per esistere.
 */
export function WeeksAccordion({
  program,
  clock,
}: {
  program: TrainerProgram;
  clock: ProgramClock;
}) {
  return (
    <section aria-labelledby="titolo-settimane">
      <h2 id="titolo-settimane" className="text-h3 text-[var(--text-primary)]">
        Le settimane
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {program.weeks.map((week) => {
          const stato = weekState(program, week, clock);
          const fatti = week.days.filter((day) => day.status === "completata").length;
          return (
            <li key={week.index}>
              <details
                open={week.index === clock.derivedWeek}
                className={cn(CARD, "overflow-hidden")}
              >
                <summary
                  className={cn(
                    "relative flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 pr-4 pl-5",
                    "hover:bg-[var(--surface-hover)]",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("absolute inset-y-0 left-0 w-[3px]", LANE[stato])}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base text-[var(--text-primary)]">
                      Settimana {week.index}
                      {week.kind === "scarico" ? " · scarico" : ""}
                    </span>
                    <span className="block text-sm text-[var(--text-secondary)]">
                      {STATO_LABEL[stato]} · {fatti} di {week.days.length} fatti
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-[var(--text-muted)]"
                    strokeWidth={1.75}
                  />
                </summary>

                <ul className="border-t border-[var(--border)]">
                  {week.days.map((day) => (
                    <li key={day.id} className="border-t border-[var(--border)] first:border-t-0">
                      <Link
                        href={`/trainer/giorno/${day.id}`}
                        className={cn(
                          "flex min-h-12 items-center gap-3 px-5 py-2",
                          "hover:bg-[var(--surface-hover)]",
                          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-base text-[var(--text-primary)]">
                          {day.name}
                        </span>
                        <span className="shrink-0 text-sm text-[var(--text-secondary)]">
                          {day.status === "completata"
                            ? "fatto"
                            : day.status === "saltata"
                              ? "saltato"
                              : day.plannedFor
                                ? formatShortWeekdayDay(day.plannedFor)
                                : "previsto"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
