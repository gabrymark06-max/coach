import type { Metadata } from "next";
import { ModificaRoutineView } from "./modifica-view";

export const metadata: Metadata = { title: "Modifica routine" };

export default function ModificaRoutinePage() {
  return <ModificaRoutineView />;
}
