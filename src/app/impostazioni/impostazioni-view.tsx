"use client";

import { ChevronRight, HardDrive, Info } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import {
  SettingsRow,
  SettingsSection,
  Toggle,
  numberClass,
  selectClass,
} from "@/components/settings/controls";
import { PageHeader } from "@/components/shared/page-header";
import { getDb } from "@/lib/db/db";
import { updateSettings } from "@/lib/db/mutations";
import { PLATE_KGS, type Settings } from "@/lib/db/schema";
import { formatKgValue } from "@/lib/format";
import { useSessionContext } from "@/lib/session-context";

const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

/**
 * `/impostazioni` — §6.1.
 *
 * Tutto quello che cambia il comportamento dell'app in palestra: recupero predefinito,
 * colonna RPE, formula del 1RM, bilanciere e **inventario dei dischi** (che e' il dato
 * che rende utile il calcolatore: senza, propone piastre che non si hanno).
 *
 * Ogni modifica si salva subito: non c'e' un `Salva` da ricordarsi, e un'impostazione
 * cambiata per sbaglio si ricambia con lo stesso gesto.
 */
export function ImpostazioniView() {
  const { settings, settingsState } = useSessionContext();
  const loading = settingsState.status === "loading";

  const save = React.useCallback(async (patch: Partial<Settings>) => {
    try {
      await updateSettings(getDb(), patch);
    } catch {
      toast.error("Non riesco a salvare l'impostazione su questo dispositivo.");
    }
  }, []);

  return (
    <>
      <PageHeader title="Impostazioni" />

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

        <SettingsSection
          id="titolo-sessione"
          title="In sessione"
          description="Come si comporta il tracker mentre ti alleni."
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
                onChange={(event) => void save({ defaultRestSec: Number(event.target.value) })}
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
              hint="Quanti ne hai in tutto, non per lato."
              control={
                <input
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

        <nav aria-label="Altre impostazioni" className="flex flex-col gap-3">
          <Link
            href="/impostazioni/backup"
            className="press flex min-h-14 items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <HardDrive
              aria-hidden="true"
              className="size-6 shrink-0 text-[var(--text-secondary)]"
              strokeWidth={1.75}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-h3 text-[var(--text-primary)]">
                Backup e ripristino
              </span>
              <span className="block text-sm text-[var(--text-secondary)]">
                Esporta in JSON o CSV, importa un backup, cancella tutto.
              </span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--text-muted)]"
              strokeWidth={1.75}
            />
          </Link>

          <Link
            href="/impostazioni/info"
            className="press flex min-h-14 items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-5 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <Info
              aria-hidden="true"
              className="size-6 shrink-0 text-[var(--text-secondary)]"
              strokeWidth={1.75}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-h3 text-[var(--text-primary)]">
                Informazioni
              </span>
              <span className="block text-sm text-[var(--text-secondary)]">
                Versione, dove stanno i dati, licenze.
              </span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--text-muted)]"
              strokeWidth={1.75}
            />
          </Link>
        </nav>
      </div>
    </>
  );
}
