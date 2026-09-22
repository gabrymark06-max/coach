import type { Metadata } from "next";
import { ProfiloView } from "./profilo-view";

export const metadata: Metadata = {
  title: "Profilo",
  description: "Storico degli allenamenti e riepilogo personale.",
};

export default function ProfiloPage() {
  return <ProfiloView />;
}
