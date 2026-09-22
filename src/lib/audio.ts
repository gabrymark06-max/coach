"use client";

/**
 * Avviso sonoro di fine recupero (spec §3.1).
 *
 * Sintetizzato con Web Audio invece che caricato da un file: sono 300 ms di due note,
 * pesano zero byte di rete e funzionano offline al primo avvio, senza che il service
 * worker debba averli gia' in cache.
 *
 * Il browser tiene l'`AudioContext` sospeso finche' non c'e' un gesto dell'utente.
 * `unlockAudio()` va chiamata da un gestore di evento reale (il tocco che avvia il
 * timer): se non riesce, `isAudioBlocked()` lo dice e la pill mostra "Audio non attivo".
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/**
 * Lettura pura: non crea il contesto. Finche' non si e' provato a suonare non ha senso
 * dire che l'audio e' bloccato, e creare un `AudioContext` durante il render sarebbe
 * un effetto collaterale nascosto.
 */
export function isAudioBlocked(): boolean {
  return context !== null && context.state !== "running";
}

export function playRestEndTone(): void {
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  for (const [frequency, offset] of [
    [880, 0],
    [1320, 0.13],
  ] as const) {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + offset);
    oscillator.connect(gain);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.16);
  }
}

export function vibrate(pattern: number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Alcuni browser espongono l'API e poi la rifiutano: non e' un errore per l'utente.
  }
}
