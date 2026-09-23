"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { getDb } from "@/lib/db/db";
import { formatSessionCount } from "@/lib/format";
import { useSessionContext } from "@/lib/session-context";

const SOGLIA = 5;
const CHIAVE = "lifted:backup-nudge";

/**
 * §5.1, punto 3: dopo la quinta sessione registrata senza aver mai esportato, un
 * promemoria annullabile.
 *
 * Si mostra **una volta per apertura dell'app** (`sessionStorage`), non a ogni cambio di
 * schermata: un avviso ripetuto si impara a ignorare, ed e' l'unico che non deve essere
 * ignorato.
 */
export function BackupNudge() {
  const { settings, settingsState, booting } = useSessionContext();
  const router = useRouter();
  const done = React.useRef(false);

  React.useEffect(() => {
    if (done.current || booting || settingsState.status !== "ready") return;
    if (settings.lastExportAt) return;
    if (typeof window === "undefined" || sessionStorage.getItem(CHIAVE) === "1") return;

    let alive = true;
    void getDb()
      .sessions.where("status")
      .equals("completed")
      .count()
      .then((count) => {
        if (!alive || done.current || count < SOGLIA) return;
        done.current = true;
        sessionStorage.setItem(CHIAVE, "1");
        toast(`Hai ${formatSessionCount(count)} su questo dispositivo e nessun backup.`, {
          duration: 8000,
          action: {
            label: "Esporta ora",
            onClick: () => router.push("/impostazioni/dati"),
          },
        });
      })
      .catch(() => {
        // Se il conteggio fallisce non si insiste: l'avviso permanente resta in
        // Impostazioni → Backup.
      });

    return () => {
      alive = false;
    };
  }, [booting, router, settings.lastExportAt, settingsState.status]);

  return null;
}
