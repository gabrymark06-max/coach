import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/shared/states";
import { RouteMain } from "@/components/layout/route-main";
import { QuestionarioView } from "./questionario-view";

export const metadata: Metadata = {
  title: "Questionario del Trainer",
  description:
    "Sei domande — obiettivo, muscoli, attrezzatura, livello e giorni — e il Trainer genera il programma.",
};

export default function QuestionarioPage() {
  return (
    <Suspense
      fallback={
        <RouteMain className="app-container flex flex-col gap-6 py-9">
          <h1 className="sr-only">Il questionario del Trainer</h1>
          <ListSkeleton rows={4} height={72} />
        </RouteMain>
      }
    >
      <QuestionarioView />
    </Suspense>
  );
}
