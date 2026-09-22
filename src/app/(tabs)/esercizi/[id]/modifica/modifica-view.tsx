"use client";

import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { PageHeader } from "@/components/shared/page-header";
import { Async, EmptyState, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import { getExercise } from "@/lib/db/queries";
import { useLiveData } from "@/lib/hooks/use-live-data";

export function ModificaEsercizioView() {
  const params = useParams<{ id: string }>();
  const state = useLiveData(() => getExercise(getDb(), params.id), [params.id]);

  return (
    <>
      <PageHeader title="Modifica esercizio" />
      <div className="app-container">
        <Async
          state={state}
          loading={<ListSkeleton rows={4} height={64} />}
          isEmpty={(exercise) => exercise === undefined || !exercise.isCustom}
          empty={
            <EmptyState
              icon={Dumbbell}
              title="Non modificabile"
              line="Gli esercizi della libreria non si modificano. Creane uno tuo, se ti serve una variante."
              action={
                <Button block asChild>
                  <Link href="/esercizi/nuovo">Crea esercizio</Link>
                </Button>
              }
            />
          }
        >
          {(exercise) => (exercise ? <ExerciseForm key={exercise.id} exercise={exercise} /> : null)}
        </Async>
      </div>
    </>
  );
}
