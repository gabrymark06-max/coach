import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/shared/states";
import { SessioneView } from "./sessione-view";

export const metadata: Metadata = {
  title: "Sessione",
  description: "L'allenamento in corso.",
};

export default function SessionePage() {
  return (
    <Suspense
      fallback={
        <div className="app-container pt-9">
          <ListSkeleton rows={4} height={120} />
        </div>
      }
    >
      <SessioneView />
    </Suspense>
  );
}
