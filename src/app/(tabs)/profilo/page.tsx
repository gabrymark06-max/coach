import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileHeaderSkeleton } from "@/components/history/profile-header";
import { ProfiloView } from "./profilo-view";

export const metadata: Metadata = {
  title: "Profilo",
  description:
    "I tuoi totali, il calendario degli allenamenti e lo storico completo.",
};

/**
 * Il mese in vista sta nella query string (§11.5), quindi la vista legge
 * `useSearchParams` e va dentro un `Suspense`. Il fallback ha la forma
 * dell'intestazione, non un rettangolo generico: cosi' non c'e' salto di layout.
 */
export default function ProfiloPage() {
  return (
    <Suspense
      fallback={
        <div className="app-container pt-9">
          <ProfileHeaderSkeleton />
        </div>
      }
    >
      <ProfiloView />
    </Suspense>
  );
}
