import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/shared/states";
import { StatisticheView } from "./statistiche-view";

export const metadata: Metadata = {
  title: "Statistiche",
  description:
    "Volume per settimana e per mese, distribuzione muscolare, 1RM stimato e record personali.",
};

export default function StatistichePage() {
  return (
    <Suspense
      fallback={
        <div className="app-container pt-9">
          <ListSkeleton rows={4} height={96} />
        </div>
      }
    >
      <StatisticheView />
    </Suspense>
  );
}
