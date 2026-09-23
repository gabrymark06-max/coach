"use client";

import * as React from "react";
import { toast } from "sonner";
import { SettingsRow, SettingsSection, Toggle, selectClass } from "@/components/settings/controls";
import { SettingsPanelHeader } from "@/components/settings/settings-two-pane";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import type { Settings } from "@/lib/db/schema";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useSessionContext } from "@/lib/session-context";
import { cn } from "@/lib/utils";

/**
 * `/impostazioni/app` — tema, lingua, suono e vibrazione.
 *
 * **Tema e Lingua ci sono anche se non hanno alternative** (§4.28). La voce Tema dice
 * «Scuro — è l'unico tema di Lifted», la voce Lingua dice «Italiano». Una voce assente
 * fa cercare; una voce che spiega chiude la domanda. E nessun interruttore finto: sono
 * due `<select>` con una sola opzione, disabilitati e dichiarati tali.
 */
export function AppSettingsView() {
  const { settings } = useSessionContext();
  const desktop = useIsDesktop();

  const save = React.useCallback(async (patch: Partial<Settings>) => {
    try {
      await updateSettings(getDb(), patch);
    } catch {
      toast.error("Non riesco a salvare l'impostazione su questo dispositivo.");
    }
  }, []);

  return (
    <>
      <SettingsPanelHeader
        title="Aspetto e suoni"
        description="Come si presenta l'app e che cosa ti segnala."
      />

      <div className={cn("flex flex-col gap-8", desktop ? "" : "app-container")}>
        <SettingsSection id="titolo-aspetto" title="Aspetto">
          <SettingsRow
            label="Tema"
            htmlFor="tema"
            hint="Scuro è l'unico tema di Lifted: i contrasti sono misurati su questo."
            control={
              <select id="tema" className={selectClass} value="dark" disabled aria-disabled>
                <option value="dark">Scuro</option>
              </select>
            }
          />
          <SettingsRow
            label="Lingua"
            htmlFor="lingua"
            hint="Italiano è l'unica lingua di Lifted."
            control={
              <select id="lingua" className={selectClass} value="it" disabled aria-disabled>
                <option value="it">Italiano</option>
              </select>
            }
          />
        </SettingsSection>

        <SettingsSection
          id="titolo-segnali"
          title="Suono e vibrazione"
          description="Come Lifted ti avvisa che il recupero è finito."
        >
          <SettingsRow
            label="Suono a fine recupero"
            htmlFor="suono"
            control={
              <Toggle
                id="suono"
                label="Suono a fine recupero"
                checked={settings.soundEnabled}
                onChange={(next) => void save({ soundEnabled: next })}
              />
            }
          />
          <SettingsRow
            label="Vibrazione"
            htmlFor="vibrazione"
            hint="Solo sui telefoni che la supportano."
            control={
              <Toggle
                id="vibrazione"
                label="Vibrazione a fine recupero"
                checked={settings.vibrationEnabled}
                onChange={(next) => void save({ vibrationEnabled: next })}
              />
            }
          />
        </SettingsSection>
      </div>
    </>
  );
}
