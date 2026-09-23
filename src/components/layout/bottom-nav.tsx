"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * `BottomNav` — §4.11, con le **cinque tab nuove** di v2.
 *
 * Vive solo sotto `--bp-lg`. Da 1024 in su non esiste: al suo posto c'e' la `Sidebar`
 * (§4.19), che sostituisce il rail laterale da 240px della v1 — quel rail e' stato
 * **cancellato**, non affiancato. Il montaggio lo decide `AppShell` con una media query
 * letta da JS, non da CSS: due `<nav>` con lo stesso `aria-label`, uno dei quali
 * nascosto, resterebbero comunque due nel documento (§8.9).
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[var(--z-nav)] border-t border-[var(--border)] bg-[var(--background)]",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex h-14">
        {NAV_ITEMS.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 w-full min-w-0 flex-col items-center justify-center gap-0.5",
                  "transition-[background-color,color] duration-[var(--dur-2)] ease-[var(--ease-out)]",
                  "hover:bg-[var(--surface-hover)]",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
                  active ? "text-[var(--accent-blue)]" : "text-[var(--text-secondary)]",
                )}
              >
                {/* quattro segnali sull'attiva: binario, riempimento, colore, peso */}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5 bg-[var(--blue-brand)]"
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
                    active ? "font-bold" : "font-semibold",
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
