import type { Metadata } from "next";
import { AllenamentoSettingsView } from "./allenamento-settings-view";

export const metadata: Metadata = {
  title: "In palestra · Impostazioni",
  description: "Recupero predefinito, colonna RPE, bilanciere e inventario dei dischi.",
};

export default function AllenamentoSettingsPage() {
  return <AllenamentoSettingsView />;
}
