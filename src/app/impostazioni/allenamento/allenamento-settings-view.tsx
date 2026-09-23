"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  SettingsRow,
  SettingsSection,
  Toggle,
  numberClass,
  selectClass,
} from "@/components/settings/controls";
import { SettingsPanelHeader } from "@/components/settings/settings-two-pane";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import { PLATE_KGS, type Settings } from "@/lib/db/schema";
import { formatKgValue } from "@/lib/format";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useSessionContext } from "@/lib/session-context";
import { announce } from "@/lib/announce";
import { cn } from "@/lib/utils";

const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

/** Tre progressioni di riscaldamento, non un campo libero: sono percentuali del target. */
const WARMUP_PRESETS: { value: string; label: string; percents: number[] }[] = [
  { value: "50-70-87", label: "50% · 70% · 87,5%", percents: [0.5, 0.7, 0.875] },
  { value: "40-60-80", label: "40% · 60% · 80%", percents: [0.4, 0.6, 0.8] },
  { value: "55-75-90", label: "55% · 75% · 90%", percents: [0.55, 0.75, 0.9] },
];

function presetKey(percents: number[]): string {
  return (
    WARMUP_PRESETS.find(
      (preset) => preset.percents.join(",") === percents.join(","),
    )?.value ?? WARMUP_PRESETS[0].value
  );
}

/**
 * `/impostazioni/allenamento` — tutto quello che cambia il comportamento dell'app
 * **mentre ti alleni**.
 *
 * Le impostazioni si salvano al cambio, non con un `Salva`: il controllo che si muove
 * *e'* la conferma, e un toast a ogni interruttore e' rumore. `#sr-system` annuncia in
 * `polite` quello che e' cambiato, cosi' chi non vede il controllo muoversi lo sente.
 */
