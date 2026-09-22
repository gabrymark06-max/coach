import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/shared/states";
import { shellParams } from "@/lib/route-shell";
import { MetricaView } from "./metrica-view";

export const metadata: Metadata = { title: "Misura" };

/** Una sola scocca prerenderizzata: offline vale per qualunque metrica (route-shell). */
export function generateStaticParams() {
  return shellParams("metrica");
}

export default function MetricaPage() {
  return (
    <Suspense
      fallback={
        <div className="app-container pt-9">
          <ListSkeleton rows={4} height={96} />
        </div>
      }
    >
      <MetricaView />
    </Suspense>
  );
}
