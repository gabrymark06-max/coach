"use client";

import * as React from "react";
import { PRBadge, PRList } from "@/components/shared/pr-badge";
import type { PersonalRecord, Session } from "@/lib/db/schema";
import { SET_TYPE_GLYPH } from "@/lib/db/schema";
import { setDisplayNumber } from "@/lib/db/session-ops";
import { formatKgValue, formatVolumeKg } from "@/lib/format";
import { estimate1RM, type E1rmFormula } from "@/lib/logic/e1rm";
import { formatMinutes } from "@/lib/logic/timer";
import { cn } from "@/lib/utils";

/**
 * Il corpo di un allenamento gia' chiuso: totali, record, serie.
 *
 * Lo usano **due** schermate — il riepilogo subito dopo il `TERMINA` e il dettaglio
 * nello storico — perche' mostrano la stessa cosa. Cambia solo la cornice: la prima
 * festeggia i record appena conquistati (`fresh`), la seconda li racconta.
 *
 * La tabella delle serie resta una `<table>` vera con `<th scope="col">` (§8.9), e il
 * tipo di serie porta sempre la lettera `W`/`D`/`F` oltre al colore (§8.2).
 */
export function SessionDetail({
  session,
  records,
  nameById,
  fresh = false,
  formula,
}: {
  session: Session;
  records: readonly PersonalRecord[];
  nameById: ReadonlyMap<string, string>;
  fresh?: boolean;
  formula: E1rmFormula;
}) {
  const prBySetId = React.useMemo(() => {
    const map = new Map<string, PersonalRecord[]>();
    for (const record of records) {
      map.set(record.setId, [...(map.get(record.setId) ?? []), record]);
    }
    return map;
  }, [records]);

  return (
    <>
      <dl className="grid grid-cols-3 gap-3">
        {(
          [
            ["Durata", formatMinutes(session.durationSec * 1000)],
            ["Volume", formatVolumeKg(session.totalVolumeKg)],
            ["Serie", String(session.totalSets)],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <dt className="text-label text-[var(--text-secondary)]">{label}</dt>
            <dd className="tnum mt-1 truncate text-h2 text-[var(--text-primary)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {records.length > 0 ? (
        <section aria-labelledby="titolo-record" className="flex flex-col gap-4">
          <h2 id="titolo-record" className="text-h2 text-[var(--text-primary)]">
            {records.length === 1 ? "Un nuovo record" : `${records.length} nuovi record`}
          </h2>
          <PRList records={records} nameById={nameById} fresh={fresh} />
        </section>
      ) : null}

      {session.exercises.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] p-8 text-center text-base text-[var(--text-secondary)]">
          Nessuna serie completata in questo allenamento.
        </p>
      ) : (
        <section aria-labelledby="titolo-esercizi" className="flex flex-col gap-4">
          <h2 id="titolo-esercizi" className="text-h2 text-[var(--text-primary)]">
            Esercizi
          </h2>
          <ul className="flex flex-col gap-4">
            {session.exercises.map((exercise) => (
              <li
                key={exercise.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
              >
                <h3 className="break-words text-h3 text-[var(--text-primary)]">
                  {exercise.exerciseName}
                </h3>
                <table className="mt-4 w-full table-fixed border-collapse">
                  <caption className="sr-only">
                    Serie registrate di {exercise.exerciseName}
                  </caption>
                  <thead>
                    <tr className="text-label text-[var(--text-secondary)]">
                      <th scope="col" className="w-12 pb-2 text-left">
                        Serie
                      </th>
                      <th scope="col" className="pb-2 text-right">
                        Kg
                      </th>
                      <th scope="col" className="w-16 pb-2 text-right">
                        Reps
                      </th>
                      <th scope="col" className="w-20 pb-2 text-right">
                        1RM
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set, index) => {
                      const number = setDisplayNumber(exercise.sets, index);
                      const glyph =
                        set.type === "normal" ? String(number ?? index + 1) : SET_TYPE_GLYPH[set.type];
                      const estimate = estimate1RM(set.weightKg, set.reps, formula);
                      return (
                        <tr key={set.id} className="h-11 border-t border-[var(--border)]">
                          <th scope="row" className="text-left">
                            <span
                              translate="no"
                              className={cn(
                                "tnum inline-flex size-8 items-center justify-center rounded-[var(--radius-xs)] font-display text-sm font-bold",
                                set.type === "warmup" && "text-[var(--set-warmup)]",
                                set.type === "drop" && "text-[var(--set-drop)]",
                                set.type === "failure" && "text-[var(--set-failure)]",
                                set.type === "normal" && "text-[var(--set-normal)]",
                              )}
                            >
                              {glyph}
                            </span>
                          </th>
                          <td className="tnum text-right text-num-md text-[var(--text-primary)]">
                            {set.weightKg != null ? formatKgValue(set.weightKg) : "—"}
                          </td>
                          <td className="tnum text-right text-num-md text-[var(--text-primary)]">
                            {set.reps ?? "—"}
                          </td>
                          <td className="tnum text-right text-sm text-[var(--text-muted)]">
                            {estimate != null ? formatKgValue(estimate) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {exercise.sets.some((set) => (prBySetId.get(set.id) ?? []).length > 0) ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {exercise.sets.flatMap((set) =>
                      (prBySetId.get(set.id) ?? []).map((record) => (
                        <li key={record.id}>
                          <PRBadge kind={record.kind} fresh={fresh} />
                        </li>
                      )),
                    )}
                  </ul>
                ) : null}

                {exercise.notes ? (
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {exercise.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
