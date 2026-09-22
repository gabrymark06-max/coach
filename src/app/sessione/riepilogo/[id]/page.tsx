import type { Metadata } from "next";
import { RiepilogoView } from "./riepilogo-view";

export const metadata: Metadata = { title: "Riepilogo allenamento" };

export default function RiepilogoPage() {
  return <RiepilogoView />;
}
