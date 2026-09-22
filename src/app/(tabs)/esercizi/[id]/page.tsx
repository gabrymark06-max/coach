import type { Metadata } from "next";
import { DettaglioEsercizioView } from "./dettaglio-view";

export const metadata: Metadata = { title: "Esercizio" };

export default function DettaglioEsercizioPage() {
  return <DettaglioEsercizioView />;
}
