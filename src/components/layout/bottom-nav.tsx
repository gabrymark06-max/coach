"use client";

import { Dumbbell, ListChecks, Ruler, TrendingUp, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/allenamento", label: "Allenamento", icon: Dumbbell },
  { href: "/profilo", label: "Profilo", icon: User },
  { href: "/esercizi", label: "Esercizi", icon: ListChecks },
  { href: "/misure", label: "Misure", icon: Ruler },
  { href: "/statistiche", label: "Statistiche", icon: TrendingUp },
];

/**
 * `BottomNav` — §4.11.
 *
 * Quattro segnali sull'attiva: riempimento dell'icona, colore, peso del testo, binario
 * di 2px sul bordo superiore. Piu' `aria-current="page"`. Nessuno di questi da solo.
 * Da 1024px la nav diventa un rail laterale di 240px (§7.3), con lo stesso DOM.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[var(--z-nav)] border-t border-[var(--border)] bg-[var(--background)]",
        "pb-[env(safe-area-inset-bottom)]",
        "lg:inset-y-0 lg:right-auto lg:w-60 lg:border-r lg:border-t-0 lg:bg-[var(--card)] lg:pb-0",
      )}
    >
      <p className="hidden px-6 pt-8 pb-6 text-h1 text-[var(--text-primary)] lg:block" translate="no">
        Lifted
      </p>
      <ul className="flex h-14 lg:h-auto lg:flex-col lg:gap-1 lg:px-3">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1 lg:flex-none">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 w-full min-w-0 flex-col items-center justify-center gap-0.5",
                  "transition-[background-color,color] duration-[var(--dur-2)] ease-[var(--ease-out)]",
                  "hover:bg-[var(--surface-hover)]",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                  "lg:h-12 lg:flex-row lg:justify-start lg:gap-4 lg:rounded-[var(--radius-md)] lg:px-4",
                  active ? "text-[var(--accent-blue)]" : "text-[var(--text-secondary)]",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5 bg-[var(--blue-brand)] lg:inset-y-0 lg:right-auto lg:left-0 lg:h-auto lg:w-0.5"
                  />
                ) : null}
                <Icon
                  aria-hidden="true"
                  className="size-6 shrink-0 transition-transform duration-[var(--dur-1)] active:scale-[0.94] motion-reduce:active:scale-100"
                  strokeWidth={1.75}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.22 : 0}
                />
                {/*
                  Maiuscoletto no: "ALLENAMENTO" a 12px con 0,06em di tracking misura
                  ~95px e la colonna a 375 ne ha 75. §11.10 riserva le maiuscole
                  integrali a TERMINA, AVVIA e alle intestazioni di colonna, quindi qui
                  vince quella regola. Restano 12px/600 e i 48px di area tattile.
                */}
                <span
                  className={cn(
                    "w-full truncate px-0.5 text-center text-xs leading-4 tracking-[0.01em]",
                    "lg:px-0 lg:text-base lg:tracking-normal",
                    active ? "font-bold" : "font-semibold lg:font-normal",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
