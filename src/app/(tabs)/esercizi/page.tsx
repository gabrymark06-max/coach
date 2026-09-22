import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/shared/states";
import { EserciziView } from "./esercizi-view";

export const metadata: Metadata = {
  title: "Esercizi",
  description: "La libreria degli esercizi, con ricerca e filtri.",
};

export default function EserciziPage() {
  return (
    <Suspense
      fallback={
        <div className="app-container pt-9">
          <ListSkeleton rows={8} />
        </div>
      }
    >
      <EserciziView />
    </Suspense>
  );
}
