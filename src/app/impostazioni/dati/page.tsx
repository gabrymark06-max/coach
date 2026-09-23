import type { Metadata } from "next";
import { DatiView } from "./dati-view";

export const metadata: Metadata = {
  title: "Backup ed esportazione · Impostazioni",
  description: "Esporta lo storico e le misure in JSON o CSV, ripristina da un backup.",
};

export default function DatiPage() {
  return <DatiView />;
}
