import type { Metadata } from "next";
import { shellParams } from "@/lib/route-shell";
import { ModificaEsercizioView } from "./modifica-view";

export const metadata: Metadata = { title: "Modifica esercizio" };

/** Una sola scocca prerenderizzata: offline vale per qualunque id (vedi route-shell). */
export function generateStaticParams() {
  return shellParams("id");
}

export default function ModificaEsercizioPage() {
  return <ModificaEsercizioView />;
}
