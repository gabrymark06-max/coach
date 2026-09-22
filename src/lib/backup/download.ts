/**
 * Salvataggio di un file dal browser.
 *
 * Nessuna libreria: un `Blob`, un oggetto URL e un `<a download>` sintetico. L'URL si
 * revoca subito dopo, altrimenti resta in memoria finche' la scheda e' aperta — su un
 * export di qualche megabyte ripetuto non e' un dettaglio.
 */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Il click e' sincrono ma il download parte dopo: si revoca al giro successivo.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** `lifted-backup-2026-09-22.json` — la data nel nome e' l'unico ordinamento che serve. */
export function backupFilename(prefix: string, extension: string, now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `lifted-${prefix}-${stamp}.${extension}`;
}
