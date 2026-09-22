"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ExercisePickerSheet } from "@/components/exercises/exercise-picker-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableItem, SortableList } from "@/components/shared/sortable";
import { announce } from "@/lib/announce";
import { getDb, newId } from "@/lib/db/db";
import { createRoutine, updateRoutine } from "@/lib/db/mutations";
import {
  SET_TYPE_LABEL,
  type Routine,
  type RoutineExercise,
  type SetType,
} from "@/lib/db/schema";
import { formatKgValue, parseDecimal, parseInteger } from "@/lib/format";
import { cn } from "@/lib/utils";

const GLYPH: Record<SetType, string> = {
  normal: "#",
  warmup: "W",
  drop: "D",
  failure: "F",
};

/**
 * Editor di routine — creazione e modifica.
 *
 * Qui la scrittura avviene al `Salva`, non a ogni tasto: e' l'**unico** punto dell'app
 * che usa `beforeunload` (§11.8). In sessione non serve, perche' li' ogni tocco e' gia'
 * scritto su IndexedDB.
 */
export function RoutineEditor({ routine }: { routine?: Routine }) {
  const router = useRouter();
  const [name, setName] = React.useState(routine?.name ?? "");
  const [split, setSplit] = React.useState(routine?.split ?? "");
  const [exercises, setExercises] = React.useState<RoutineExercise[]>(
    routine?.exercises ?? [],
  );
  /**
   * Chiavi stabili, in parallelo agli esercizi.
   *
   * Una routine puo' contenere due volte lo stesso esercizio, e l'indice cambia proprio
   * quando si riordina: nessuno dei due va bene come identita' per il trascinamento.
   * Queste chiavi vivono solo qui e non finiscono su Dexie.
   */
  const [keys, setKeys] = React.useState<string[]>(() =>
    (routine?.exercises ?? []).map(() => newId()),
  );
  const [picker, setPicker] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const dirty = React.useRef(false);
  const nameId = React.useId();
  const errorId = React.useId();

  const markDirty = () => {
    dirty.current = true;
  };

  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const patchExercise = (index: number, patch: Partial<RoutineExercise>) => {
    markDirty();
    setExercises((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const moveTo = React.useCallback((from: number, to: number) => {
    markDirty();
    setExercises((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      announce(
        "session",
        `${moved.exerciseName} spostato in posizione ${to + 1} di ${next.length}.`,
      );
      return next.map((item, order) => ({ ...item, order }));
    });
    setKeys((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= exercises.length) return;
    moveTo(index, to);
  };

  const save = async () => {
    if (name.trim() === "") {
      setNameError("Dai un nome alla routine.");
      document.getElementById(nameId)?.focus();
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const payload = { name, split, exercises };
      if (routine) {
        await updateRoutine(getDb(), routine.id, payload);
        toast.success(`Routine «${name.trim()}» aggiornata`);
      } else {
        await createRoutine(getDb(), payload);
        toast.success(`Routine «${name.trim()}» creata`);
      }
      dirty.current = false;
      router.push("/allenamento");
    } catch {
      toast.error("Non riesco a salvare la routine su questo dispositivo.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold text-[var(--text-primary)]">
            Nome della routine
          </span>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => {
              markDirty();
              setName(event.target.value);
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? errorId : undefined}
            placeholder="Push A"
            className={cn(
              "h-12 rounded-[var(--radius-sm)] border bg-[var(--input)] px-3 text-base text-[var(--text-primary)]",
              "placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
              nameError ? "border-2 border-[var(--danger)]" : "border-[var(--border-strong)]",
            )}
          />
          {nameError ? (
            <span id={errorId} className="text-sm text-[var(--danger)]">
              {nameError}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold text-[var(--text-primary)]">
            Split <span className="font-normal text-[var(--text-muted)]">(facoltativo)</span>
          </span>
          <input
            type="text"
            value={split}
            onChange={(event) => {
              markDirty();
              setSplit(event.target.value);
            }}
            placeholder="Push / Pull / Legs"
            className="h-12 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          />
        </label>
      </div>

      <section aria-labelledby="titolo-esercizi" className="flex flex-col gap-4">
        <h2 id="titolo-esercizi" className="text-h2 text-[var(--text-primary)]">
          Esercizi
        </h2>

        {exercises.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] p-8 text-center text-base text-[var(--text-secondary)]">
            Nessun esercizio. Aggiungine almeno uno per poter avviare la routine.
          </p>
        ) : (
          <SortableList
            ids={keys}
            onReorder={moveTo}
          >
          <ul className="flex flex-col gap-4">
            {exercises.map((exercise, index) => (
              <li key={keys[index] ?? index}>
              <SortableItem
                id={keys[index] ?? String(index)}
                label={exercise.exerciseName}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
              >
              {(handle) => (
              <>
                <div className="flex items-start gap-3">
                  {handle}
                  <h3 className="min-w-0 flex-1 break-words text-h3 text-[var(--text-primary)]">
                    {exercise.exerciseName}
                  </h3>
                  <button
                    type="button"
                    aria-label={`Sposta ${exercise.exerciseName} su`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="inline-flex size-12 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
                  >
                    <ArrowUp aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Sposta ${exercise.exerciseName} giù`}
                    disabled={index === exercises.length - 1}
                    onClick={() => move(index, 1)}
                    className="inline-flex size-12 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
                  >
                    <ArrowDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Rimuovi ${exercise.exerciseName} dalla routine`}
                    onClick={() => {
                      markDirty();
                      setExercises((current) =>
                        current
                          .filter((_, i) => i !== index)
                          .map((item, order) => ({ ...item, order })),
                      );
                      setKeys((current) => current.filter((_, i) => i !== index));
                    }}
                    className="inline-flex size-12 items-center justify-center rounded-[var(--radius-btn)] text-[var(--danger)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
                  >
                    <Trash2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  </button>
                </div>

                <table className="mt-3 w-full table-fixed border-collapse">
                  <caption className="sr-only">
                    Serie di riferimento di {exercise.exerciseName}
                  </caption>
                  <thead>
                    <tr className="text-label text-[var(--text-secondary)]">
                      <th scope="col" className="w-12 pb-2 text-center">Serie</th>
                      <th scope="col" className="pb-2 text-center">Kg</th>
                      <th scope="col" className="pb-2 text-center">Reps</th>
                      <th scope="col" className="w-12 pb-2">
                        <span className="sr-only">Elimina</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set, setIndex) => (
                      <tr key={setIndex} className="border-b border-[var(--border)]">
                        <th scope="row" className="p-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Serie ${setIndex + 1}: tipo ${SET_TYPE_LABEL[set.type].toLowerCase()}. Cambia tipo`}
                              className="inline-flex size-12 items-center justify-center rounded-[var(--radius-xs)] font-display text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
                            >
                              <span translate="no">
                                {set.type === "normal" ? setIndex + 1 : GLYPH[set.type]}
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {(Object.keys(SET_TYPE_LABEL) as SetType[]).map((type) => (
                                <DropdownMenuItem
                                  key={type}
                                  onSelect={() =>
                                    patchExercise(index, {
                                      sets: exercise.sets.map((item, i) =>
                                        i === setIndex ? { ...item, type } : item,
                                      ),
                                    })
                                  }
                                >
                                  {SET_TYPE_LABEL[type]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </th>
                        <td className="p-0 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            defaultValue={
                              set.targetWeightKg == null ? "" : formatKgValue(set.targetWeightKg)
                            }
                            aria-label={`Peso di riferimento, serie ${setIndex + 1}, ${exercise.exerciseName}`}
                            placeholder="—"
                            onBlur={(event) =>
                              patchExercise(index, {
                                sets: exercise.sets.map((item, i) =>
                                  i === setIndex
                                    ? { ...item, targetWeightKg: parseDecimal(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                            className="tnum h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-2 text-right text-num-md text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                          />
                        </td>
                        <td className="p-0 pr-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            defaultValue={set.targetReps == null ? "" : String(set.targetReps)}
                            aria-label={`Ripetizioni di riferimento, serie ${setIndex + 1}, ${exercise.exerciseName}`}
                            placeholder="—"
                            onBlur={(event) =>
                              patchExercise(index, {
                                sets: exercise.sets.map((item, i) =>
                                  i === setIndex
                                    ? { ...item, targetReps: parseInteger(event.target.value) }
                                    : item,
                                ),
                              })
                            }
                            className="tnum h-12 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] px-2 text-right text-num-md text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                          />
                        </td>
                        <td className="p-0">
                          <button
                            type="button"
                            aria-label={`Elimina la serie ${setIndex + 1} di ${exercise.exerciseName}`}
                            disabled={exercise.sets.length === 1}
                            onClick={() =>
                              patchExercise(index, {
                                sets: exercise.sets.filter((_, i) => i !== setIndex),
                              })
                            }
                            className="inline-flex size-12 items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
                          >
                            <Trash2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <Button
                  variant="ghost"
                  block
                  className="mt-2"
                  onClick={() =>
                    patchExercise(index, {
                      sets: [
                        ...exercise.sets,
                        { type: exercise.sets.at(-1)?.type ?? "normal" },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  Aggiungi serie
                </Button>
              </>
              )}
              </SortableItem>
              </li>
            ))}
          </ul>
          </SortableList>
        )}

        <Button variant="secondary" block size="lg" onClick={() => setPicker(true)}>
          <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
          Aggiungi esercizi
        </Button>
      </section>

      <div className="flex flex-col gap-3 md:flex-row-reverse">
        <Button size="lg" block className="md:w-auto" loading={saving} loadingLabel="Salvo…" onClick={() => void save()}>
          Salva routine
        </Button>
        <Button
          variant="secondary"
          size="lg"
          block
          className="md:w-auto"
          onClick={() => (dirty.current ? setLeaving(true) : router.push("/allenamento"))}
        >
          Annulla
        </Button>
      </div>

      <ExercisePickerSheet
        open={picker}
        onOpenChange={setPicker}
        onConfirm={(picked) => {
          markDirty();
          setExercises((current) => [
            ...current,
            ...picked.map((exercise, i) => ({
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              order: current.length + i,
              sets: [{ type: "normal" as const }, { type: "normal" as const }, { type: "normal" as const }],
            })),
          ]);
          setKeys((current) => [...current, ...picked.map(() => newId())]);
        }}
      />

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Uscire senza salvare?"
        body="Le modifiche a questa routine andranno perse."
        cancelLabel="Continua a modificare"
        confirmLabel="Esci senza salvare"
        onConfirm={() => {
          dirty.current = false;
          router.push("/allenamento");
        }}
      />
    </div>
  );
}
