import {
  ClipboardList,
  Dumbbell,
  House,
  ListChecks,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** rotte che accendono questa voce oltre alla sua */
  alsoMatch?: string[];
}

/**
 * Le cinque destinazioni — §4.11, **riassegnate in v2**.
 *
 * Misure e Statistiche escono dalla barra e diventano due dei tre pannelli di
 * `/profilo`. Non spariscono: restano rotte reali, deep-linkabili, e nella sidebar
 * restano come sotto-voci.
 *
 * Il costo, dichiarato: su telefono Misure passa da 1 tocco a 2. Il motivo: il tetto di
 * **cinque** voci in una bottom nav non e' negoziabile — a sei, la colonna a 375px
 * scende a 62px e l'etichetta non ci sta piu'.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/allenamento", label: "Allenamento", icon: Dumbbell },
  { href: "/trainer", label: "Trainer", icon: ClipboardList },
  { href: "/esercizi", label: "Esercizi", icon: ListChecks },
  {
    href: "/profilo",
    label: "Profilo",
    icon: User,
    // §4.22: statistiche e misure sono pannelli del profilo, non destinazioni a se'
    alsoMatch: ["/statistiche", "/misure"],
  },
];

/** Sotto-voci di Profilo, visibili nella sidebar solo quando Profilo e' attivo (§4.19.2). */
export const PROFILE_SUBNAV = [
  { href: "/profilo", label: "Riepilogo" },
  { href: "/statistiche", label: "Statistiche" },
  { href: "/misure", label: "Misure" },
];

/** Impostazioni sta sotto il separatore, in fondo: e' una destinazione, non una sezione. */
export const SETTINGS_ITEM: NavItem = {
  href: "/impostazioni",
  label: "Impostazioni",
  icon: Settings,
};

/** Una voce e' attiva sulla sua rotta e su tutto quello che ci sta sotto. */
export function isActive(pathname: string, item: NavItem): boolean {
  const matches = [item.href, ...(item.alsoMatch ?? [])];
  return matches.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
