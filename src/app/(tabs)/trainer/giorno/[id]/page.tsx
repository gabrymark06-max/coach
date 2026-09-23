import type { Metadata } from "next";
import { shellParams } from "@/lib/route-shell";
import { GiornoView } from "./giorno-view";

export const metadata: Metadata = {
  title: "Giorno del programma",
  description: "Gli esercizi del giorno, il carico consigliato e il perché di ognuno.",
};

/** Una sola scocca prerenderizzata: offline vale per qualunque id (vedi route-shell). */
export function generateStaticParams() {
  return shellParams("id");
}

export default function GiornoPage() {
  return <GiornoView />;
}
