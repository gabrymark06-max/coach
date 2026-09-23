"use client";

import {
  Minus,
  RotateCcw,
  Sparkle,
  TrendingDown,
  TrendingUp,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { NumberField } from "@/components/session/number-field";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import type { ProgressionDecision, TrainerExercise } from "@/lib/db/trainer-schema";
import { overrideWeight } from "@/lib/db/trainer-ops";
import { formatFull, formatKg } from "@/lib/format";
import { useSettings } from "@/lib/session-context";
import { reasonButtonLabel, reasonMath, reasonView, type ReasonTone } from "@/lib/trainer/reason";
import { formatRpe, PROGRESSION_RULES } from "@/lib/trainer/rules";
import { cn } from "@/lib/utils";

/**
 * `ProgressionReason` — §4.25. **E' il punto della funzione.**
 *
 * Un programma che cambia i carichi senza spiegarsi e' un oracolo, e un oracolo lo si
 * smette di seguire alla prima proposta che sembra sbagliata.
 *
 * Tre regole implementate alla lettera:
 *  1. la riga del perche' e' **testo visibile**, sempre, sotto ogni carico: mai un
 *     `title`, mai un tooltip, mai un'affordance che esiste solo al passaggio del mouse;
 *  2. **tre canali** — icona, colore e frase — e la frase da sola basta (§8.2);
 *  3. la frase del **prossimo passo** c'e' su ogni esercizio: e' quella che trasforma
 *     il registro in uno strumento. Sapere cos'e' successo non serve, se non si sa
 *     cosa fare.
 */

const TONE_ICON: Record<ReasonTone, LucideIcon> = {
  up: TrendingUp,
  hold: Minus,
  down: TrendingDown,
  deload: RotateCcw,
  first: Sparkle,
  manual: UserCog,
};

const TONE_COLOR: Record<ReasonTone, string> = {
  up: "text-[var(--success)]",
  hold: "text-[var(--text-muted)]",
  down: "text-[var(--warning)]",
  deload: "text-[var(--accent-blue)]",
  first: "text-[var(--text-secondary)]",
  manual: "text-[var(--accent-blue)]",
};

/** La corsia colorata del registro e delle righe (§4.25): stesso colore, altro canale. */
export const TONE_LANE: Record<ReasonTone, string> = {
  up: "bg-[var(--success)]",
  hold: "bg-[var(--border-strong)]",
  down: "bg-[var(--warning)]",
  deload: "bg-[var(--accent-blue)]",
  first: "bg-[var(--border-strong)]",
  manual: "bg-[var(--accent-blue)]",
};

export function ReasonIcon({ tone, className }: { tone: ReasonTone; className?: string }) {
  const Icon = TONE_ICON[tone];
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.75}
      className={cn("size-4 shrink-0", TONE_COLOR[tone], className)}
    />
  );
}

export interface ReasonRowProps {
  exercise: TrainerExercise;
  decision?: ProgressionDecision;
  /** il giorno a cui appartiene: serve all'override manuale */
  dayId: string;
  /** `false` dove l'override non ha senso (registro storico) */
  canOverride?: boolean;
}

/**
 * La riga del perche'. **Tutta** la riga e' il pulsante che apre il foglio: un bersaglio
 * da 44px di altezza, non un'icona da 16 in fondo alla frase.
 */
export function ReasonRow({ exercise, decision, dayId, canOverride = true }: ReasonRowProps) {
  const [open, setOpen] = React.useState(false);
  const view = reasonView(exercise, decision);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={reasonButtonLabel(exercise, view)}
        className={cn(
          "-mx-2 flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left",
          "hover:bg-[var(--surface-hover)] press",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        )}
      >
        <ReasonIcon tone={view.tone} />
        <span className="min-w-0 flex-1 text-sm text-[var(--text-secondary)]">{view.text}</span>
      </button>

      <ReasonSheet
        open={open}
        onOpenChange={setOpen}
        exercise={exercise}
        decision={decision}
        dayId={dayId}
        canOverride={canOverride}
      />
    </>
  );
}

/**
 * Il foglio «Perche' questo carico» — quattro blocchi, in quest'ordine: la regola col
 * suo nome, i dati che l'hanno attivata (con le sessioni come **link verificabili**),
 * il conto, e che cosa serve per il prossimo passo.
 */
