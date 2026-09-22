import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Soon } from "@/components/shared/soon";

export const metadata: Metadata = { title: "Profilo" };

export default function ProfiloPage() {
  return (
    <>
      <PageHeader title="Profilo" />
      <Soon
        icon="history"
        title="Nessun allenamento registrato"
        line="Qui vedrai lo storico delle tue sessioni e il riepilogo personale."
      />
    </>
  );
}
