"use client";

import { History, Ruler, TrendingUp, type LucideIcon } from "lucide-react";
import { EmptyState } from "./states";

/**
 * Le tab del secondo passaggio esistono nella nav e dicono la verita': non sono un
 * link morto, e non fingono un contenuto che non c'e'.
 *
 * L'icona si sceglie per nome e non si passa come componente: una funzione non
 * attraversa il confine fra server e client.
 */
const ICONS: Record<string, LucideIcon> = {
  history: History,
  ruler: Ruler,
  trending: TrendingUp,
};

export function Soon({
  icon,
  title,
  line,
}: {
  icon: keyof typeof ICONS;
  title: string;
  line: string;
}) {
  return (
    <EmptyState
      icon={ICONS[icon]}
      title={title}
      line={
        <>
          {line}
          <br />
          <span className="text-[var(--text-muted)]">Arriva nel prossimo passaggio.</span>
        </>
      }
    />
  );
}
