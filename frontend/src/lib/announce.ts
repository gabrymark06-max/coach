// Regione annunci unica per pagina (#annunci, aria-live=polite). Tre annunci per timer, uno per set: mai al secondo.
// Gli annunci vicini nel tempo si accodano (QA M3): due nello stesso giro ("Il coach ha risposto" + fascia quota)
// non si sovrascrivono, il secondo parte dopo una pausa che lascia leggere il primo.
const GAP_MS = 1500;

let queue: string[] = [];
let timer: number | null = null;
let lastAt = 0;

function show(text: string): void {
  const el = document.getElementById("annunci");
  if (!el) return;
  el.textContent = "";
  // due frame: forza lo screen reader a rileggere anche lo stesso testo
  requestAnimationFrame(() => {
    el.textContent = text;
  });
  lastAt = Date.now();
}

function drain(): void {
  timer = null;
  const next = queue.shift();
  if (next === undefined) return;
  show(next);
  if (queue.length > 0) timer = window.setTimeout(drain, GAP_MS);
}

export function announce(text: string): void {
  if (typeof document === "undefined") return;
  const since = Date.now() - lastAt;
  if (timer === null && since >= GAP_MS) {
    show(text);
    return;
  }
  queue.push(text);
  if (timer === null) timer = window.setTimeout(drain, Math.max(0, GAP_MS - since));
}

/** Solo per i test: azzera la coda. */
export function resetAnnouncements(): void {
  queue = [];
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  lastAt = 0;
}
