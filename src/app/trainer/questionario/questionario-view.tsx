"use client";

import { AlertCircle, ArrowLeft, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { RouteMain } from "@/components/layout/route-main";
import { Async, ListSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import { describeError, logError } from "@/lib/errors";
import {
  EQUIPMENT_LABEL,
  MUSCLE_GROUP_LABEL,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from "@/lib/db/schema";
import { createProgramFromDraft, getTrainerProfile, saveDraft } from "@/lib/db/trainer-ops";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  DAYS_CHOICES,
  DEFAULT_DAYS,
  DEFAULT_MINUTES,
  EMPTY_DRAFT,
  EQUIPMENT_CHOICES,
  EQUIPMENT_PRESETS,
  GOALS,
  LEVELS,
  MAX_PRIORITY_MUSCLES,
  MINUTES_CHOICES,
  PRIORITY_MUSCLES,
  STEPS,
  TOTAL_STEPS,
  draftProfile,
  firstIncompleteStep,
  summaryRows,
  validateStep,
  type Draft,
  type Step,
  type StepError,
} from "@/lib/trainer/questionnaire";
import { resolveSplit, type SplitOutcome } from "@/lib/trainer/generator";
import { cn } from "@/lib/utils";

/**
 * `/trainer/questionario` — §4.23. **Sei passi, una domanda per schermata.**
 *
 * A schermo intero e fuori dal guscio, come `/sessione`: qui si risponde, non si
 * naviga. Cinque domande in una pagina sola sembrano un modulo fiscale e si abbandonano.
 *
 * Due dettagli che valgono piu' di tutto il resto:
 *  - **la bozza si scrive al momento della risposta**, non alla fine. Chiudere l'app al
 *    passo 3 e riaprirla riporta al passo 3;
 *  - **il primario resta abilitato** anche senza risposta (§11.8). Si preme, l'errore
 *    compare sotto la domanda con `aria-invalid` e il focus ci va. Un pulsante spento
 *    non dice mai perche' lo e'.
 */
export function QuestionarioView() {
  const router = useRouter();
  const params = useSearchParams();
  const ricomincia = params.get("ricomincia") === "1";

  /*
    §9.6: il questionario legge anche `Exercise[]`, «per sapere cosa e' generabile con
    gli attrezzi scelti». E' con quella libreria che lo split mostrato al passo 5 e al
    passo 6 diventa quello che il generatore costruira' davvero.
  */
  const state = useLiveData(async () => {
    const db = getDb();
    const [profile, library] = await Promise.all([
      getTrainerProfile(db),
      db.exercises.toArray(),
    ]);
    return { profile: profile ?? null, library };
  }, []);

  return (
    <RouteMain className="app-container flex flex-col gap-6 py-9">
      <h1 className="sr-only">Il questionario del Trainer</h1>
      <Async
        state={state}
        loading={<ListSkeleton rows={4} height={72} />}
        errorDetail="Non riesco a leggere le tue risposte su questo dispositivo."
      >
        {({ profile, library }) => (
          <Form
            library={library}
            iniziale={
              ricomincia || !profile
                ? { ...EMPTY_DRAFT }
                : {
                    goal: profile.goal,
                    priorityMuscles: profile.priorityMuscles ?? [],
                    equipment: profile.equipment ?? [],
                    level: profile.level,
                    daysPerWeek: profile.daysPerWeek,
                    sessionMinutes: profile.sessionMinutes,
                  }
            }
            passoIniziale={
              ricomincia || !profile
                ? 1
                : ((profile.draftStep ?? firstIncompleteStep(profile as Draft)) as Step)
            }
            onFatto={() => router.replace("/trainer")}
          />
        )}
      </Async>
    </RouteMain>
  );
}

function Form({
  iniziale,
  passoIniziale,
  onFatto,
  library,
}: {
  iniziale: Draft;
  passoIniziale: Step;
  onFatto: () => void;
  library: Exercise[];
}) {
  const reduced = useReducedMotion();
  const [draft, setDraft] = React.useState<Draft>(iniziale);
  const [step, setStep] = React.useState<Step>(passoIniziale);
  const [direzione, setDirezione] = React.useState<1 | -1>(1);
  const [errore, setErrore] = React.useState<StepError | null>(null);
  const [inCorso, setInCorso] = React.useState(false);
  const erroreRef = React.useRef<HTMLParagraphElement>(null);
  const erroreId = React.useId();

  /*
    Lo split si risolve sulla libreria vera, ripiego compreso: e' la stessa funzione che
    usa il generatore, quindi il passo 5 non puo' promettere un Push/Pull/Legs e il
    programma consegnare un Full body (QA, secondo audit, DIFETTO 1).
  */
  const split = React.useMemo<SplitOutcome | null>(() => {
    const profile = draftProfile(draft);
    return profile ? resolveSplit({ profile, library }) : null;
  }, [draft, library]);

  /** Ogni risposta si scrive subito: la bozza non aspetta la fine. */
  const rispondi = (patch: Draft) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setErrore(null);
    void saveDraft(getDb(), next, step).catch(() => undefined);
  };

  const avanti = () => {
    const problema = validateStep(step, draft);
    if (problema) {
      setErrore(problema);
      announce("system", problema.message);
      requestAnimationFrame(() => erroreRef.current?.focus());
      return;
    }
    const next = Math.min(TOTAL_STEPS, step + 1) as Step;
    setDirezione(1);
    setStep(next);
    void saveDraft(getDb(), draft, next).catch(() => undefined);
  };

  const indietro = () => {
    setDirezione(-1);
    setErrore(null);
    setStep(Math.max(1, step - 1) as Step);
  };

  const genera = async () => {
    if (inCorso) return;
    setInCorso(true);
    try {
      const result = await createProgramFromDraft(getDb(), draft);
      if (!result.ok) {
        setErrore({ message: result.reason });
        setInCorso(false);
        announce("system", result.reason);
        requestAnimationFrame(() => erroreRef.current?.focus());
        return;
      }
      announce("system", `Programma generato: ${result.program.name}.`);
      toast.success("Programma generato.");
      onFatto();
    } catch (error) {
      /*
        Un errore qui non e' «il dispositivo»: e' un difetto dell'app, e va detto dove
        l'utente sta guardando — sotto la domanda, con il fuoco, come ogni altro errore
        del questionario — e lasciato nei log per chi lo deve aggiustare.
      */
      logError("trainer/questionario/genera", error);
      const detto = describeError(error);
      setInCorso(false);
      setErrore({ message: detto });
      announce("system", detto);
      toast.error(detto);
      requestAnimationFrame(() => erroreRef.current?.focus());
    }
  };

  const meta = STEPS[step - 1];

  return (
    <>
      {/* barra di avanzamento sticky (§4.23) */}
      <div className="sticky top-0 z-[var(--z-sticky)] -mx-5 bg-[var(--background)] px-5 pt-1 pb-4">
        <p className="text-label text-[var(--text-secondary)]">
          Passo {step} di {TOTAL_STEPS}
        </p>
        <div
          role="progressbar"
          aria-label="Avanzamento del questionario"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step}
          aria-valuetext={`Passo ${step} di ${TOTAL_STEPS}`}
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--border)]"
        >
          <div
            className={cn(
              "h-full origin-left bg-[var(--primary)]",
              reduced
                ? ""
                : "transition-transform duration-[var(--dur-2)] ease-[var(--ease-out)]",
            )}
            style={{ transform: `scaleX(${step / TOTAL_STEPS})` }}
          />
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step === TOTAL_STEPS) void genera();
          else avanti();
        }}
        className="flex flex-col gap-6"
      >
        <div
          key={step}
          data-passo={step}
          style={
            reduced
              ? undefined
              : ({ "--da": `${direzione * 12}px` } as React.CSSProperties)
          }
          className={cn(
            "flex flex-col gap-5",
            reduced ? "animate-[lifted-fade-in_150ms_ease-out]" : "quiz-step",
          )}
        >
          {/*
            `aria-invalid` e `aria-describedby` stanno sul `<fieldset>`, che ha un ruolo
            (`group`) e un nome (la `<legend>`): su un `<div>` nudo gli screen reader li
            ignorano, e l'errore restava visibile ma muto (QA, secondo audit, DIFETTO 8).
          */}
          <fieldset
            className="min-w-0 border-0 p-0"
            aria-invalid={errore ? true : undefined}
            aria-describedby={errore ? erroreId : undefined}
          >
            <legend className="text-h1 text-[var(--text-primary)]">{meta.question}</legend>
            {meta.hint ? (
              <p className="mt-2 text-base text-[var(--text-secondary)]">{meta.hint}</p>
            ) : null}

            <div className="mt-5">
              {step === 1 ? <Passo1 draft={draft} rispondi={rispondi} /> : null}
              {step === 2 ? <Passo2 draft={draft} rispondi={rispondi} /> : null}
              {step === 3 ? <Passo3 draft={draft} rispondi={rispondi} /> : null}
              {step === 4 ? <Passo4 draft={draft} rispondi={rispondi} /> : null}
              {step === 5 ? <Passo5 draft={draft} rispondi={rispondi} split={split} /> : null}
              {step === 6 ? (
                <Passo6 draft={draft} vaiA={(s) => setStep(s)} split={split} />
              ) : null}
            </div>
          </fieldset>

          {errore ? (
            <div className="flex flex-col gap-3">
              <p
                id={erroreId}
                ref={erroreRef}
                tabIndex={-1}
                className="flex items-start gap-2 text-sm text-[var(--danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                  strokeWidth={1.75}
                />
                {errore.message}
              </p>
              {errore.escape ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    rispondi(errore.escape!.patch);
                    setErrore(null);
                    avanti();
                  }}
                >
                  {errore.escape.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={step === 1 ? onFatto : indietro}
            className="shrink-0"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {step === 1 ? "Esci" : "Indietro"}
          </Button>
          {/* §11.8: il primario resta **abilitato** anche senza risposta */}
          <Button type="submit" block loading={inCorso} loadingLabel="Genero…">
            {step === TOTAL_STEPS ? "Genera il programma" : "Avanti"}
          </Button>
        </div>
      </form>
    </>
  );
}

