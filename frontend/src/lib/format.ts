// Formattazione italiana: virgola decimale, primo/doppio primo, date a parole. Nessun testo di UI qui oltre alla quota.

const nf1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

export function formatKg(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return nf1.format(v);
}

export function formatRest(seconds: number): string {
  if (seconds > 0 && seconds % 60 === 0) return `${seconds / 60}′`;
  return `${seconds}″`;
}

export function formatRange(r: { value?: number | null; range?: number[] | null }): string {
  if (r.range && r.range.length === 2) return `${r.range[0]}–${r.range[1]}`;
  if (r.value !== null && r.value !== undefined) return String(r.value);
  return "—";
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

export function formatEuro(v: number): string {
  return `${new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} €`;
}

const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
const shortDayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });
const timeFmt = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const monthDayFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "Europe/Rome" });

function parseDate(d: string): Date {
  // "YYYY-MM-DD" → mezzogiorno a Roma per evitare slittamenti di fuso
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00+02:00`);
  return new Date(d);
}

export function formatDayLabel(isoDate: string): string {
  return dayFmt.format(parseDate(isoDate));
}

export function formatLongDay(isoDate: string): string {
  return shortDayFmt.format(parseDate(isoDate));
}

export function formatDate(iso: string): string {
  return dateFmt.format(parseDate(iso));
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function formatResetDay(iso: string): string {
  const s = monthDayFmt.format(new Date(iso));
  return s.replace(/^1 /, "1° ");
}

export type QuotaBand = "ok" | "low" | "exhausted";

export function quotaLine(
  q: { used: number; limit: number; resets_at: string; daily_used?: number | null; daily_limit?: number | null },
  plan: "free" | "pro",
): { text: string; band: QuotaBand } {
  if (plan === "pro") {
    if (q.daily_limit != null && q.daily_used != null) {
      const left = q.daily_limit - q.daily_used;
      if (left <= 0) return { text: "Hai usato i 40 messaggi di oggi. Domani si azzerano.", band: "exhausted" };
      if (left <= 5) return { text: `Ti restano ${left} messaggi oggi`, band: "low" };
    }
    return { text: `Messaggi illimitati · uso ragionevole ${q.limit} al mese`, band: "ok" };
  }
  const left = Math.max(0, q.limit - q.used);
  if (left === 0) return { text: `${q.limit} su ${q.limit} messaggi usati.`, band: "exhausted" };
  if (left <= 3) {
    return { text: `Ti restano ${left} messaggi questo mese. Si azzerano il ${formatResetDay(q.resets_at)}.`, band: "low" };
  }
  return { text: `${left} messaggi rimasti questo mese`, band: "ok" };
}

export function weekdayShort(day: string): string {
  const map: Record<string, string> = { mon: "Lun", tue: "Mar", wed: "Mer", thu: "Gio", fri: "Ven", sat: "Sab", sun: "Dom" };
  return map[day] ?? day;
}

export function weekdayLong(day: string): string {
  const map: Record<string, string> = {
    mon: "Lunedì",
    tue: "Martedì",
    wed: "Mercoledì",
    thu: "Giovedì",
    fri: "Venerdì",
    sat: "Sabato",
    sun: "Domenica",
  };
  return map[day] ?? day;
}
