import type { Metadata } from "next";
import { shellParams } from "@/lib/route-shell";
import { DettaglioSessioneView } from "./dettaglio-view";

export const metadata: Metadata = { title: "Allenamento" };

export function generateStaticParams() {
  return shellParams("id");
}

export default function DettaglioSessionePage() {
  return <DettaglioSessioneView />;
}
