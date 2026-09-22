import type { Metadata } from "next";
import { ModificaEsercizioView } from "./modifica-view";

export const metadata: Metadata = { title: "Modifica esercizio" };

export default function ModificaEsercizioPage() {
  return <ModificaEsercizioView />;
}
