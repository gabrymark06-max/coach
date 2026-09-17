export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Base OpenGraph condivisa (QA M8): Next fonde i metadata per chiave di primo livello, quindi ogni pagina che dichiara
 * `openGraph` deve ripartire da qui o perde immagine, tipo e sito. */
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "fitcoach — una scheda che dice perché" };
export const OG_BASE = { type: "website" as const, siteName: "fitcoach", locale: "it_IT", images: [OG_IMAGE] };
// I prezzi Pro non sono costanti del client: arrivano da GET /billing/prices (contratto §9, v1.1.3). Vedi src/lib/prices.ts.
