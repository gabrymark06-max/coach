export interface RecentHit {
  id: string;
  label: string;
  href: string;
  group: "ESERCIZI" | "ROUTINE";
}

/**
 * Le ultime cinque aperture dalla ricerca globale (§4.19.3, stato «campo vuoto al focus»).
 *
 * Sta in `localStorage` e non in Dexie di proposito: non e' un dato dell'utente, e' una
 * comodita' di questo dispositivo. Non entra nel backup, non va perso se si perde, e
 * soprattutto non fa crescere il file che l'utente si porta dietro.
 *
 * La chiave porta la versione: il giorno che la forma cambia, una lettura vecchia si
 * scarta invece di arrivare tipizzata male dentro la UI.
 */
const KEY = "lifted.recentSearches.v1";
const MAX = 5;

export function readRecentSearches(): RecentHit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHit).slice(0, MAX);
  } catch {
    // Storage pieno, disabilitato o contenuto illeggibile: si riparte da zero.
    return [];
  }
}

export function pushRecentSearch(hit: RecentHit): RecentHit[] {
  const next = [hit, ...readRecentSearches().filter((one) => one.id !== hit.id)].slice(
    0,
    MAX,
  );
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Una comodita' che non si puo' salvare non e' un errore da mostrare.
  }
  return next;
}

function isHit(value: unknown): value is RecentHit {
  if (typeof value !== "object" || value === null) return false;
  const hit = value as Record<string, unknown>;
  return (
    typeof hit.id === "string" &&
    typeof hit.label === "string" &&
    typeof hit.href === "string" &&
    (hit.group === "ESERCIZI" || hit.group === "ROUTINE")
  );
}
