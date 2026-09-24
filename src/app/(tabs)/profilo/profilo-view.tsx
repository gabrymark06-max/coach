"use client";

import { History, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { MonthCalendar } from "@/components/history/month-calendar";
import {
  ProfileHeader,
  ProfileHeaderSkeleton,
  StatsTabs,
} from "@/components/history/profile-header";
import {
  WorkoutFeedCard,
  WorkoutFeedCardSkeleton,
  type FeedCardData,
} from "@/components/history/workout-feed-card";
import { RailCard, RightRail } from "@/components/layout/right-rail";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { listPersonalRecords } from "@/lib/db/pr-ops";
import {
  aggregateCompletedSessions,
  countCompletedSessions,
  listCompletedSessions,
} from "@/lib/db/queries";
import type { MuscleGroup } from "@/lib/db/schema";
import { formatInt, formatSessionCount } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useHasRightRail } from "@/lib/hooks/use-media-query";
import { useMounted } from "@/lib/hooks/use-now";
import {
  formatMonthKey,
  monthOf,
  parseMonthKey,
  type MonthKey,
} from "@/lib/logic/calendar";

/** La lista si ferma qui; **i totali no** (QA GRAVE 3). */
const STORICO_LIMITE = 200;
const PAGINA = 10;

const EMPTY_SET: Set<string> = new Set();

/**
 * `/profilo` — intestazione a numeri, tab, calendario, feed personale (§4.22).
 *
 * Misure e Statistiche sono uscite dalla bottom nav e sono diventate due dei tre
 * pannelli di questa schermata. Non sono sparite: restano rotte reali e
 * deep-linkabili, e nella sidebar restano come sotto-voci di Profilo.
 */