export function ReasonSheet({
  open,
  onOpenChange,
  exercise,
  decision,
  dayId,
  canOverride = true,
}: ReasonRowProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Perché questo carico" description={exercise.exerciseName}>
        {/*
          Il corpo del foglio e' un componente a se' perche' Radix lo **smonta** alla
          chiusura: cosi' il campo dell'override riparte dal carico proposto a ogni
          apertura senza un effetto che reimposta lo stato — che e' una cascata di
          render travestita da pulizia.
        */}
        <ReasonSheetBody
          exercise={exercise}
          decision={decision}
          dayId={dayId}
          canOverride={canOverride}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function ReasonSheetBody({
  exercise,
  decision,
  dayId,
  canOverride,
  onClose,
}: ReasonRowProps & { onClose: () => void }) {
  const view = reasonView(exercise, decision);
  const settings = useSettings();
  const [override, setOverride] = React.useState(false);
  const [valore, setValore] = React.useState<number | null>(view.weightKg);
  const [nota, setNota] = React.useState("");
  const [inCorso, setInCorso] = React.useState(false);
  const notaId = React.useId();

  const spec = decision ? PROGRESSION_RULES[decision.rule] : null;
  const conto = decision ? reasonMath(decision) : null;

  const salva = async () => {
    if (valore == null || valore <= 0) {
      toast.error("Scrivi il carico che vuoi usare.");
      return;
    }
    // doppio tocco: il pulsante si spegne al primo, cosi' non nascono due decisioni
    if (inCorso) return;
    setInCorso(true);
    try {
      await overrideWeight(getDb(), {
        dayId,
        exerciseId: exercise.exerciseId,
        weightKg: valore,
        note: nota.trim() || undefined,
      });
      announce("system", `Carico di ${exercise.exerciseName} portato a ${formatKg(valore)}.`);
      toast.success(`${exercise.exerciseName}: ${formatKg(valore)}`);
      onClose();
    } catch {
      toast.error("Non riesco a salvare il carico su questo dispositivo.");
    } finally {
      setInCorso(false);
    }
  };

  return (
    <>
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="text-h3 text-[var(--text-primary)]">{view.ruleName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {spec?.effect ?? "Non ho ancora abbastanza storico per proporti un carico."}
            </p>
          </section>

          {decision && decision.evidence.repsAchieved.length > 0 ? (
            <section>
              <h3 className="text-label text-[var(--text-secondary)]">I dati che l&apos;hanno attivata</h3>
              <dl className="mt-2 flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--text-secondary)]">Serie completate</dt>
                  <dd className="tnum text-num-md text-[var(--text-primary)]">
                    {decision.evidence.setsCompleted} su {decision.evidence.setsPlanned}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-[var(--text-secondary)]">Ripetizioni</dt>
                  <dd className="tnum text-num-md text-[var(--text-primary)]">
                    {decision.evidence.repsAchieved.join(", ")}
                  </dd>
                </div>
                {decision.evidence.rpeObserved.some((value) => value != null) ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-[var(--text-secondary)]">RPE</dt>
                    <dd className="tnum text-num-md text-[var(--text-primary)]">
                      {decision.evidence.rpeObserved
                        .map((value) => (value == null ? "—" : formatRpe(value)))
                        .join(", ")}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {decision.evidence.sessionIds.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1">
                  {decision.evidence.sessionIds.map((id) => (
                    <li key={id}>
                      <Link
                        href={`/profilo/sessione/${id}`}
                        className="inline-flex min-h-11 items-center text-sm text-[var(--accent-blue)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                      >
                        Vedi l&apos;allenamento del {formatFull(decision.decidedAt)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {conto ? (
            <section>
              <h3 className="text-label text-[var(--text-secondary)]">Il conto</h3>
              <p className="tnum mt-1 text-num-md text-[var(--text-primary)]">{conto}</p>
            </section>
          ) : null}

          {/* Obbligatorio su ogni esercizio (§4.25): il registro deve servire al futuro. */}
          <section>
            <h3 className="text-label text-[var(--text-secondary)]">
              Che cosa serve per il prossimo passo
            </h3>
            <p className="mt-1 text-base text-[var(--text-primary)]">{view.nextStepHint}</p>
          </section>

          {override ? (
            <section className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4">
              <h3 className="text-h3 text-[var(--text-primary)]">Scegli tu il carico</h3>
              <NumberField
                label={`Carico per ${exercise.exerciseName}`}
                kind="decimal"
                value={valore}
                onCommit={setValore}
                step={settings.stepKg}
                stepFine={settings.stepKgFine}
              />
              <div>
                <label htmlFor={notaId} className="text-sm text-[var(--text-secondary)]">
                  Perché (facoltativo)
                </label>
                <input
                  id={notaId}
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  autoComplete="off"
                  className="mt-1 h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--input)] px-3 text-base text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
                />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                La tua scelta entra nel registro e diventa la base da cui riparto.
              </p>
            </section>
          ) : null}
        </div>

        <SheetFooter>
          {override ? (
            <>
              <Button variant="ghost" onClick={() => setOverride(false)}>
                Annulla
              </Button>
              <Button onClick={() => void salva()} loading={inCorso} loadingLabel="Salvo…">
                Usa questo carico
              </Button>
            </>
          ) : canOverride ? (
            <Button variant="ghost" onClick={() => setOverride(true)}>
              Non sono d&apos;accordo
            </Button>
          ) : null}
        </SheetFooter>
    </>
  );
}
