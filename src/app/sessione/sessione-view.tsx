"use client";

import { Dumbbell, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ExercisePickerSheet } from "@/components/exercises/exercise-picker-sheet";
import { ExerciseCard } from "@/components/session/exercise-card";
import { PlatesSheet } from "@/components/session/plates-sheet";
import { SessionHeader } from "@/components/session/session-header";
import { WarmupSheet } from "@/components/session/warmup-sheet";
import { SortableItem, SortableList } from "@/components/shared/sortable";
import { RouteMain } from "@/components/layout/route-main";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { announce } from "@/lib/announce";
import { unlockAudio } from "@/lib/audio";
import { getDb } from "@/lib/db/db";
import {
  buildSetsFromLibrary,
  discardSession,
  finishSession,
  startRest,
  updateActiveSession,
  updateSettings,
} from "@/lib/db/mutations";
import type { Equipment, Session, SetType } from "@/lib/db/schema";
import {
  addExercise,
  addSet,
  addSets,
  copyPreviousIntoSet,
  deleteSet,
  moveExercise,
  patchSet,
  removeExercise,
  replaceExercise,
  replaceExerciseNotes,
  toggleSetCompleted,
} from "@/lib/db/session-ops";
import { formatSetCount, formatVolumeKg } from "@/lib/format";
import { speakDuration } from "@/lib/logic/timer";
import { enteredSessionOnPurpose } from "@/lib/session-entry";
import { useActiveSession, useSettings } from "@/lib/session-context";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function SessioneView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, retry } = useActiveSession();
  const settings = useSettings();

  const [picker, setPicker] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const [discarding, setDiscarding] = React.useState(false);
  const [stale, setStale] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [errorBySetId, setErrorBySetId] = React.useState<Record<string, string>>({});
  const [warmupFor, setWarmupFor] = React.useState<string | null>(null);
  const [replaceFor, setReplaceFor] = React.useState<string | null>(null);
  const staleChecked = React.useRef(false);

  // §6.1 — in sessione si entra da un tocco. Un indirizzo o una ricarica portano alla
  // tab Allenamento, dove la SessionBar dice che l'allenamento e' ancora aperto.
  React.useEffect(() => {
    if (!enteredSessionOnPurpose()) router.replace("/allenamento");
  }, [router]);

  // §6.6 — piu' di sei ore aperte: si chiede cosa farne.
  React.useEffect(() => {
    if (staleChecked.current || !session) return;
    staleChecked.current = true;
    if (Date.now() - Date.parse(session.startedAt) > SIX_HOURS_MS) setStale(true);
  }, [session]);

  const tool = searchParams.get("tool");
  const toolTarget = Number(searchParams.get("target"));
  const targetKg = Number.isFinite(toolTarget) && toolTarget > 0 ? toolTarget : null;

  const setTool = React.useCallback(
    (next: { tool?: string; target?: number | null; exerciseId?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.tool) params.set("tool", next.tool);
      else params.delete("tool");
      if (next.target != null) params.set("target", String(next.target));
      else params.delete("target");
      const query = params.toString();
      router.replace(query ? `/sessione?${query}` : "/sessione", { scroll: false });
    },
    [router, searchParams],
  );

  /** Ogni mutazione e' ottimistica: se Dexie rifiuta, il banner resta finche' non passa. */
  const mutate = React.useCallback(
    async (transform: (current: Session) => Session) => {
      try {
        await updateActiveSession(getDb(), transform);
        setSaveError(null);
      } catch (error) {
        if (error instanceof RangeError) {
          toast.error(error.message);
          return;
        }
        setSaveError(error instanceof Error ? error.message : "Errore di scrittura");
        announce("system", "Allenamento non salvato sul dispositivo.");
      }
    },
    [],
  );

  /*
    QA GRAVE 5. Ogni ramo di questa rotta — caricamento, errore, nessuna sessione,
    sessione viva — monta il proprio `<main id="contenuto">` e il proprio `<h1>`.
    Una pagina di caricamento senza landmark e' comunque una pagina senza landmark.

    E l'`h1` e' **lo stesso, nello stesso posto**, in tutti e tre i rami senza sessione:
    se cambiasse o sparisse, quello che sta sotto salterebbe di sessanta pixel appena
    Dexie risponde. E' un Cumulative Layout Shift pagato per niente.
  */
  if (status === "loading") {
    return (
      <RouteMain className="app-container pt-9">
        <h1 className="text-h1 text-[var(--text-primary)]">Allenamento</h1>
        <div className="mt-5">
          <ListSkeleton rows={4} height={120} />
        </div>
      </RouteMain>
    );
  }

  if (status === "error") {
    return (
      <RouteMain className="app-container pt-9">
        <h1 className="text-h1 text-[var(--text-primary)]">Allenamento</h1>
        <div className="mt-5">
          <ErrorState
            detail="Non riesco a leggere l'allenamento in corso su questo dispositivo."
            onRetry={retry}
          />
        </div>
      </RouteMain>
    );
  }

  if (!session) {
    return (
      <RouteMain className="app-container pt-9">
        <h1 className="text-h1 text-[var(--text-primary)]">Allenamento</h1>
        <div className="mt-5">
          <EmptyState
            icon={Dumbbell}
            title="Nessun allenamento in corso"
            line="Avvia una sessione dalla tab Allenamento."
            action={
              <Button block onClick={() => router.replace("/allenamento")}>
                Vai ad Allenamento
              </Button>
            }
          />
        </div>
      </RouteMain>
    );
  }

  const completed = session.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0,
  );
  const totalSets = session.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0,
  );

  const warmupExercise = session.exercises.find((item) => item.id === warmupFor) ?? null;

  return (
    <RouteMain className="pb-40">
      <SessionHeader
        session={session}
        showRpe={settings.showRpe}
        onToggleRpe={() => void updateSettings(getDb(), { showRpe: !settings.showRpe })}
        onMinimize={() => router.push("/allenamento")}
        onFinish={() => setFinishing(true)}
        onDiscard={() => setDiscarding(true)}
        saveError={saveError}
        onRetrySave={() => void mutate((current) => current)}
      />

      <div className="app-container flex flex-col gap-4 pt-5">
        {session.exercises.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="Sessione vuota"
            line="Aggiungi il primo esercizio per cominciare."
            action={
              <Button block size="lg" onClick={() => setPicker(true)}>
                <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
                Aggiungi esercizio
              </Button>
            }
          />
        ) : (
          <SortableList
            ids={session.exercises.map((exercise) => exercise.id)}
            onReorder={(from, to) => {
              const moved = session.exercises[from];
              void mutate((current) => moveExercise(current, moved.id, to - from));
              announce(
                "session",
                `${moved.exerciseName} spostato in posizione ${to + 1} di ${session.exercises.length}.`,
              );
            }}
          >
          {session.exercises.map((exercise, index) => (
            <SortableItem
              key={exercise.id}
              id={exercise.id}
              label={exercise.exerciseName}
              className="mb-4"
            >
            {(handle) => (
            <ExerciseCard
              exercise={exercise}
              index={index}
              dragHandle={handle}
              onReplace={() => setReplaceFor(exercise.id)}
              total={session.exercises.length}
              showRpe={settings.showRpe}
              stepKg={settings.stepKg}
              stepKgFine={settings.stepKgFine}
              errorBySetId={errorBySetId}
              onPatchSet={(setId, patch) => {
                // Validazione sincrona sullo stato gia' a schermo: l'errore deve
                // comparire accanto al campo, non dentro una transazione asincrona.
                try {
                  patchSet(session, exercise.id, setId, patch);
                } catch (error) {
                  setErrorBySetId((current) => ({
                    ...current,
                    [setId]: error instanceof Error ? error.message : "Valore non valido",
                  }));
                  return;
                }
                setErrorBySetId((current) => {
                  if (!current[setId]) return current;
                  const next = { ...current };
                  delete next[setId];
                  return next;
                });
                void mutate((next) => patchSet(next, exercise.id, setId, patch));
              }}
              onToggleSet={(setId, isCompleted) => {
                unlockAudio();
                void (async () => {
                  const next = await updateActiveSession(getDb(), (current) =>
                    toggleSetCompleted(
                      current,
                      exercise.id,
                      setId,
                      isCompleted,
                      new Date().toISOString(),
                    ),
                  ).catch((error: unknown) => {
                    setSaveError(String(error));
                    return null;
                  });
                  if (!next || !isCompleted) return;

                  const done = next.exercises
                    .flatMap((item) => item.sets)
                    .filter((set) => set.completed).length;
                  announce(
                    "session",
                    `Serie completata. ${done} serie, volume totale ${formatVolumeKg(next.totalVolumeKg)}.`,
                  );

                  if (settings.restAutoStart) {
                    const restSec = exercise.restSec || settings.defaultRestSec;
                    await startRest(getDb(), restSec);
                    announce("timer", `Recupero avviato, ${speakDuration(restSec * 1000)}.`);
                  }
                })();
              }}
              onDeleteSet={(setId) => {
                const snapshot = session;
                void mutate((current) => deleteSet(current, exercise.id, setId));
                announce("session", "Serie eliminata. Premi Annulla per ripristinare.");
                toast("Serie eliminata", {
                  duration: 6000,
                  action: {
                    label: "Annulla",
                    onClick: () => void mutate(() => snapshot),
                  },
                });
              }}
              onCopyPrevious={(setId) =>
                void mutate((current) => copyPreviousIntoSet(current, exercise.id, setId))
              }
              onAddSet={() => void mutate((current) => addSet(current, exercise.id))}
              onNotes={(notes) =>
                void mutate((current) => replaceExerciseNotes(current, exercise.id, notes))
              }
              onMove={(delta) => {
                void mutate((current) => moveExercise(current, exercise.id, delta));
                announce(
                  "session",
                  `${exercise.exerciseName} spostato in posizione ${index + 1 + delta} di ${session.exercises.length}.`,
                );
              }}
              onRemove={() => {
                const snapshot = session;
                void mutate((current) => removeExercise(current, exercise.id));
                toast("Esercizio rimosso", {
                  duration: 6000,
                  action: {
                    label: "Annulla",
                    onClick: () => void mutate(() => snapshot),
                  },
                });
              }}
              onWarmup={() => {
                setWarmupFor(exercise.id);
                setTool({
                  tool: "warmup",
                  target: exercise.sets.find((set) => set.type !== "warmup")?.weightKg ?? null,
                });
              }}
              onPlates={(weightKg) => setTool({ tool: "plates", target: weightKg })}
            />
            )}
            </SortableItem>
          ))}
          </SortableList>
        )}

        {session.exercises.length > 0 ? (
          <Button variant="secondary" block size="lg" onClick={() => setPicker(true)}>
            <Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Aggiungi esercizio
          </Button>
        ) : null}
      </div>

      <ExercisePickerSheet
        open={picker}
        onOpenChange={setPicker}
        onConfirm={async (picked) => {
          for (const exercise of picked) {
            const sets = await buildSetsFromLibrary(getDb(), exercise.id);
            await mutate((current) =>
              addExercise(current, {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                equipment: exercise.equipment as Equipment,
                restSec: exercise.defaultRestSec ?? settings.defaultRestSec,
                sets,
              }),
            );
          }
        }}
      />

      <ExercisePickerSheet
        open={replaceFor !== null}
        onOpenChange={(open) => !open && setReplaceFor(null)}
        mode="replace"
        title="Sostituisci esercizio"
        replacing={
          session.exercises.find((item) => item.id === replaceFor)?.exerciseName ?? null
        }
        onConfirm={async (picked) => {
          const target = replaceFor;
          const scelto = picked[0];
          setReplaceFor(null);
          if (!target || !scelto) return;
          const previous = await buildSetsFromLibrary(getDb(), scelto.id);
          await mutate((current) =>
            replaceExercise(current, target, {
              exerciseId: scelto.id,
              exerciseName: scelto.name,
              equipment: scelto.equipment as Equipment,
              restSec: scelto.defaultRestSec ?? settings.defaultRestSec,
              previous,
            }),
          );
          announce("session", `Esercizio sostituito con ${scelto.name}.`);
          toast.success(`Sostituito con «${scelto.name}»`);
        }}
      />

      <PlatesSheet
        open={tool === "plates"}
        target={targetKg}
        onOpenChange={(open) => !open && setTool({})}
      />

      <WarmupSheet
        open={tool === "warmup"}
        target={targetKg}
        equipment={warmupExercise?.equipment ?? null}
        exerciseName={warmupExercise?.exerciseName ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setTool({});
            setWarmupFor(null);
          }
        }}
        onAdd={(sets) => {
          if (!warmupExercise) return;
          void mutate((current) =>
            addSets(
              current,
              warmupExercise.id,
              sets.map((set) => ({
                type: "warmup" as SetType,
                weightKg: set.weightKg,
                reps: set.reps,
              })),
              "start",
            ),
          );
        }}
      />

      <ConfirmDialog
        open={finishing}
        onOpenChange={setFinishing}
        variant="primary"
        title={completed === 0 ? "Nessuna serie completata" : "Terminare l'allenamento?"}
        body={
          completed === 0
            ? "Non hai completato nessuna serie. Vuoi comunque salvare questo allenamento?"
            : `${formatSetCount(completed, "completata")} su ${totalSets}. Le serie vuote non verranno salvate.`
        }
        cancelLabel="Continua"
        confirmLabel={completed === 0 ? "Salva comunque" : "Termina"}
        onConfirm={async () => {
          const finished = await finishSession(getDb());
          setFinishing(false);
          if (finished) router.replace(`/sessione/riepilogo/${finished.session.id}`);
        }}
      />

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Scartare l'allenamento?"
        body={
          completed === 0
            ? "Non hai completato nessuna serie."
            : `Hai completato ${completed} serie. Non si può recuperare.`
        }
        cancelLabel="Continua ad allenarti"
        confirmLabel="Scarta"
        onConfirm={async () => {
          await discardSession(getDb());
          setDiscarding(false);
          router.replace("/allenamento");
        }}
      />

      <ConfirmDialog
        open={stale}
        onOpenChange={setStale}
        variant="primary"
        title="Hai un allenamento aperto da più di sei ore"
        body="Vuoi riprenderlo, terminarlo adesso o scartarlo?"
        cancelLabel="Riprendi"
        confirmLabel="Termina adesso"
        extraAction={
          <Button
            variant="destructive"
            block
            className="md:w-auto"
            onClick={async () => {
              await discardSession(getDb());
              setStale(false);
              router.replace("/allenamento");
            }}
          >
            Scarta
          </Button>
        }
        onConfirm={async () => {
          const finished = await finishSession(getDb());
          setStale(false);
          if (finished) router.replace(`/sessione/riepilogo/${finished.session.id}`);
        }}
      />
    </RouteMain>
  );
}
