// Listino Pro (contratto §9, v1.1.3): GET /billing/prices è la sola fonte dei numeri. Nessuna costante nel client.
import { API_URL } from "@/lib/api/client";
import type { Price, Prices } from "@/lib/api/types";
import { formatEuro } from "@/lib/format";

/** Lato server (landing SSG, prezzi, termini): cache 60 s come /founders; se l'API non risponde torna null e la pagina
 * dice che il prezzo è nella pagina Prezzi, mai un numero inventato. */
export async function getPrices(): Promise<Prices | null> {
  try {
    const res = await fetch(`${API_URL}/billing/prices`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as Prices;
  } catch {
    return null;
  }
}

export function priceOf(prices: Prices | null | undefined, key: Price["key"]): Price | null {
  return prices?.prices.find((p) => p.key === key) ?? null;
}

/** Copia onesta per la meta description quando i numeri ci sono, neutra quando mancano. */
export function priceLine(prices: Prices | null): string {
  const m = priceOf(prices, "month");
  const y = priceOf(prices, "year");
  if (!m || !y) return "poi un piano Pro mensile o annuale, IVA inclusa";
  return `poi ${formatEuro(m.amount_eur)}/mese o ${formatEuro(y.amount_eur)}/anno, IVA inclusa`;
}