export function AllenamentoSettingsView() {
  const { settings, settingsState } = useSessionContext();
  const loading = settingsState.status === "loading";
  const desktop = useIsDesktop();

  /*
    I campi numerici sono **non controllati** (`defaultValue` + `onBlur`), e
    `defaultValue` non aggiorna un input gia' montato: al primo render le impostazioni
    non sono ancora arrivate da Dexie e il campo nasce con il valore di fabbrica, che
    poi resta li' anche dopo. Questa chiave lo fa rimontare **una volta sola**, quando
    il valore vero arriva. Si vedeva ricaricando: l'inventario dei dischi tornava a 8.
  */
  const chiave = settingsState.status === "ready" ? "pronte" : "attesa";

  const save = React.useCallback(async (patch: Partial<Settings>, spoken?: string) => {
    try {
      await updateSettings(getDb(), patch);
      if (spoken) announce("system", spoken);
    } catch {
      toast.error("Non riesco a salvare l'impostazione su questo dispositivo.");
    }
  }, []);

  return (
    <>
      <SettingsPanelHeader
        title="In palestra"
        description="Come si comporta il tracker mentre ti alleni."
      />

      <div className={cn("flex flex-col gap-8", desktop ? "" : "app-container")}>
        {settingsState.status === "error" ? (
          <div
            role="alert"
            className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--card)] p-5"
          >
            <p className="text-base text-[var(--text-primary)]">
              Non riesco a leggere le impostazioni. Sto usando i valori di fabbrica.
            </p>
            <button
              type="button"
              onClick={settingsState.retry}
              className="mt-2 h-11 rounded-[var(--radius-sm)] text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Riprova
            </button>
          </div>
        ) : null}

        <SettingsSection
          id="titolo-sessione"
          title="In sessione"
          description="Recupero, RPE e segnali di fine serie."
        >
          <SettingsRow
            label="Recupero predefinito"
            htmlFor="recupero"
            hint="Vale per gli esercizi che non hanno un recupero loro."
            control={
              <select
                id="recupero"
                className={selectClass}
                value={settings.defaultRestSec}
                disabled={loading}
                onChange={(event) => {
                  const seconds = Number(event.target.value);
                  void save({ defaultRestSec: seconds }, `Timer di recupero: ${seconds} secondi`);
                }}
              >
                {REST_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds < 60
                      ? `${seconds} s`
                      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} min`}
                  </option>
                ))}
              </select>
            }
          />
          <SettingsRow
            label="Avvia il recupero da solo"
            htmlFor="recupero-auto"
            hint="Parte quando segni una serie come completata."
            control={
              <Toggle
                id="recupero-auto"
                label="Avvia il recupero da solo"
                checked={settings.restAutoStart}
                onChange={(next) => void save({ restAutoStart: next })}
              />
            }
          />
          <SettingsRow
            label="Colonna RPE"
            htmlFor="rpe"
            hint="Aggiunge il campo RPE da 1 a 10 a ogni serie."
            control={
              <Toggle
                id="rpe"
                label="Mostra la colonna RPE"
                checked={settings.showRpe}
                onChange={(next) => void save({ showRpe: next })}
              />
            }
          />
        </SettingsSection>

        <SettingsSection
          id="titolo-numeri"
          title="Numeri e unità"
          description="Come Lifted calcola e arrotonda."
        >
          <SettingsRow
            label="Unità di peso"
            htmlFor="unita"
            hint="Lifted lavora in chilogrammi."
            control={
              <select id="unita" className={selectClass} value="kg" disabled aria-disabled>
                <option value="kg">Chilogrammi</option>
              </select>
            }
          />
          <SettingsRow
            label="Formula del 1RM"
            htmlFor="formula"
            hint="Epley premia le serie lunghe, Brzycki quelle corte."
            control={
              <select
                id="formula"
                className={selectClass}
                value={settings.e1rmFormula}
                disabled={loading}
                onChange={(event) =>
                  void save({ e1rmFormula: event.target.value as Settings["e1rmFormula"] })
                }
              >
                <option value="epley">Epley</option>
                <option value="brzycki">Brzycki</option>
              </select>
            }
          />
          <SettingsRow
            label="Incremento del peso"
            htmlFor="step"
            hint="Quanto salgono i pulsanti + e − nella riga della serie."
            control={
              <select
                id="step"
                className={selectClass}
                value={settings.stepKg}
                disabled={loading}
                onChange={(event) => void save({ stepKg: Number(event.target.value) })}
              >
                {[1, 1.25, 2, 2.5, 5].map((step) => (
                  <option key={step} value={step}>
                    {formatKgValue(step)} kg
                  </option>
                ))}
              </select>
            }
          />
        </SettingsSection>

        <SettingsSection
          id="titolo-riscaldamento"
          title="Riscaldamento"
          description="Le percentuali del carico obiettivo che il calcolatore propone."
        >
          <SettingsRow
            label="Progressione"
            htmlFor="riscaldamento"
            hint="Tre serie di avvicinamento, calcolate sul peso che hai in mente."
            control={
              <select
                id="riscaldamento"
                className={selectClass}
                value={presetKey(settings.warmupPercents)}
                disabled={loading}
                onChange={(event) => {
                  const preset = WARMUP_PRESETS.find((one) => one.value === event.target.value);
                  if (preset) void save({ warmupPercents: preset.percents });
                }}
              >
                {WARMUP_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            }
          />
        </SettingsSection>

        <SettingsSection
          id="titolo-bilanciere"
          title="Bilanciere e dischi"
          description="Quello che hai davvero in palestra: il calcolatore non propone piastre che non possiedi."
        >
          <SettingsRow
            label="Peso del bilanciere"
            htmlFor="bilanciere"
            control={
              <div className="flex items-center gap-2">
                <input
                  key={chiave}
                  id="bilanciere"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={50}
                  step={0.5}
                  className={numberClass}
                  defaultValue={settings.barWeightKg}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value) && value >= 0 && value <= 50) {
                      void save({ barWeightKg: value });
                    } else {
                      event.target.value = String(settings.barWeightKg);
                      toast.error("Il bilanciere va da 0 a 50 kg.");
                    }
                  }}
                />
                <span className="text-sm text-[var(--text-muted)]">kg</span>
              </div>
            }
          />
          {PLATE_KGS.map((plate) => (
            <SettingsRow
              key={plate}
              label={`Dischi da ${formatKgValue(plate)} kg`}
              htmlFor={`dischi-${plate}`}
              /*
                QA GRAVE 1: l'inventario era raccolto come totale e consumato come per
                lato. Adesso il verso e' uno solo — si scrive il totale — e il testo di
                aiuto dice anche che cosa ne fa il calcolatore, cosi' il numero non e'
                piu' interpretabile in due modi.
              */
              hint="Quanti ne hai in tutto, non per lato: il calcolatore ne carica metà per parte."
              control={
                <input
                  key={chiave}
                  id={`dischi-${plate}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={40}
                  step={2}
                  className={numberClass}
                  defaultValue={settings.plateInventory[String(plate)] ?? 0}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value) || value < 0 || value > 40) {
                      event.target.value = String(settings.plateInventory[String(plate)] ?? 0);
                      toast.error("Inserisci un numero di dischi tra 0 e 40.");
                      return;
                    }
                    void save({
                      plateInventory: {
                        ...settings.plateInventory,
                        [String(plate)]: Math.round(value),
                      },
                    });
                  }}
                />
              }
            />
          ))}
        </SettingsSection>
      </div>
    </>
  );
}
