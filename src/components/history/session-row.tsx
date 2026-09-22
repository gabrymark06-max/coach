"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import type { Session } from "@/lib/db/schema";
import { formatRelativeDay, formatVolumeKg } from "@/lib/format";
import { useMounted } from "@/lib/hooks/use-now";
import { formatMinutes } from "@/lib/logic/timer";

/**
 * Una riga dello storico.
 *
 * Porta la **corsia** del sistema (§0): binario di 3px a sinistra, ambra quando in quella
 * sessione e' caduto un record, altrimenti assente. Il colore non e' mai solo: se c'e' un
 * PR, accanto alla data c'e' anche la coppa **e** il conteggio scritto.
 */
export function SessionRow({
  session,
  prCount,
}: {
  session: Session;
  prCount: number;
}) {
  const mounted = useMounted();
  const hasPr = prCount > 0;

  return (
    <Link
      href={`/profilo/sessione/${session.id}`}
      className="press relative flex min-h-14 items-center gap-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] py-4 pr-4 pl-5 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] rounded-r-[var(--radius-xs)]"
        style={{ backgroundColor: hasPr ? "var(--pr)" : "transparent" }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-h3 text-[var(--text-primary)]">
          {session.routineName ?? "Sessione libera"}
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {mounted ? formatRelativeDay(session.startedAt) : "—"}
          {" · "}
          <span className="tnum">{formatMinutes(session.durationSec * 1000)}</span>
          {" · "}
          <span className="tnum">{session.totalSets} serie</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="tnum text-num-md text-[var(--text-primary)]">
          {formatVolumeKg(session.totalVolumeKg)}
        </span>
        {hasPr ? (
          <span className="flex items-center gap-1 text-label text-[var(--pr)]">
            <Trophy aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {prCount} PR
          </span>
        ) : null}
      </div>
    </Link>
  );
}
