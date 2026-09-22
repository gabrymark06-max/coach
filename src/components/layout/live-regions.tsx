/**
 * Le quattro regioni `aria-live` di §8.5.
 *
 * Sempre montate nel layout root e mai create al volo: una regione creata insieme al
 * testo non viene annunciata. Il testo ci viene scritto direttamente (`lib/announce.ts`),
 * senza passare per lo stato di React.
 */
export function LiveRegions() {
  return (
    <>
      <div id="sr-session" className="sr-only" aria-live="polite" aria-atomic="true" />
      <div id="sr-timer" className="sr-only" aria-live="assertive" aria-atomic="true" />
      <div id="sr-pr" className="sr-only" aria-live="polite" aria-atomic="true" />
      <div id="sr-system" className="sr-only" aria-live="polite" aria-atomic="true" />
    </>
  );
}
