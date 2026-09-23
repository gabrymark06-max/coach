"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDurationLong, formatInt, formatVolumeKg } from "@/lib/format";
import { useNow } from "@/lib/hooks/use-now";
import { totalsFromAggregate, type SessionAggregate } from "@/lib/logic/stats";
import { cn } from "@/lib/utils";

/**
 * `ProfileHeader` — §4.22. **L'intestazione non ha un avatar.**
 *
 * Il riferimento mette avatar, username, Follower e Seguiti; di quei quattro, tre non
 * esistono qui e il quarto e' un cerchio con una lettera dentro. Al loro posto quello
 * che l'utente possiede davvero: **i numeri**.
 *
 * **Questi numeri si calcolano su tutte le sessioni completate, non sulla lista
 * troncata** (QA GRAVE 3). Il profilo si fermava a 200 allenamenti senza dirlo, e
 * `/statistiche` ne contava 220: due schermate della stessa app, due numeri diversi
 * sullo stesso dato.
 */
export function ProfileHeader({ aggregate }: { aggregate: SessionAggregate }) {
  const now = useNow(60_000);
  const totals = React.useMemo(
    () => totalsFromAggregate(aggregate, now || undefined),
    [aggregate, now],
  );

  const celle: [string, string][] = [
    ["Allenamenti", formatInt(totals.sessions)],
    ["Volume", formatVolumeKg(totals.volumeKg)],
    ["Serie", formatInt(totals.sets)],
    // QA MINORE 3: mai «12000 min» su un totale di vita.
    ["Tempo", formatDurationLong(totals.durationSec * 1000)],
  ];

  return (
    <section
      aria-label="I tuoi totali"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
    >
      <dl className="grid grid-cols-2 gap-5 3col:grid-cols-4">
        {celle.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-label text-[var(--text-secondary)]">{label}</dt>
            <dd className="tnum mt-1 truncate text-h2 text-[var(--text-primary)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Mai quattro zeri muti: lo zero va con la frase e con l'invito (§4.22). */}
      {totals.sessions === 0 ? (
        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <p className="text-base text-[var(--text-secondary)]">
            Nessun allenamento registrato.
          </p>
          <Button className="mt-3" block asChild>
            <Link href="/allenamento">Inizia ad allenarti</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--elev-1)]"
    >
      <div className="grid grid-cols-2 gap-5 3col:grid-cols-4">
        {[0, 1, 2, 3].map((cell) => (
          <div key={cell}>
            <Skeleton className="h-4 w-20 rounded-[var(--radius-sm)]" />
            <Skeleton className="mt-1 h-7 w-24 rounded-[var(--radius-sm)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { href: "/profilo", label: "Riepilogo" },
  { href: "/statistiche", label: "Statistiche" },
  { href: "/misure", label: "Misure" },
];

/**
 * `StatsTabs` — §4.22.
 *
 * `role="tablist"` **non si usa** qui: sono link di navigazione verso tre rotte reali,
 * non pannelli locali. Con `<a>` veri Cmd+click funziona e il tasto Indietro fa quello
 * che deve (§11.5). Il segmented control e' solo la forma.
 */
export function StatsTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sezioni del profilo">
      <ul className="flex h-12 items-center gap-1 rounded-[var(--radius-full)] bg-[var(--popover)] p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center justify-center rounded-[var(--radius-full)] px-3 text-sm",
                  "transition-[background-color,color] duration-[var(--dur-1)] ease-[var(--ease-out)]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                  active
                    ? "bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
