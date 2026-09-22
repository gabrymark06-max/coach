import type { Metadata } from "next";
import { ImpostazioniView } from "./impostazioni-view";

export const metadata: Metadata = {
  title: "Impostazioni",
  description: "Recupero predefinito, colonna RPE, bilanciere e inventario dei dischi.",
};

export default function ImpostazioniPage() {
  return <ImpostazioniView />;
}
