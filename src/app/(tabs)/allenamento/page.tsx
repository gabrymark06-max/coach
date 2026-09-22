import type { Metadata } from "next";
import { AllenamentoView } from "./allenamento-view";

export const metadata: Metadata = {
  title: "Allenamento",
  description: "Avvia una sessione o scegli una routine.",
};

export default function AllenamentoPage() {
  return <AllenamentoView />;
}
