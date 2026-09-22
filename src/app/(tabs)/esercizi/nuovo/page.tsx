import type { Metadata } from "next";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Nuovo esercizio" };

export default function NuovoEsercizioPage() {
  return (
    <>
      <PageHeader title="Nuovo esercizio" />
      <div className="app-container">
        <ExerciseForm />
      </div>
    </>
  );
}
