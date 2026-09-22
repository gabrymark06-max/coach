import type { Metadata } from "next";
import { shellParams } from "@/lib/route-shell";
import { RiepilogoView } from "./riepilogo-view";

export const metadata: Metadata = { title: "Riepilogo allenamento" };

/** Una sola scocca prerenderizzata: offline vale per qualunque id (vedi route-shell). */
export function generateStaticParams() {
  return shellParams("id");
}

export default function RiepilogoPage() {
  return <RiepilogoView />;
}
