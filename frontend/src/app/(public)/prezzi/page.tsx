import type { Metadata } from "next";
import { Pricing } from "./Pricing";
import { getRules } from "@/lib/rules";
import { OG_BASE } from "@/lib/site";
import { getPrices, priceOf } from "@/lib/prices";
import { formatEuro } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const prices = await getPrices();
  const month = priceOf(prices, "month");
  return {
    title: "Prezzi",
    description: `Un piano gratis per sempre, ${month ? `un piano Pro a ${formatEuro(month.amount_eur)}/mese o ${formatEuro(priceOf(prices, "year")?.amount_eur ?? month.amount_eur)}/anno, IVA inclusa` : "un piano Pro mensile o annuale, IVA inclusa"}. Nessuna sorpresa: disdici quando vuoi, recesso entro 14 giorni.`,
    alternates: { canonical: "/prezzi" },
    openGraph: { ...OG_BASE, title: "Prezzi · fitcoach", description: month ? `Base gratis per sempre. Pro ${formatEuro(month.amount_eur)}/mese, IVA inclusa.` : "Base gratis per sempre. Pro mensile o annuale, IVA inclusa.", url: "/prezzi" },
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ da?: string }> }) {
  const [notes, { da }, prices] = await Promise.all([getRules(["system.vat", "system.withdrawal"]), searchParams, getPrices()]);
  return <Pricing notes={notes} da={da ?? null} initialPrices={prices} />;
}
