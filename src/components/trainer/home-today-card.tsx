"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { TrainerDay, TrainerWeek } from "@/lib/db/trainer-schema";
import { formatShortWeekdayDay } from "@/lib/format";
import { StartDayButton } from "./dashboard-cards";
import { daySummary } from "./day-exercises";

/**
 * `TrainerTodayCard` — la card «Oggi» in versione compatta, per `/home` (§6.7, blocco 3).
 *
 * Tre differenze volute rispetto alla card di `/trainer` (§4.24), e sono tutte e tre
 * la stessa idea — la home è un punto di partenza, non la schermata del programma:
 *
 *  1. **niente carichi proposti**, e quindi niente riga del «perché». §4.25 vuole la
 *     spiegazione sotto **ogni** carico mostrato: mostrarne cinque qui rifarebbe la
 *     dashboard dentro la home, mostrarne cinque senza spiegazione romperebbe §4.25.
 *     I carichi stanno a un tocco di distanza, sulla card vera;
 *  2. **tre esercizi**, non due, e il resto contato in una riga;
 *  3. **compare solo quando oggi c'è un allenamento previsto e non è ancora fatto** —
 *     la stessa condizione del badge della sidebar (§4.19.1). Senza programma non
 *     compare per niente: l'invito al Trainer sta in `/trainer`, non come pubblicità.
 */
export function TrainerTodayCard({
  week,
  day,
  now,
}: {
  week: TrainerWeek;
  day: TrainerDay;
  /** l'orologio arriva da chi legge i dati: qui non si chiama `Date.now()` in render */
  now: string;
}) {
  const visibili = day.exercises.slice(0, 3);
  const altri = day.exercises.length - visibili.length;

  return (
    <section
      aria-labelledby="titolo-trainer-oggi"
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 pl-6 shadow-[var(--elev-1)]"
    >
      {/* la corsia di 3px: l'elemento firma del sistema, lo stesso della card di §4.24 */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] bg-[var(--blue-brand)]"
      />

      <p className="text-label text-[var(--accent-blue)]">
        Oggi · {formatShortWeekdayDay(now)}
      </p>
      <h2 id="titolo-trainer-oggi" className="mt-1 text-h2 text-[var(--text-primary)]">
        {day.name}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {daySummary(day)} · settimana {week.index}
      </p>

      <ul className="mt-4 flex flex-col border-t border-[var(--border)] pt-3">
        {visibili.map((exercise) => (
          <li
            key={exercise.exerciseId}
            className="flex items-baseline justify-between gap-3 py-1"
          >
            <span className="min-w-0 flex-1 truncate text-base text-[var(--text-primary)]">
              {exercise.exerciseName}
            </span>
            <span className="tnum shrink-0 text-sm text-[var(--text-secondary)]">
              {exercise.sets} × {exercise.repsMin}-{exercise.repsMax}
            </span>
          </li>
        ))}
      </ul>
      {altri > 0 ? (
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          e altri {altri} {altri === 1 ? "esercizio" : "esercizi"}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3">
        <StartDayButton day={day} />
        <Button variant="ghost" block asChild>
          <Link href="/trainer">Vedi il programma</Link>
        </Button>
      </div>
    </section>
  );
}