export function ProfiloView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useMounted();
  const [pagine, setPagine] = React.useState(1);
  const limite = Math.min(pagine * PAGINA, STORICO_LIMITE);

  const meseCorrente = React.useMemo<MonthKey>(() => monthOf(new Date()), []);
  // §11.5: il mese in vista sta nella query string, non in `useState`.
  const mese = parseMonthKey(searchParams.get("mese"), meseCorrente);

  /*
    `push`, non `replace`: §4.27 vuole che **il tasto Indietro torni al mese
    precedente**. Cambiare mese e' una navigazione voluta, non una correzione di stato,
    e una voce di cronologia per mese e' esattamente quello che serve per tornare
    indietro dopo aver sfogliato l'anno.
  */
  const setMese = React.useCallback(
    (next: MonthKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mese", formatMonthKey(next));
      router.push(`/profilo?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const totali = useLiveData(() => aggregateCompletedSessions(getDb()), []);

  const feed = useLiveData(async () => {
    const db = getDb();
    const [sessions, records, totale] = await Promise.all([
      listCompletedSessions(db, limite),
      listPersonalRecords(db),
      countCompletedSessions(db),
    ]);

    const exerciseIds = new Set<string>();
    for (const session of sessions) {
      for (const exercise of session.exercises)
        exerciseIds.add(exercise.exerciseId);
    }
    const catalogo = await db.exercises.bulkGet([...exerciseIds]);
    const muscleByExerciseId = new Map<string, MuscleGroup>();
    for (const exercise of catalogo) {
      if (exercise) muscleByExerciseId.set(exercise.id, exercise.muscleGroup);
    }

    const prBySession = new Map<
      string,
      { count: number; exerciseIds: Set<string> }
    >();
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

    return { cards, totale, records: records.length };
  }, [limite]);

  const hasRail = useHasRightRail();
  /*
    Con zero allenamenti il calendario **non si monta** (§4.27): una griglia vuota non
    dice niente che l'`EmptyState` non dica meglio. E prima dell'idratazione nemmeno,
    perche' «oggi» dipende dall'orologio (§11.7).
  */
  const mostraCalendario =
    mounted && totali.status === "ready" && totali.data.sessions > 0;

  return (
    <>
      <PageHeader
        title="Profilo"
        action={
          <Button variant="secondary" asChild>
            <Link href="/impostazioni">
              <Settings aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Impostazioni
            </Link>
          </Button>
        }
      />

      <div className="app-container flex flex-col gap-6">
        <Async
          state={totali}
          loading={<ProfileHeaderSkeleton />}
          errorDetail="Non riesco a calcolare i totali su questo dispositivo."
        >
          {(aggregate) => <ProfileHeader aggregate={aggregate} />}
        </Async>

        <StatsTabs />

        {/*
          Tutto quello che sta **sotto** le tab aspetta i totali.

          Il calendario esiste solo se c'e' almeno un allenamento, e quel «se» si sa
          dopo aver letto Dexie: montarlo dopo spingerebbe lo Storico in basso di 400px,
          e riservargli lo spazio a vuoto lo farebbe risalire quando si scopre che non
          serve. In un caso e nell'altro e' un salto di layout. Aspettare un decimo di
          secondo e disegnare una volta sola costa meno di entrambi — e che si sta
          caricando lo dice gia' lo scheletro dell'intestazione.
        */}
        {totali.status === "loading" ? null : (
          <>
            {/*
              Una sola istanza del calendario, mai due: sopra 1280 sta nella colonna
              destra (il portale di `RightRail`), sotto sta qui, in colonna centrale
              **dopo le statistiche** come chiede §4.20.

              Niente imbottitura orizzontale sul telefono: la griglia ha bisogno di
              tutti i 343px del gutter per tenere le celle a 44px di lato (§4.27).
            */}
            {mostraCalendario && !hasRail ? (
              <section
                aria-label="Calendario degli allenamenti"
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] px-0 py-5 shadow-[var(--elev-1)] sm:px-5"
              >
                <MonthCalendar month={mese} onMonthChange={setMese} />
              </section>
            ) : null}

            <section aria-labelledby="titolo-storico" className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="titolo-storico" className="text-h2 text-[var(--text-primary)]">
                  Storico
                </h2>
                {feed.status === "ready" ? (
                  <p className="tnum text-sm text-[var(--text-secondary)]">
                    {formatSessionCount(feed.data.totale)}
                  </p>
                ) : null}
              </div>

              <Async
                state={feed}
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
                    line="Il tuo storico comparirà qui dopo la prima sessione."
                    action={
                      <Button block asChild>
                        <Link href="/allenamento">Inizia ad allenarti</Link>
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

                    {data.cards.length < Math.min(data.totale, STORICO_LIMITE) ? (
                      <Button
                        variant="secondary"
                        block
                        size="lg"
                        onClick={() => setPagine((value) => value + 1)}
                      >
                        Carica altri{" "}
                        {Math.min(
                          PAGINA,
                          Math.min(data.totale, STORICO_LIMITE) - data.cards.length,
                        )}
                      </Button>
                    ) : data.totale > STORICO_LIMITE ? (
                      /*
                        Il taglio della lista si **dichiara**. I totali qui sopra li
                        contano tutti: e' la lista che si ferma, non la storia.
                      */
                      <p className="text-sm text-[var(--text-muted)]">
                        La lista mostra i {formatInt(STORICO_LIMITE)} allenamenti più
                        recenti. I totali qui sopra li contano tutti.
                      </p>
                    ) : null}
                  </>
                )}
              </Async>
            </section>
          </>
        )}
      </div>

      {mostraCalendario && hasRail ? (
        <RightRail>
          {/*
            `bleed`: senza, i 16px di imbottitura della card lasciano 288px ai sette
            giorni e la cella scende a 37px. Ai bordi della card ne restano 320 e la
            cella torna sopra i 40px del cerchio (§4.27, QA DIFETTO 7).
          */}
          <RailCard title="Calendario" bleed>
            <MonthCalendar month={mese} onMonthChange={setMese} />
          </RailCard>
        </RightRail>
      ) : null}
    </>
  );
}
