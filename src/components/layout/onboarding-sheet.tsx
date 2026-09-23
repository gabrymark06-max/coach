"use client";

import { HardDrive } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import { useSessionContext } from "@/lib/session-context";

/**
 * L'avviso del primo avvio — §5.1, punto 1.
 *
 * E' l'informazione piu' importante dell'app e va detta **prima** che ci sia qualcosa da
 * perdere: nessun server, nessun account, i dati vivono qui. Compare una volta sola
 * (`Settings.onboardingSeenAt`) e non si chiude di lato: si esce dal pulsante, perche'
 * un avviso che si scaccia con un tocco fuori non e' stato letto.
 *
 * Aspetta che le impostazioni siano davvero lette: aprirlo durante il caricamento lo
 * farebbe lampeggiare a ogni ricarica.
 */
export function OnboardingSheet() {
  const { settings, settingsState, booting } = useSessionContext();
  const [dismissed, setDismissed] = React.useState(false);

  const shouldShow =
    !booting &&
    settingsState.status === "ready" &&
    settingsState.data !== undefined &&
    !settings.onboardingSeenAt &&
    !dismissed;

  const accept = React.useCallback(async () => {
    setDismissed(true);
    try {
      await updateSettings(getDb(), { onboardingSeenAt: new Date().toISOString() });
    } catch {
      // Se la scrittura fallisce l'avviso ricomparira' al prossimo avvio: e' il
      // comportamento giusto, non un errore da mostrare.
    }
  }, []);

  if (!shouldShow) return null;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void accept();
      }}
    >
      <SheetContent
        title="I tuoi dati restano su questo telefono"
        hideClose
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-4">
          <HardDrive
            aria-hidden="true"
            className="size-10 text-[var(--accent-blue)]"
            strokeWidth={1.75}
          />
          <p className="text-base text-[var(--text-secondary)]">
            Lifted non usa server. Tutto — routine, allenamenti, misure — vive solo nel
            browser di questo dispositivo.{" "}
            <strong className="text-[var(--text-primary)]">
              Se cancelli i dati del sito o cambi telefono, senza un backup perdi tutto.
            </strong>
          </p>
        </div>
        <SheetFooter>
          <Button variant="ghost" block className="md:w-auto" asChild>
            <Link href="/impostazioni/dati" onClick={() => void accept()}>
              Come faccio un backup?
            </Link>
          </Button>
          <Button block className="md:w-auto" onClick={() => void accept()}>
            Ho capito
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
