"use client";

import { ClipboardList, Dumbbell, History, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import {
  WorkoutFeedCard,
  WorkoutFeedCardSkeleton,
  type FeedCardData,
} from "@/components/history/workout-feed-card";
import { QuickActions, RailCard, RailStat, RightRail } from "@/components/layout/right-rail";
import { TrainerTodayCard } from "@/components/trainer/home-today-card";
import { PageHeader } from "@/components/shared/page-header";
import { QuickStart } from "@/components/shared/quick-start";
import { Async, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { listPersonalRecords } from "@/lib/db/pr-ops";
import {
  calendarMonth,
  countCompletedSessions,
  listCompletedSessions,
  listRoutines,
} from "@/lib/db/queries";
import { todayTrainerDay } from "@/lib/db/trainer-ops";
import type { MuscleGroup } from "@/lib/db/schema";
import { formatSessionCount, formatVolumeKg } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";

/** §4.21: dieci card, poi un pulsante vero. **Niente scroll infinito.** */
const PAGINA = 10;

/**
 * `/home` — il feed, con l'avvio in cima (§6.7).
 *
 * `/home` e `/allenamento` rispondono a due domande diverse: «cosa ho fatto» e «cosa
 * faccio adesso». Fonderle significherebbe mettere l'elenco delle routine sotto una
 * lista che si allunga ogni settimana, e dopo due mesi il pulsante `AVVIA` sarebbe a
 * tre scroll. Il percorso critico di quest'app e' l'unica cosa che non si tocca.
 */
export function HomeView() {
  const [pagine, setPagine] = React.useState(1);
  const limite = pagine * PAGINA;

  const state = useLiveData(async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const [sessions, records, totale, routines, trainerOggi] = await Promise.all([
      listCompletedSessions(db, limite),
      listPersonalRecords(db),
      countCompletedSessions(db),
      listRoutines(db),
      // §9.6: la home legge il programma attivo per sapere se oggi c'e' un allenamento
      todayTrainerDay(db, now),
    ]);

    // Un solo passaggio sulla libreria per sapere che muscolo mostrare nel quadratino.
    const exerciseIds = new Set<string>();
    for (const session of sessions) {
      for (const exercise of session.exercises) exerciseIds.add(exercise.exerciseId);
    }
    const catalogo = await db.exercises.bulkGet([...exerciseIds]);
    const muscleByExerciseId = new Map<string, MuscleGroup>();
    for (const exercise of catalogo) {
      if (exercise) muscleByExerciseId.set(exercise.id, exercise.muscleGroup);
    }

    const prBySession = new Map<string, { count: number; exerciseIds: Set<string> }>();
    for (const record of records) {
      let entry = prBySession.get(record.sessionId);
      if (!entry) {
        entry = { count: 0, exerciseIds: new Set() };
        prBySession.set(record.sessionId, entry);
      }
      entry.count += 1;
      entry.exerciseIds.add(record.exerciseId);
    }

    const cards: FeedCardData[] = sessions.map((session) => {
      const pr = prBySession.get(session.id);
      return {
        session,
        prCount: pr?.count ?? 0,
        prExerciseIds: pr?.exerciseIds ?? EMPTY_SET,
        muscleByExerciseId,
      };
    });

    const lastRoutine =
      routines.find((routine) => routine.id === sessions[0]?.routineId) ??
      [...routines].sort((a, b) =>
        (b.lastPerformedAt ?? "").localeCompare(a.lastPerformedAt ?? ""),
      )[0] ??
      null;

    return { cards, totale, lastRoutine, trainerOggi, now };
  }, [limite]);

  return (
    <>
      <PageHeader title="Home" />

      <div className="app-container flex flex-col gap-8">
        <QuickStart size="compact" lastRoutine={state.data?.lastRoutine} />

        {/*
          §6.7 blocco 3: la card del Trainer **solo se** oggi c'e' un allenamento
          previsto e non ancora fatto. Non ha uno stato vuoto e non ha uno scheletro:
          una card che compare per dire «niente da fare» e' rumore, e un segnaposto per
          chi il Trainer non lo usa sposterebbe il feed a ogni caricamento.
        */}
        {state.status === "ready" && state.data.trainerOggi ? (
          <TrainerTodayCard
            week={state.data.trainerOggi.week}
            day={state.data.trainerOggi.day}
            now={state.data.now}
          />
        ) : null}

        <section aria-labelledby="titolo-feed" className="flex flex-col gap-4">
          <h2 id="titolo-feed" className="text-h2 text-[var(--text-primary)]">
            Allenamenti recenti
          </h2>

          <Async
            state={state}
            loading={
              <div className="flex flex-col gap-4">
                {[0, 1, 2].map((row) => (
                  <WorkoutFeedCardSkeleton key={row} />
                ))}
              </div>
            }
            isEmpty={(data) => data.cards.length === 0}
            empty={
              <EmptyState
                icon={History}
                level={3}
                title="Nessun allenamento registrato"
                line="Il primo allenamento comparirà qui appena lo termini."
                action={
                  <Button block asChild>
                    <Link href="/allenamento">Scegli una routine</Link>
                  </Button>
                }
              />
            }
            errorDetail="Non riesco a leggere lo storico salvato su questo dispositivo."
          >
            {(data) => (
              <>
                <ul className="flex flex-col gap-4">
                  {data.cards.map((card) => (
                    <li key={card.session.id}>
                      <WorkoutFeedCard data={card} />
                    </li>
                  ))}
                </ul>

                {/*
                  §4.21 — un pulsante vero, non lo scroll infinito: lo scroll infinito
                  rompe il ritorno alla posizione quando si apre un allenamento e si
                  torna indietro, che e' il gesto piu' frequente su questa schermata.
                */}
                {data.cards.length < data.totale ? (
                  <Button
                    variant="secondary"
                    block
                    size="lg"
                    onClick={() => setPagine((value) => value + 1)}
                  >
                    Carica altri {Math.min(PAGINA, data.totale - data.cards.length)}
                  </Button>
                ) : null}
              </>
            )}
          </Async>
        </section>
      </div>

      <RightRail ready={state.status !== "loading"}>
        <MeseCorrente />
        <RailCard title="Azioni rapide">
          <QuickActions
            actions={[
              { href: "/allenamento/routine/nuova", label: "Nuova routine", icon: Plus },
              { href: "/esercizi/nuovo", label: "Nuovo esercizio", icon: Dumbbell },
              { href: "/trainer", label: "Apri il Trainer", icon: ClipboardList },
            ]}
          />
        </RailCard>
      </RightRail>
    </>
  );
}

const EMPTY_SET: Set<string> = new Set();

/**
 * «Il tuo mese» — §4.20.
 *
 * Una card di riepilogo senza dati non si mostra vuota: si mostra con lo zero **e** la
 * frase. Mai un trattino e basta.
 */
function MeseCorrente() {
  const mounted = useMounted();
  const oggi = React.useMemo(() => new Date(), []);

  const state = useLiveData(async () => {
    const db = getDb();
    const giorni = await calendarMonth(db, oggi.getFullYear(), oggi.getMonth() + 1);
    const ids = giorni.flatMap((giorno) => giorno.sessions.map((s) => s.id));
    const sessions = await db.sessions.bulkGet(ids);

    let volumeKg = 0;
    let sets = 0;
    for (const session of sessions) {
      if (!session) continue;
      volumeKg += session.totalVolumeKg;
      sets += session.totalSets;
    }
    return { allenamenti: ids.length, volumeKg, sets };
  }, [oggi.getMonth()]);

  if (!mounted) return null;

  return (
    <RailCard
      title="Il tuo mese"
      action={
        <Button variant="ghost" block asChild>
          <Link href="/profilo">Vedi il profilo</Link>
        </Button>
      }
    >
      <Async
        state={state}
        loading={<p className="text-sm text-[var(--text-muted)]">Calcolo…</p>}
        errorDetail="Non riesco a leggere questo dato."
      >
        {(data) =>
          data.allenamenti === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              0 allenamenti questo mese. Il primo conta doppio.
            </p>
          ) : (
            /*
              Tre righe, non tre colonne: in 288px «ALLENAMENTI» da solo mangia mezza
              riga e le tre etichette si toccano. Etichetta a sinistra, numero a destra.
            */
            <dl className="flex flex-col gap-2">
              <RailStat label="Allenamenti" value={String(data.allenamenti)} />
              <RailStat label="Volume" value={formatVolumeKg(data.volumeKg)} />
              <RailStat label="Serie" value={String(data.sets)} />
            </dl>
          )
        }
      </Async>
      <p className="sr-only">{formatSessionCount(state.data?.allenamenti ?? 0)} questo mese.</p>
    </RailCard>
  );
}
