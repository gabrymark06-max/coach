import type { Metadata } from "next";
import Link from "next/link";
import { getRules } from "@/lib/rules";
import { OG_BASE } from "@/lib/site";
import { getPrices, priceLine } from "@/lib/prices";
import { Landing } from "./Landing";

export async function generateMetadata(): Promise<Metadata> {
  const prices = await getPrices();
  return {
    title: { absolute: "fitcoach — una scheda che dice perché" },
    description: `Una scheda da palestra con le note a piè di pagina e un coach AI che ti scrive il giorno in cui non hai voglia. Primo blocco di 4 settimane gratis e completo, ${priceLine(prices)}.`,
    alternates: { canonical: "/" },
    openGraph: {
      ...OG_BASE,
      title: "fitcoach — una scheda che dice perché",
      description: "Per chi va in palestra da solo, da poco o dopo una pausa. Primo blocco gratis e completo.",
      url: "/",
    },
  };
}

// Le note della landing (direzione §10): 1 cos'è fitcoach, 2 volume, 3 recupero, 4 RIR, 5 IVA, 6 costanza.
const RULE_IDS = ["system.about", "volume.weekly_sets.beginner", "rest.compound", "rir.target.beginner", "system.vat", "system.consistency"];

export default async function Home() {
  const [notes, prices] = await Promise.all([getRules(RULE_IDS), getPrices()]);
  return (
    <>
      <Landing notes={notes} prices={prices} />
      <p className="visually-hidden">
        <Link href="/prezzi">Prezzi</Link>
      </p>
    </>
  );
}