/* ─────────────────────────────────────────────────────────── le sei domande */

/*
  La `<label>` avvolge il controllo e **l'input copre tutta la card** (§11.8: nessuna
  zona morta). Non e' `sr-only`: un input alto un pixel in mezzo a una card da 72
  significa che il bersaglio vero e' il testo, e che il testo intercetta il tocco
  destinato al controllo. Qui l'input *e'* la card, resta nel tab order, e l'anello di
  focus lo disegna la card con `has-[:focus-visible]`.
*/
const CARD_BASE =
  "relative flex min-h-[72px] w-full cursor-pointer items-center gap-4 rounded-[var(--radius-md)] border bg-[var(--card)] p-4 text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]";
const CARD_OFF = "border-[var(--border-strong)] hover:bg-[var(--surface-hover)]";
const CARD_ON = "border-2 border-[var(--accent-blue)] bg-[var(--set-done-surface)]";
/** L'anello di focus della card: lo disegna il contenitore, non l'input trasparente. */
const FOCUS_CARD =
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]";
const CARD_INPUT =
  "absolute inset-0 size-full cursor-pointer appearance-none rounded-[inherit] opacity-0";

/** La spunta a destra: il terzo canale, oltre al bordo e al fondo (§4.23). */
function Spunta({ on }: { on: boolean }) {
  return on ? (
    <Check
      aria-hidden="true"
      className="size-5 shrink-0 text-[var(--accent-blue)]"
      strokeWidth={2}
    />
  ) : (
    <span aria-hidden="true" className="size-5 shrink-0" />
  );
}

