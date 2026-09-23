"use client";

import { ArrowLeft, Database, Info, Smartphone, Dumbbell, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useMounted, useNow } from "@/lib/hooks/use-now";
import { useSettings } from "@/lib/session-context";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

interface SettingsEntry {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

interface SettingsGroup {
  title: string;
  entries: SettingsEntry[];
}

/** L'indice di §4.28: quattro gruppi, una rotta per sezione. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: "Allenamento",
    entries: [
      {
        href: "/impostazioni/allenamento",
        label: "In palestra",
        hint: "Timer di recupero, RPE, unità e arrotondamenti, bilanciere e dischi, riscaldamento.",
        icon: Dumbbell,
      },
    ],
  },
  {
    title: "App",
    entries: [
      {
        href: "/impostazioni/app",
        label: "Aspetto e suoni",
        hint: "Tema, lingua, suono e vibrazione.",
        icon: Smartphone,
      },
    ],
  },
  {
    title: "Dati",
    entries: [
      {
        href: "/impostazioni/dati",
        label: "Backup ed esportazione",
        hint: "Esporta, importa, cancella tutti i dati.",
        icon: Database,
      },
    ],
  },
  {
    title: "Info",
    entries: [
      {
        href: "/impostazioni/info",
        label: "Informazioni",
        hint: "Versione, licenze, dove stanno i tuoi dati.",
        icon: Info,
      },
    ],
  },
];

/**
 * Il guscio delle impostazioni.
 *
 * Da 1024 in su resta la **sidebar**: la voce «Impostazioni» e' li' dentro, e una voce
 * di navigazione che porta in un posto dove la navigazione sparisce e' una trappola.
 * Sotto 1024 le impostazioni restano quello che erano in v1 — una destinazione con una
 * via d'uscita esplicita, non una sezione in cui si vive — quindi niente bottom nav e
 * un link vero indietro, non un `history.back()` che dipende da come ci si e' arrivati.
 *
 * Il `<main id="contenuto">` e' qui e il titolo della sezione ci sta **dentro**
 * (QA MINORE 6: l'intestazione stava fuori dal landmark e axe segnalava `region`).
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const desktop = useIsDesktop();

  return (
    <div className="shell min-h-dvh">
      {desktop ? <Sidebar /> : null}
      <div className="shell__content">
        {desktop ? null : (
          <header className="app-container pt-5">
            <Link
              href="/profilo"
              className="press inline-flex h-12 items-center gap-3 rounded-[var(--radius-btn)] px-3 text-base text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Profilo
            </Link>
          </header>
        )}
        <main id="contenuto" tabIndex={-1} className="pb-9">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * `SettingsTwoPane` — §4.28.
 *
 * Indice a sinistra, pannello a destra, **tutto dentro la colonna centrale**: la colonna
 * destra del guscio resta vuota su questa rotta, perche' un indice e' gia' una colonna
 * di supporto e due sarebbero una di troppo.
 *
 * Sotto 1024 l'indice non si affianca: `/impostazioni` **e'** l'indice e la sezione e'
 * la rotta figlia, lo stesso master-detail che `/misure` usa gia'.
 */
export function SettingsTwoPane({ children }: { children: React.ReactNode }) {
  const desktop = useIsDesktop();

  if (!desktop) return <>{children}</>;

  return (
    <div className="app-container grid grid-cols-[var(--settings-index-w)_minmax(0,1fr)] gap-8 pt-9">
      <div className="border-r border-[var(--border)] pr-8">
        <SettingsIndex />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * L'indice. E' un `<nav>` con link veri e `aria-current`, non un `role="tablist"`:
 * sono destinazioni, quindi Cmd+click funziona e il tasto Indietro fa quello che deve.
 *
 * La voce attiva porta **tre** segnali oltre al colore: corsia di 2px, fondo, peso 600.
 */
export function SettingsIndex({ standalone = false }: { standalone?: boolean }) {
  const pathname = usePathname();
  const badge = useBackupBadge();

  return (
    <nav aria-label="Sezioni delle impostazioni" className="flex flex-col gap-5">
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1 text-label text-[var(--text-secondary)]">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.entries.map((entry) => {
              const active = pathname === entry.href;
              const warn = group.title === "Dati" && badge !== null;
              const Icon = entry.icon;
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={warn ? `${entry.label}, ${badge}` : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-[var(--radius-md)] px-4",
                      standalone ? "min-h-14 py-3" : "min-h-11 py-2",
                      "hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                      active
                        ? "bg-[var(--surface-hover)] font-semibold text-[var(--accent-blue)]"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1 left-0 w-0.5 rounded-[var(--radius-xs)] bg-[var(--blue-brand)]"
                      />
                    ) : null}
                    <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base">{entry.label}</span>
                      {standalone ? (
                        <span className="block text-sm font-normal text-[var(--text-secondary)]">
                          {entry.hint}
                        </span>
                      ) : null}
                    </span>
                    {warn ? (
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-[var(--warning)]"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** «Dati, nessun backup da 18 giorni» — il punto ambra non e' mai solo un punto (§8.2). */
function useBackupBadge(): string | null {
  const settings = useSettings();
  const mounted = useMounted();
  const now = useNow(60_000);

  if (!mounted || now === 0) return null;
  if (!settings.lastExportAt) return "nessun backup";
  const then = Date.parse(settings.lastExportAt);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((now - then) / DAY_MS);
  return days > 14 ? `nessun backup da ${days} giorni` : null;
}

/** Titolo di una sezione: l'`h1` della rotta, **dentro** `<main>`. */
export function SettingsPanelHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const desktop = useIsDesktop();
  return (
    <header className={cn(desktop ? "pb-5" : "app-container pt-9 pb-5")}>
      <h1 className="text-h1 text-[var(--text-primary)]">{title}</h1>
      {description ? (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      ) : null}
    </header>
  );
}
