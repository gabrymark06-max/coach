"use client";

import type * as React from "react";
import { SettingsPanelHeader } from "@/components/settings/settings-two-pane";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Il guscio del pannello Informazioni.
 *
 * Esiste come componente client perche' il titolo deve sapere se e' dentro la colonna
 * del pannello (>=1024) o e' la pagina intera: il contenuto, invece, resta un Server
 * Component — sono licenze e numeri di versione, non hanno bisogno di JavaScript.
 */
export function InfoPanel({ children }: { children: React.ReactNode }) {
  const desktop = useIsDesktop();
  return (
    <>
      <SettingsPanelHeader title="Informazioni" />
      <div className={cn("flex flex-col gap-8 pb-8", desktop ? "" : "app-container")}>
        {children}
      </div>
    </>
  );
}