function Passo1({ draft, rispondi }: { draft: Draft; rispondi: (patch: Draft) => void }) {
  return (
    <ul className="flex flex-col gap-3">
      {GOALS.map((goal) => {
        const on = draft.goal === goal.value;
        return (
          <li key={goal.value}>
            <label className={cn(CARD_BASE, on ? CARD_ON : CARD_OFF)}>
              <input
                type="radio"
                name="obiettivo"
                value={goal.value}
                checked={on}
                onChange={() => rispondi({ goal: goal.value })}
                className={CARD_INPUT}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-[var(--text-primary)]">
                  {goal.title}
                </span>
                <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                  {goal.line}
                </span>
              </span>
              <Spunta on={on} />
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function Passo2({ draft, rispondi }: { draft: Draft; rispondi: (patch: Draft) => void }) {
  const scelti = draft.priorityMuscles ?? [];
  const toggle = (muscle: MuscleGroup) => {
    const next = scelti.includes(muscle)
      ? scelti.filter((item) => item !== muscle)
      : [...scelti, muscle].slice(-MAX_PRIORITY_MUSCLES);
    rispondi({ priorityMuscles: next });
  };

  return (
    <>
      <p aria-live="polite" className="text-label text-[var(--text-secondary)]">
        {scelti.length} di {MAX_PRIORITY_MUSCLES}
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {PRIORITY_MUSCLES.map((muscle) => {
          const on = scelti.includes(muscle);
          return (
            <li key={muscle}>
              <label className={cn(CARD_BASE, "min-h-12", on ? CARD_ON : CARD_OFF)}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(muscle)}
                  className={CARD_INPUT}
                />
                <span className="min-w-0 flex-1 text-base text-[var(--text-primary)]">
                  {MUSCLE_GROUP_LABEL[muscle]}
                </span>
                <Spunta on={on} />
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="ghost"
        className="mt-3"
        onClick={() => rispondi({ priorityMuscles: [] })}
      >
        Nessuna preferenza
      </Button>
    </>
  );
}

function Passo3({ draft, rispondi }: { draft: Draft; rispondi: (patch: Draft) => void }) {
  const scelti = draft.equipment ?? [];
  const toggle = (item: Equipment) =>
    rispondi({
      equipment: scelti.includes(item)
        ? scelti.filter((value) => value !== item)
        : [...scelti, item],
    });

  return (
    <>
      <ul className="flex flex-col gap-3">
        {EQUIPMENT_PRESETS.map((preset) => (
          <li key={preset.key}>
            <Button
              type="button"
              variant="secondary"
              block
              className="h-auto justify-start py-3 text-left"
              onClick={() => rispondi({ equipment: [...preset.equipment] })}
            >
              <span className="min-w-0">
                <span className="block text-base font-semibold text-[var(--text-primary)]">
                  {preset.label}
                </span>
                <span className="mt-0.5 block text-sm font-normal text-[var(--text-secondary)]">
                  {preset.line}
                </span>
              </span>
            </Button>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-label text-[var(--text-secondary)]">Oppure scegli a mano</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EQUIPMENT_CHOICES.map((item) => {
          const on = scelti.includes(item);
          return (
            <li key={item}>
              <label
                className={cn(
                  FOCUS_CARD,
                  "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border bg-[var(--card)] px-4",
                  on ? CARD_ON : CARD_OFF,
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(item)}
                  className={CARD_INPUT}
                />
                <span className="min-w-0 flex-1 text-base text-[var(--text-primary)]">
                  {EQUIPMENT_LABEL[item]}
                </span>
                <Spunta on={on} />
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Passo4({ draft, rispondi }: { draft: Draft; rispondi: (patch: Draft) => void }) {
  return (
    <ul className="flex flex-col gap-3">
      {LEVELS.map((level) => {
        const on = draft.level === level.value;
        return (
          <li key={level.value}>
            <label className={cn(CARD_BASE, on ? CARD_ON : CARD_OFF)}>
              <input
                type="radio"
                name="livello"
                value={level.value}
                checked={on}
                onChange={() => rispondi({ level: level.value })}
                className={CARD_INPUT}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-[var(--text-primary)]">
                  {level.title}
                </span>
                <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                  {level.line}
                </span>
              </span>
              <Spunta on={on} />
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function Passo5({
  draft,
  rispondi,
  split,
}: {
  draft: Draft;
  rispondi: (patch: Draft) => void;
  split: SplitOutcome | null;
}) {
  const giorni = draft.daysPerWeek ?? DEFAULT_DAYS;
  const minuti = draft.sessionMinutes ?? DEFAULT_MINUTES;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-label text-[var(--text-secondary)]">Giorni a settimana</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {DAYS_CHOICES.map((value) => {
            const on = giorni === value;
            return (
              <li key={value}>
                <label
                  className={cn(
                    FOCUS_CARD,
                    "relative flex size-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border bg-[var(--card)] text-num-md",
                    on ? CARD_ON : CARD_OFF,
                    "text-[var(--text-primary)]",
                  )}
                >
                  <input
                    type="radio"
                    name="giorni"
                    value={value}
                    checked={on}
                    onChange={() => rispondi({ daysPerWeek: value })}
                    className={CARD_INPUT}
                  />
                  {value}
                </label>
              </li>
            );
          })}
        </ul>
        <div aria-live="polite" className="mt-3">
          <p className="text-base text-[var(--text-secondary)]">
            {giorni} giorni →{" "}
            <strong className="text-[var(--text-primary)]">
              {split == null || split.ok ? (split?.label ?? "—") : "non ci riesco"}
            </strong>
          </p>
          <SplitNote split={split} />
        </div>
      </div>

      <div>
        <h2 className="text-label text-[var(--text-secondary)]">Quanto dura una seduta</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {MINUTES_CHOICES.map((value) => {
            const on = minuti === value;
            return (
              <li key={value}>
                <label
                  className={cn(
                    FOCUS_CARD,
                    "relative flex h-12 min-w-[72px] cursor-pointer items-center justify-center rounded-[var(--radius-md)] border bg-[var(--card)] px-4 text-base",
                    on ? CARD_ON : CARD_OFF,
                    "text-[var(--text-primary)]",
                  )}
                >
                  <input
                    type="radio"
                    name="minuti"
                    value={value}
                    checked={on}
                    onChange={() => rispondi({ sessionMinutes: value })}
                    className={CARD_INPUT}
                  />
                  {value} min
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Passo6({
  draft,
  vaiA,
  split,
}: {
  draft: Draft;
  vaiA: (step: Step) => void;
  split: SplitOutcome | null;
}) {
  return (
    <>
    <ul className="flex flex-col">
      {summaryRows(draft, split?.ok ? split.label : null).map((row) => (
        <li
          key={row.step}
          className="flex items-center gap-3 border-t border-[var(--border)] py-3 first:border-t-0 first:pt-0"
        >
          <div className="min-w-0 flex-1">
            <p className="text-label text-[var(--text-secondary)]">{row.label}</p>
            <p className="mt-1 text-base text-[var(--text-primary)]">{row.value}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => vaiA(row.step)}
            aria-label={`Modifica ${row.label.toLocaleLowerCase("it-IT")}`}
          >
            Modifica
          </Button>
        </li>
      ))}
    </ul>
    <div className="mt-3">
      <SplitNote split={split} />
    </div>
    </>
  );
}

/**
 * La riga che spiega il ripiego — o il rifiuto — **prima** di generare.
 *
 * Senza, il programma esce con dei giorni che l'utente non ha mai visto nominare: e'
 * il DIFETTO 1 del secondo audit, ed e' una promessa mancata, non un dettaglio.
 */
function SplitNote({ split }: { split: SplitOutcome | null }) {
  if (split == null) return null;
  if (!split.ok) {
    return <p className="mt-2 text-sm text-[var(--text-secondary)]">{split.reason}</p>;
  }
  if (!split.fellBack) return null;
  return (
    <p className="mt-2 text-sm text-[var(--text-secondary)]">
      Con questa attrezzatura un {split.intendedLabel} lascerebbe dei giorni quasi vuoti:
      costruisco un {split.label}.
    </p>
  );
}
