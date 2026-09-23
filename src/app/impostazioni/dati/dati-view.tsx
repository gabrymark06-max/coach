"use client";

import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { LocalDataBanner } from "@/components/settings/controls";
import { SettingsPanelHeader } from "@/components/settings/settings-two-pane";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Async, EmptyState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { announce } from "@/lib/announce";
import { measurementsCsv, personalRecordsCsv, setsCsv } from "@/lib/backup/csv";
import { backupFilename, downloadFile } from "@/lib/backup/download";
import {
  BackupError,
  parseBackup,
  serializeBackup,
  type LiftedBackup,
} from "@/lib/backup/format";
import {
  createBackup,
  readBackupPayload,
  restoreBackup,
  tableCounts,
  wipeAllData,
} from "@/lib/db/backup-ops";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import {
  formatFull,
  formatInt,
  formatMeasurementCount,
  formatSessionCount,
} from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useMounted } from "@/lib/hooks/use-now";
import { useSettings } from "@/lib/session-context";

/**
 * Lo scheletro dell'anteprima ha **la stessa struttura** del blocco vero — titolo e
 * griglia di cinque riquadri — non un paio di rettangoli di altezza indovinata: e' cosi'
 * che l'arrivo dei conteggi non sposta niente.
 */
function ContenutoSkeleton() {
  return (
    <section aria-hidden="true" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-64 rounded-[var(--radius-sm)]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[0, 1, 2, 3, 4].map((cella) => (
          <div
            key={cella}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <Skeleton className="h-4 w-20 rounded-[var(--radius-sm)]" />
            <Skeleton className="mt-1 h-7 w-12 rounded-[var(--radius-sm)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * `/impostazioni/dati` — spec §3.7, design system §6.5.
 *
 * Export e import sono **funzioni di prima classe**: i dati vivono solo qui, e il file
 * e' l'unica rete di sicurezza. Da cui tre scelte visibili in questa schermata:
 *
 *  - l'anteprima dice **quanto** si sta per esportare o sovrascrivere, voce per voce;
 *  - l'import non parte dal tocco sul file: il file si legge e si valida, poi si mostra
 *    cosa sostituira' cosa, e solo allora c'e' un pulsante `Sostituisci`. La conferma
 *    non e' saltabile e offre `Esporta prima`;
 *  - JSON e CSV hanno scopi diversi e si dicono: il JSON si rilegge, il CSV si guarda.
 */
export function DatiView() {
  const settings = useSettings();
  const mounted = useMounted();
  const desktop = useIsDesktop();

  const counts = useLiveData(() => tableCounts(getDb()), []);
  const [pending, setPending] = React.useState<LiftedBackup | null>(null);
  const [wiping, setWiping] = React.useState(false);
  const [busy, setBusy] = React.useState<"json" | "csv" | "import" | "wipe" | null>(null);
  const [readError, setReadError] = React.useState<{ message: string; detail?: string } | null>(
    null,
  );
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const exportJson = async () => {
    if (busy) return;
    setBusy("json");
    try {
      const backup = await createBackup(getDb());
      downloadFile(
        backupFilename("backup", "json"),
        serializeBackup(backup),
        "application/json",
      );
      await updateSettings(getDb(), { lastExportAt: new Date().toISOString() });
      toast.success("Backup esportato");
      announce("system", "Backup esportato.");
    } catch {
      toast.error("Non riesco a leggere i dati di questo dispositivo per esportarli.");
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    if (busy) return;
    setBusy("csv");
    try {
      const db = getDb();
      const payload = await readBackupPayload(db);
      const nameById = new Map(payload.exercises.map((item) => [item.id, item.name]));
      downloadFile(backupFilename("allenamenti", "csv"), setsCsv(payload.sessions), "text/csv");
      downloadFile(backupFilename("misure", "csv"), measurementsCsv(payload.measurements), "text/csv");
      downloadFile(
        backupFilename("record", "csv"),
        personalRecordsCsv(payload.personalRecords, nameById),
        "text/csv",
      );
      toast.success("Tre file CSV esportati");
    } catch {
      toast.error("Non riesco a leggere i dati di questo dispositivo per esportarli.");
    } finally {
      setBusy(null);
    }
  };

  const readFile = async (file: File) => {
    setReadError(null);
    try {
      const backup = parseBackup(await file.text());
      setPending(backup);
    } catch (error) {
      if (error instanceof BackupError) {
        setReadError({ message: error.message, detail: error.detail });
      } else {
        setReadError({ message: "Non riesco a leggere questo file." });
      }
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pending || busy) return;
    setBusy("import");
    try {
      const result = await restoreBackup(getDb(), pending);
      setPending(null);
      const frase =
        `${result.counts.sessions === 1 ? "Importato" : "Importati"} ${formatSessionCount(result.counts.sessions)}` +
        ` e ${formatMeasurementCount(result.counts.measurements)}`;
      toast.success(frase);
      announce("system", `${frase}.`);
    } catch {
      toast.error(
        "Importazione annullata: il dispositivo ha rifiutato la scrittura e i dati di prima sono intatti.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SettingsPanelHeader
        title="Backup ed esportazione"
        description="I dati vivono solo qui: il file di export è l'unica rete di sicurezza."
      />

      <div
        className={cn(
          "flex flex-col gap-8 pb-8",
          desktop ? "" : "app-container",
        )}
      >
        <LocalDataBanner
          lastExportAt={
            settings.lastExportAt && mounted ? formatFull(settings.lastExportAt) : null
          }
        />

        <Async
          state={counts}
          loading={<ContenutoSkeleton />}
          errorDetail="Non riesco a contare i dati su questo dispositivo."
        >
          {(data) => {
            const vuoto =
              data.sessions === 0 && data.measurements === 0 && data.routines === 0;
            if (vuoto) {
              return (
                <EmptyState
                  icon={Download}
                  title="Nessun backup"
                  line="Non c'è ancora niente da esportare: registra un allenamento o una misura."
                />
              );
            }
            return (
              <section aria-labelledby="titolo-contenuto" className="flex flex-col gap-4">
                <h2 id="titolo-contenuto" className="text-h2 text-[var(--text-primary)]">
                  Cosa contiene il backup
                </h2>
                <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(
                    [
                      ["Allenamenti", data.sessions],
                      ["Misurazioni", data.measurements],
                      ["Routine", data.routines],
                      ["Esercizi", data.exercises],
                      ["Record", data.personalRecords],
                    ] as const
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4"
                    >
                      <dt className="text-label text-[var(--text-secondary)]">{label}</dt>
                      <dd className="tnum mt-1 text-h2 text-[var(--text-primary)]">
                        {formatInt(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          }}
        </Async>

        <section aria-labelledby="titolo-esporta" className="flex flex-col gap-4">
          <h2 id="titolo-esporta" className="text-h2 text-[var(--text-primary)]">
            Esporta
          </h2>
          <p className="text-base text-[var(--text-secondary)]">
            Il <strong className="text-[var(--text-primary)]">JSON</strong> è il backup da
            conservare: è l&apos;unico formato che Lifted sa rileggere. Il{" "}
            <strong className="text-[var(--text-primary)]">CSV</strong> serve a guardare i
            dati altrove — si apre in Excel senza aggiustamenti.
          </p>
          {/*
            `flex-wrap`: da 1024 in su questi pulsanti vivono dentro il pannello delle
            impostazioni, largo ~420px, e tre bottoni a larghezza naturale in riga
            sfondavano di 26px. Vanno a capo invece di tagliare la pagina.
          */}
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <Button
              block
              className="md:w-auto"
              onClick={() => void exportJson()}
              loading={busy === "json"}
              loadingLabel="Esporto…"
            >
              <Download aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Esporta backup JSON
            </Button>
            <Button
              variant="secondary"
              block
              className="md:w-auto"
              onClick={() => void exportCsv()}
              loading={busy === "csv"}
              loadingLabel="Esporto…"
            >
              <FileSpreadsheet aria-hidden="true" className="size-5" strokeWidth={1.75} />
              Esporta CSV per Excel
            </Button>
          </div>
        </section>

        <section aria-labelledby="titolo-importa" className="flex flex-col gap-4">
          <h2 id="titolo-importa" className="text-h2 text-[var(--text-primary)]">
            Ripristina da backup
          </h2>
          <p className="text-base text-[var(--text-secondary)]">
            L&apos;importazione <strong className="text-[var(--text-primary)]">sostituisce</strong>{" "}
            tutto quello che c&apos;è ora su questo dispositivo. Prima di procedere ti
            mostriamo cosa stai per sovrascrivere.
          </p>

          <div>
            <label
              htmlFor="file-backup"
              className="mb-2 block text-base font-semibold text-[var(--text-primary)]"
            >
              File di backup (.json)
            </label>
            <input
              ref={fileRef}
              id="file-backup"
              type="file"
              accept="application/json,.json"
              aria-describedby={readError ? "file-backup-errore" : undefined}
              aria-invalid={readError ? true : undefined}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] p-3 text-base text-[var(--text-primary)] file:mr-4 file:h-11 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--secondary)] file:px-4 file:text-base file:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            />
            {readError ? (
              <p
                id="file-backup-errore"
                role="alert"
                className="mt-2 flex items-start gap-2 text-sm text-[var(--danger)]"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                  strokeWidth={1.75}
                />
                <span>
                  {readError.message}
                  {readError.detail ? (
                    <span className="mt-1 block text-[var(--text-secondary)]">
                      {readError.detail}
                    </span>
                  ) : null}
                </span>
              </p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="titolo-cancella" className="flex flex-col gap-4">
          <h2 id="titolo-cancella" className="text-h2 text-[var(--text-primary)]">
            Cancella tutto
          </h2>
          <p className="text-base text-[var(--text-secondary)]">
            Rimuove routine, allenamenti, misure ed esercizi personalizzati da questo
            dispositivo. La libreria di base si ricarica al riavvio dell&apos;app.
          </p>
          <Button
            variant="destructive"
            block
            className="md:w-auto"
            onClick={() => setWiping(true)}
          >
            Cancella tutti i dati
          </Button>
        </section>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Sostituire tutti i dati?"
        body={
          pending ? (
            <>
              L&apos;importazione cancella quello che c&apos;è ora e mette al suo posto il
              contenuto del file. Esporta prima, se non l&apos;hai fatto.
              <span className="mt-4 block rounded-[var(--radius-sm)] border border-[var(--border-strong)] p-4">
                <span className="block text-label text-[var(--text-secondary)]">
                  Il file contiene
                </span>
                <span className="tnum mt-2 block text-base text-[var(--text-primary)]">
                  {formatSessionCount(pending.counts.sessions)} ·{" "}
                  {formatMeasurementCount(pending.counts.measurements)} ·{" "}
                  {formatInt(pending.counts.routines)} routine ·{" "}
                  {formatInt(pending.counts.exercises)} esercizi
                </span>
                <span className="mt-2 block text-sm text-[var(--text-muted)]">
                  Esportato il {mounted ? formatFull(pending.exportedAt) : "—"} · formato
                  versione {pending.formatVersion}
                </span>
              </span>
            </>
          ) : null
        }
        confirmLabel="Sostituisci"
        extraAction={
          <Button
            variant="secondary"
            block
            className="md:w-auto"
            onClick={() => void exportJson()}
          >
            <Upload aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Esporta prima
          </Button>
        }
        onConfirm={() => void confirmImport()}
      />

      <ConfirmDialog
        open={wiping}
        onOpenChange={setWiping}
        title="Cancellare tutto?"
        body="Routine, allenamenti, misure ed esercizi personalizzati. Non c'è modo di tornare indietro."
        confirmLabel="Cancella tutto"
        onConfirm={async () => {
          setBusy("wipe");
          try {
            await wipeAllData(getDb());
            setWiping(false);
            toast.success("Dati cancellati da questo dispositivo");
            announce("system", "Tutti i dati sono stati cancellati.");
          } catch {
            toast.error("Non riesco a cancellare i dati di questo dispositivo.");
          } finally {
            setBusy(null);
          }
        }}
      />
    </>
  );
}
