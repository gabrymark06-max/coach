import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Soon } from "@/components/shared/soon";

export const metadata: Metadata = { title: "Statistiche" };

export default function StatistichePage() {
  return (
    <>
      <PageHeader title="Statistiche" />
      <Soon
        icon="trending"
        title="Servono più dati"
        line="Qui arriveranno volume settimanale, 1RM stimato e distribuzione per gruppo muscolare."
      />
    </>
  );
}
