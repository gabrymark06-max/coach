"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { GlobalSearch } from "./global-search";
import { LocalStateBlock } from "./local-state-block";
import { isActive, NAV_ITEMS, PROFILE_SUBNAV, SETTINGS_ITEM } from "./nav-items";
import { SidebarSessionBar } from "./session-bar";
import { cn } from "@/lib/utils";

/**
 * `Sidebar` — §4.19, la navigazione da `--bp-lg` in su.
 *
 * Sostituisce il rail di 240px della v1, che e' stato **cancellato**. E' fissa, non
 * collassabile, non a scomparsa: un guscio che si puo' nascondere costa un pulsante,
 * uno stato da ricordare e una decisione a ogni apertura, e su un'app con sei
 * destinazioni non compra niente.
 *
 * Il blocco inferiore (separatore, Impostazioni, sessione, stato locale) e' spinto in
 * basso da un `margin-top: auto`, **non** da una posizione assoluta: se la finestra e'
 * bassa la lista scorre e il piede scende con lei invece di coprirla (§8.10).
 */
export function Sidebar() {
  const pathname = usePathname();
  const profiloAttivo = isActive(pathname, NAV_ITEMS[NAV_ITEMS.length - 1]);

  return (
    <nav
      aria-label="Navigazione principale"
      className={cn(
        "fixed inset-y-0 left-0 z-[var(--z-nav)] flex w-[var(--sidebar-w)] flex-col",
        "border-r border-[var(--border)] bg-[var(--card)]",
        "px-[var(--sidebar-pad-x)] py-6",
        "overflow-y-auto [scrollbar-gutter:stable]",
      )}
    >
      <Link
        href="/home"
        aria-label="Lifted, vai alla home"
        className={cn(
          "mb-5 inline-flex h-11 items-center rounded-[var(--radius-md)] px-3 text-h2 text-[var(--text-primary)]",
          "hover:bg-[var(--surface-hover)]",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        )}
        translate="no"
      >
        Lifted
      </Link>

      <GlobalSearch />

      <ul className="mt-5 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <SidebarLink
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
                current={pathname === item.href}
              />
              {/*
                §4.19.2 — le sotto-voci compaiono solo quando Profilo e' la sezione
                attiva: sette voci piatte sarebbero una lista, tre annidate sono una
                gerarchia. Sono un `<ul>` dentro il `<li>` del padre, cosi' lo screen
                reader legge il rapporto invece dell'elenco.
              */}
              {item.href === "/profilo" && profiloAttivo ? (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {PROFILE_SUBNAV.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          aria-current={subActive ? "page" : undefined}
                          className={cn(
                            "flex h-10 items-center rounded-[var(--radius-md)] pl-8 pr-3 text-sm",
                            "hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                            subActive
                              ? "font-semibold text-[var(--accent-blue)]"
                              : "text-[var(--text-secondary)]",
                          )}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-5">
        <hr className="mb-2 border-t border-[var(--border)]" />
        <SidebarLink
          href={SETTINGS_ITEM.href}
          label={SETTINGS_ITEM.label}
          icon={SETTINGS_ITEM.icon}
          active={pathname.startsWith("/impostazioni")}
          current={pathname.startsWith("/impostazioni")}
        />
        {/*
          §4.19.5 — con una sessione attiva la barra vive **dentro** la sidebar. Fuori
          non compare: a >=1024 non c'e' una bottom nav sopra cui appoggiarla, e una
          barra fissa in fondo alla finestra coprirebbe il contenuto senza motivo.
        */}
        <SidebarSessionBar />
        <LocalStateBlock />
      </div>
    </nav>
  );
}

/**
 * Una voce di navigazione — §4.19.1.
 *
 * L'attiva porta **cinque** segnali insieme: la corsia di 3px (l'elemento firma del
 * sistema), il fondo, l'icona riempita, l'etichetta in `--accent-blue` peso 600 e
 * `aria-current="page"`. Nessuno di questi da solo.
 *
 * L'anello di focus ha `outline-offset: -2px`: resta **dentro** i bounds della voce e
 * non viene tagliato dal bordo della sidebar (§8.10).
 */
function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  current,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  current: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "relative flex h-[var(--sidebar-item-h)] items-center gap-4 rounded-[var(--radius-md)] px-4",
        "transition-[background-color,color] duration-[var(--dur-1)] ease-[var(--ease-out)]",
        "active:scale-[0.99] motion-reduce:active:scale-100",
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
          className="absolute inset-y-1 left-0 w-[3px] rounded-[var(--radius-xs)] bg-[var(--blue-brand)]"
        />
      ) : null}
      <Icon
        aria-hidden="true"
        className="size-5 shrink-0"
        strokeWidth={1.75}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.22 : 0}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}
