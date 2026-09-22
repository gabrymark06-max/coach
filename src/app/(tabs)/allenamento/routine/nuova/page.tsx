import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { RoutineEditor } from "@/components/routine/routine-editor";

export const metadata: Metadata = { title: "Nuova routine" };

export default function NuovaRoutinePage() {
  return (
    <>
      <PageHeader title="Nuova routine" />
      <div className="app-container">
        <RoutineEditor />
      </div>
    </>
  );
}
