import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/states";
import { ProgressioneView } from "./progressione-view";

export const metadata: Metadata = {
  title: "Registro della progressione",
  description:
    "Tutte le decisioni del Trainer, con la regola che le ha prodotte e i numeri su cui si basano.",
};

export default function ProgressionePage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Progressione" />
          <div className="app-container">
            <ListSkeleton rows={6} height={72} />
          </div>
        </>
      }
    >
      <ProgressioneView />
    </Suspense>
  );
}
