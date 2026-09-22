import type { Metadata } from "next";
import { shellParams } from "@/lib/route-shell";
import { DettaglioEsercizioView } from "./dettaglio-view";

export const metadata: Metadata = { title: "Esercizio" };

/** Una sola scocca prerenderizzata: offline vale per qualunque id (vedi route-shell). */
export function generateStaticParams() {
  return shellParams("id");
}

export default function DettaglioEsercizioPage() {
  return <DettaglioEsercizioView />;
}
