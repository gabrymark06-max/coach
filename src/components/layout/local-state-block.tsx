"use client";

import { AlertTriangle, Download } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { createBackup } from "@/lib/db/backup-ops";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import { backupFilename, downloadFile } from "@/lib/backup/download";
import { serializeBackup } from "@/lib/backup/format";
import { formatRelativeDay } from "@/lib/format";
import { useMounted, useNow } from "@/lib/hooks/use-now";
import { useSettings } from "@/lib/session-context";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

/**
 * `LocalStateBlock` — §4.19.4, il piede della sidebar.
 *
 * Al posto del blocco account del riferimento. E' la traduzione onesta di «chi sei»:
 * qui non conta chi sei, conta **dove stanno i tuoi dati** — che in un'app local-first
 * e' l'unica informazione di stato che valga un posto fisso sullo schermo.
 *
 * I tre stati dell'eta' del backup non si distinguono solo dal colore della corsia
 * (§8.2): oltre i 14 giorni compare anche un'icona, e il testo dice sempre il numero.
 */
export function LocalStateBlock() {
  const settings = useSettings();
  const mounted = useMounted();
  // L'orologio condiviso, non `Date.now()` in render (§11.7): l'eta' del backup si
  // misura in giorni, quindi basta un aggiornamento al minuto.
  const now = useNow(60_000);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const lastExportAt = settings.lastExportAt;
  const ageDays = React.useMemo(() => {
    if (!lastExportAt || !now) return null;
    const then = Date.parse(lastExportAt);
    if (Number.isNaN(then)) return null;
    return Math.floor((now - then) / DAY_MS);
  }, [lastExportAt, now]);

  const state = failed
    ? "error"
    : busy
      ? "busy"
      // Prima dell'idratazione l'eta' non si sa: si mostra il guscio, non «mai» (§11.7).
      : !mounted || now === 0
        ? "loading"
        : ageDays === null
        ? "never"
        : ageDays <= 7
          ? "fresh"
          : ageDays <= 14
            ? "aging"
            : "stale";

  const lane = {
    loading: "bg-[var(--border-strong)]",
    fresh: "bg-[var(--success)]",
    aging: "bg-[var(--warning)]",
    stale: "bg-[var(--warning)]",
    never: "bg-[var(--warning)]",
    busy: "bg-[var(--accent-blue)]",
    error: "bg-[var(--danger)]",
  }[state];

  const esporta = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const backup = await createBackup(getDb());
      downloadFile(
        backupFilename("lifted", "json"),
        serializeBackup(backup),
        "application/json",
      );
      await updateSettings(getDb(), { lastExportAt: backup.exportedAt });
      toast.success("Backup esportato");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "relative mt-3 min-h-[var(--sidebar-foot-h)] overflow-hidden rounded-[var(--radius-md)]",
        "border border-[var(--border)] bg-[var(--popover)] p-4 pl-5",
      )}
    >
      {/* la corsia: l'elemento firma del sistema (§0) */}
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-[3px] rounded-[var(--radius-xs)]", lane)}
      />
      {/*
        Il pulsante sta sopra la prima riga, non accanto al blocco: nella colonna da
        264px restano ~160px di testo se si affianca, e «Dati su questo dispositivo»
        andava a capo due volte. Cosi' la seconda riga usa tutta la larghezza.
      */}
      <button
        type="button"
        onClick={() => void esporta()}
        disabled={busy}
        aria-label="Esporta un backup adesso"
        className={cn(
          "press absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)]",
          "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
          "disabled:text-[var(--text-disabled)]",
        )}
      >
        <Download aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </button>
      <div className="min-w-0">
        <p className="pr-11 text-sm text-[var(--text-primary)]">
          Dati su questo dispositivo
        </p>
        <Riga state={state} lastExportAt={lastExportAt} mounted={mounted} />
      </div>
      {state === "error" ? (
        <button
          type="button"
          onClick={() => void esporta()}
          className="mt-1 h-11 rounded-[var(--radius-sm)] text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          Riprova
        </button>
      ) : null}
    </div>
  );
}

function Riga({
  state,
  lastExportAt,
  mounted,
}: {
  state: string;
  lastExportAt?: string;
  mounted: boolean;
}) {
  if (state === "busy") {
    return <p className="mt-0.5 text-sm text-[var(--text-muted)]">Esporto…</p>;
  }
  if (state === "loading") {
    return <p className="mt-0.5 text-sm text-[var(--text-muted)]">Ultimo backup: —</p>;
  }
  if (state === "error") {
    return <p className="mt-0.5 text-sm text-[var(--danger)]">Esportazione non riuscita.</p>;
  }
  /*
    Oltre i 14 giorni il colore non basta piu' (§8.2): entra anche l'icona, che e' il
    terzo canale. «Mai» e «vecchio» restano due frasi diverse — dire «Nessun backup» a
    chi ne ha fatto uno tre settimane fa sarebbe falso, e un avviso falso si impara a
    ignorare.
  */
  if (state === "never" || state === "stale") {
    return (
      <p className="mt-0.5 flex items-start gap-2 text-sm text-[var(--pr)]">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0"
          strokeWidth={1.75}
        />
        <span>
          {state === "never" ? (
            <>
              <strong className="font-semibold">Nessun backup.</strong> I dati sono solo qui.
            </>
          ) : (
            <>
              Ultimo backup:{" "}
              {mounted && lastExportAt ? formatRelativeDay(lastExportAt) : "—"}
            </>
          )}
        </span>
      </p>
    );
  }
  return (
    <p
      className={cn(
        "mt-0.5 text-sm",
        state === "fresh" ? "text-[var(--text-muted)]" : "text-[var(--pr)]",
      )}
    >
      Ultimo backup:{" "}
      {mounted && lastExportAt ? formatRelativeDay(lastExportAt) : "—"}
    </p>
  );
}
