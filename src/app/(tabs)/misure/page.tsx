import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Soon } from "@/components/shared/soon";

export const metadata: Metadata = { title: "Misure" };

export default function MisurePage() {
  return (
    <>
      <PageHeader title="Misure" />
      <Soon
        icon="ruler"
        title="Nessuna misurazione"
        line="Qui registrerai peso, massa grassa e circonferenze, con l'andamento nel tempo."
      />
    </>
  );
}
