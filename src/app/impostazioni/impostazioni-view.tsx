"use client";

import { HardDrive } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { SettingsIndex, SettingsPanelHeader } from "@/components/settings/settings-two-pane";
import { useIsDesktop } from "@/lib/hooks/use-media-query";

/**
 * `/impostazioni` — l'indice.
 *
 * Da 1024 in su **si reindirizza** alla prima sezione (§4.28): un pannello vuoto accanto
 * a un indice pieno e' una schermata che non dice niente. Sotto 1024 `/impostazioni`
 * *e'* l'indice, e la sezione e' la rotta figlia — lo stesso master-detail che `/misure`
 * usa gia'.
 *
 * Il redirect e' lato client perche' la larghezza della finestra non esiste sul server.
 */
export function ImpostazioniView() {
  const desktop = useIsDesktop();
  const router = useRouter();

  React.useEffect(() => {
    if (desktop) router.replace("/impostazioni/allenamento");
  }, [desktop, router]);

  if (desktop) return null;

  return (
    <>
      <SettingsPanelHeader title="Impostazioni" />

      <div className="app-container flex flex-col gap-8 pb-8">
        <div
          className="flex flex-wrap items-start gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5"
          aria-live="off"
        >
          <HardDrive
            aria-hidden="true"
            className="size-6 shrink-0 text-[var(--accent-blue)]"
            strokeWidth={1.75}
          />
          <p className="min-w-0 flex-1 text-base text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">
              I tuoi dati restano su questo dispositivo.
            </strong>{" "}
            Lifted non usa server: routine, allenamenti e misure vivono solo nel browser
            di questo telefono.
          </p>
        </div>

        <SettingsIndex standalone />
      </div>
    </>
  );
}
