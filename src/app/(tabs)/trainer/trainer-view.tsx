"use client";

import { ClipboardList, MoreVertical, SlidersHorizontal, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { RailCard, RightRail, QuickActions, RailStat } from "@/components/layout/right-rail";
import { PageHeader } from "@/components/shared/page-header";
import {
  DoneCard,
  PausedBanner,
  RestCard,
  SkippedWeekBanner,
  TodayCard,
  WeeksAccordion,
} from "@/components/trainer/dashboard-cards";
import { RulesSheet } from "@/components/trainer/rules-sheet";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import { personalRecordsForSession } from "@/lib/db/pr-ops";
import { getSession } from "@/lib/db/queries";
import {
  advanceWeek,
  decisionsByIds,
  endProgram,
  getCurrentProgram,
  getLastFinishedProgram,
  getTrainerProfile,
  pauseProgram,
  reduceDays,
  regenerateFromToday,
  repeatWeek,
  resumeProgram,
  syncProgramClock,
} from "@/lib/db/trainer-ops";
import { formatShortWeekdayDay, formatWeekdayDay } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { programClock, programProgress, todayFocus, upcoming } from "@/lib/trainer/clock";
import { DAYS_CHOICES, TOTAL_STEPS } from "@/lib/trainer/questionnaire";

/**
 * `/trainer` — il dispatcher di §4.24.
 *
 * Non e' «una pagina con un `if`»: e' la tabella degli stati del design system, messa
 * in codice riga per riga. Nessun programma, bozza in sospeso, oggi allenamento, oggi
 * riposo, oggi gia' fatto, settimana saltata, due settimane saltate, in pausa, finito,
 * caricamento, errore. Undici stati, undici rami, nessuno lasciato al caso.
 */
export function TrainerView() {
  const router = useRouter();
  const mounted = useMounted();
  const [busy, setBusy] = React.useState(false);
  const [regole, setRegole] = React.useState(false);
  const [giorni, setGiorni] = React.useState(false);

  /*
    L'orologio si allinea una volta al montaggio e non a ogni render: il tempo passa
    anche con l'app chiusa, ma un render non e' un evento del calendario.
  */
  React.useEffect(() => {
    void syncProgramClock(getDb()).catch(() => undefined);
  }, []);

  const state = useLiveData(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const [profile, program] = await Promise.all([
      getTrainerProfile(db),
      getCurrentProgram(db),
    ]);

    if (!program) {
      const finito = await getLastFinishedProgram(db);
      return { now, profile, program: finito ?? null, finished: Boolean(finito) } as const;
    }

    const clock = programClock(program, now);
    const focus = todayFocus(program, now);
    const day = focus.kind === "allenamento" || focus.kind === "fatto" ? focus.day : null;
    const ids = (day?.exercises ?? [])
      .map((exercise) => exercise.decisionId)
      .filter((id): id is string => Boolean(id));

    const decisions = await decisionsByIds(db, ids);

    let done: {
      id: string;
      durationSec: number;
      totalVolumeKg: number;
      prCount: number;
    } | null = null;
    if (focus.kind === "fatto" && focus.day.sessionId) {
      const session = await getSession(db, focus.day.sessionId);
      if (session) {
        const records = await personalRecordsForSession(db, session.id);
        done = {
          id: session.id,
          durationSec: session.durationSec,
          totalVolumeKg: session.totalVolumeKg,
          prCount: records.length,
        };
      }
    }

    return { now, profile, program, clock, focus, decisions, done, finished: false } as const;
  }, []);

  const azione = async (fn: () => Promise<unknown>, messaggio: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      announce("system", messaggio);
      toast.success(messaggio);
    } catch {
      toast.error("Non riesco a scrivere su questo dispositivo.");
    } finally {
      setBusy(false);
    }
  };

  /*
    §4.24 vuole l'`h1` **col nome del programma**, e §8.9 ne vuole uno solo per rotta —
    anche mentre carica e anche quando il dato non c'e'. Le due regole stanno insieme
    solo cosi': un `h1` sempre montato, il cui testo diventa il nome del programma
    appena il programma c'e'.
  */
  const titolo =
    state.status === "ready" && state.data.program ? state.data.program.name : "Trainer";

  return (
    <>
      <PageHeader title={titolo} />

      <div className="app-container flex flex-col gap-6">
        <Async
          state={state}
          loading={
            <div className="flex flex-col gap-6">
              <Skeleton className="h-[220px] w-full rounded-[var(--radius-lg)]" />
              <ListSkeleton rows={4} height={56} />
            </div>
          }
          errorDetail="Non riesco a leggere il programma su questo dispositivo."
        >
          {(data) => {
            // ── nessun programma ────────────────────────────────────────────────
            if (!data.program) {
              const bozza = data.profile?.draftStep;
              return (
                <>
                  {bozza ? (
                    <section
                      aria-labelledby="titolo-bozza"
                      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
                    >
                      <h2 id="titolo-bozza" className="text-h3 text-[var(--text-primary)]">
                        Questionario in sospeso — passo {bozza} di {TOTAL_STEPS}
                      </h2>
                      <div className="mt-4 flex flex-col gap-3">
                        <Button block asChild>
                          <Link href="/trainer/questionario">Riprendi</Link>
                        </Button>
                        <Button variant="ghost" block asChild>
                          <Link href="/trainer/questionario?ricomincia=1">Ricomincia</Link>
                        </Button>
                      </div>
                    </section>
                  ) : null}

                  <EmptyState
                    icon={ClipboardList}
                    title="Nessun programma"
                    line="Rispondi a sei domande e ti preparo un programma di più settimane che si aggiorna da solo, in base a come vanno i tuoi allenamenti."
                    action={
                      <Button block asChild>
                        <Link href="/trainer/questionario">Inizia il questionario</Link>
                      </Button>
                    }
                    secondary={
                      <Button variant="ghost" block onClick={() => setRegole(true)}>
                        Come funziona la progressione
                      </Button>
                    }
                  />
                </>
              );
            }

            const program = data.program;

            // ── finito ──────────────────────────────────────────────────────────
            if (data.finished || program.status === "completed") {
              const progress = programProgress(program, data.now);
              return (
                <section
                  aria-labelledby="titolo-finito"
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--elev-1)]"
                >
                  <Trophy
                    aria-hidden="true"
                    className="size-10 text-[var(--pr)]"
                    strokeWidth={1.75}
                  />
                  <h2 id="titolo-finito" className="mt-3 text-h2 text-[var(--text-primary)]">
                    Programma completato
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{program.name}</p>
                  <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
                    <div>
                      <dt className="text-label text-[var(--text-secondary)]">Allenamenti</dt>
                      <dd className="tnum text-num-md text-[var(--text-primary)]">
                        {progress.daysDone} su {progress.daysTotal}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-label text-[var(--text-secondary)]">Serie</dt>
                      <dd className="tnum text-num-md text-[var(--text-primary)]">
                        {progress.setsDone} su {progress.setsPlannedTotal}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-label text-[var(--text-secondary)]">Aderenza</dt>
                      <dd className="tnum text-num-md text-[var(--text-primary)]">
                        {progress.adherence}%
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-6 flex flex-col gap-3">
                    <Button block asChild>
                      <Link href="/trainer/questionario">Genera il ciclo successivo</Link>
                    </Button>
                    <Button variant="ghost" block asChild>
                      <Link href="/allenamento">Torna alle routine</Link>
                    </Button>
                  </div>
                </section>
              );
            }

            const clock = data.clock!;
            const focus = data.focus!;
            const progress = programProgress(program, data.now);
            const prossimi = upcoming(program, data.now, 3);

            return (
              <>
                {/* intestazione del programma */}
                <section aria-labelledby="titolo-programma">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id="titolo-programma" className="text-label text-[var(--text-secondary)]">
                        Settimana {clock.derivedWeek} di {program.weeksTotal}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {program.profileSnapshot.daysPerWeek} giorni a settimana ·{" "}
                        {program.weeks.find((week) => week.index === clock.derivedWeek)?.kind ??
                          "accumulo"}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Azioni sul programma ${program.name}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                      >
                        <MoreVertical aria-hidden="true" className="size-5" strokeWidth={1.75} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setGiorni(true)}>
                          Cambia giorni a settimana
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setRegole(true)}>
                          Come funziona la progressione
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push("/trainer/progressione")}>
                          Registro delle decisioni
                        </DropdownMenuItem>
                        {program.status === "active" ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              void azione(() => pauseProgram(getDb()), "Programma in pausa.")
                            }
                          >
                            Metti in pausa
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() =>
                              void azione(() => resumeProgram(getDb()), "Programma ripreso.")
                            }
                          >
                            Riprendi
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            void azione(() => endProgram(getDb()), "Programma terminato.")
                          }
                        >
                          Termina il programma
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div
                    role="progressbar"
                    aria-label="Avanzamento del programma"
                    aria-valuemin={0}
                    aria-valuemax={program.weeksTotal}
                    aria-valuenow={clock.derivedWeek}
                    aria-valuetext={`Settimana ${clock.derivedWeek} di ${program.weeksTotal}`}
                    className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--border)]"
                  >
                    <div
                      className="h-full origin-left bg-[var(--primary)] transition-transform duration-[var(--dur-2)] ease-[var(--ease-out)] motion-reduce:transition-none"
                      style={{ transform: `scaleX(${clock.derivedWeek / program.weeksTotal})` }}
                    />
                  </div>
                </section>

                {program.status === "paused" ? (
                  <PausedBanner
                    since={program.pausedAt}
                    onResume={() =>
                      void azione(() => resumeProgram(getDb()), "Programma ripreso.")
                    }
                  />
                ) : null}

                {clock.awaitingChoice && clock.skippedWeeks.length > 0 ? (
                  <SkippedWeekBanner
                    skippedWeeks={clock.skippedWeeks}
                    daysPerWeek={program.profileSnapshot.daysPerWeek}
                    busy={busy}
                    onRepeat={() =>
                      void azione(
                        () => repeatWeek(getDb(), clock.skippedWeeks.at(-1)!),
                        `Settimana ${clock.skippedWeeks.at(-1)} ripetuta da oggi.`,
                      )
                    }
                    onAdvance={() =>
                      void azione(
                        () => advanceWeek(getDb(), clock.skippedWeeks.at(-1)!),
                        `Avanti alla settimana ${clock.skippedWeeks.at(-1)! + 1}.`,
                      )
                    }
                    onRegenerate={() =>
                      void azione(
                        () => regenerateFromToday(getDb()),
                        "Programma rigenerato da oggi.",
                      )
                    }
                    onReduce={() =>
                      void azione(
                        () => reduceDays(getDb(), 3),
                        "Programma adattato a 3 giorni a settimana.",
                      )
                    }
                  />
                ) : null}

                {focus.kind === "allenamento" ? (
                  <TodayCard
                    week={focus.week}
                    day={focus.day}
                    decisions={data.decisions!}
                    today={mounted ? formatWeekdayDay(data.now) : ""}
                  />
                ) : null}
                {focus.kind === "fatto" ? (
                  <DoneCard day={focus.day} session={data.done ?? null} />
                ) : null}
                {focus.kind === "riposo" ? <RestCard next={focus.next} /> : null}

                <WeeksAccordion program={program} clock={clock} />

                <RightRail>
                  <RailCard title="Il programma">
                    <dl className="flex flex-col gap-2">
                      <RailStat label="Aderenza" value={`${progress.adherence}%`} />
                      <RailStat
                        label="Allenamenti"
                        value={`${progress.daysDone} / ${progress.daysTotal}`}
                      />
                      <RailStat
                        label="Serie"
                        value={`${progress.setsDone} / ${progress.setsPlannedTotal}`}
                      />
                    </dl>
                  </RailCard>

                  <RailCard title="Prossimi allenamenti">
                    {prossimi.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">
                        Non c&apos;è altro in programma.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {prossimi.map(({ day }) => (
                          <li key={day.id} className="flex items-baseline justify-between gap-3">
                            <Link
                              href={`/trainer/giorno/${day.id}`}
                              className="min-w-0 flex-1 truncate text-sm text-[var(--accent-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                            >
                              {day.name}
                            </Link>
                            <span className="shrink-0 text-sm text-[var(--text-secondary)]">
                              {mounted && day.plannedFor ? formatShortWeekdayDay(day.plannedFor) : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </RailCard>

                  <RailCard title="Azioni rapide">
                    <QuickActions
                      actions={[
                        {
                          href: "/trainer/progressione",
                          label: "Registro delle decisioni",
                          icon: ClipboardList,
                        },
                        {
                          href: "/trainer/questionario",
                          label: "Cambia le risposte",
                          icon: SlidersHorizontal,
                        },
                      ]}
                    />
                  </RailCard>
                </RightRail>
              </>
            );
          }}
        </Async>
      </div>

      <RulesSheet open={regole} onOpenChange={setRegole} />

      <Sheet open={giorni} onOpenChange={setGiorni}>
        <SheetContent
          title="Quanti giorni a settimana?"
          description="Rigenero il programma da oggi con le stesse risposte, cambiando solo i giorni."
        >
          <ul className="flex flex-col gap-3">
            {DAYS_CHOICES.map((value) => (
              <li key={value}>
                <Button
                  variant="secondary"
                  block
                  disabled={busy}
                  onClick={() => {
                    setGiorni(false);
                    void azione(
                      () => reduceDays(getDb(), value),
                      `Programma rigenerato a ${value} giorni a settimana.`,
                    );
                  }}
                >
                  {value} giorni
                </Button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
