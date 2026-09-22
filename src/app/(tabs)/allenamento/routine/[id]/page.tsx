import type { Metadata } from "next";
import { DettaglioRoutineView } from "./dettaglio-view";

export const metadata: Metadata = { title: "Routine" };

export default function DettaglioRoutinePage() {
  return <DettaglioRoutineView />;
}
