import type { Metadata } from "next";
import { MisureView } from "./misure-view";

export const metadata: Metadata = {
  title: "Misure",
  description: "Peso corporeo, massa grassa e circonferenze, con l'andamento nel tempo.",
};

export default function MisurePage() {
  return <MisureView />;
}
