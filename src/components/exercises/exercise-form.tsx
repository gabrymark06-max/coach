"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/db";
import {
  createExercise,
  DuplicateNameError,
  updateExercise,
} from "@/lib/db/mutations";
import {
  EQUIPMENT_LABEL,
  MUSCLE_GROUP_LABEL,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const MUSCLES = Object.keys(MUSCLE_GROUP_LABEL) as MuscleGroup[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[];

/**
 * Esercizio personalizzato — spec §3.4.
 *
 * Il `Salva` resta abilitato anche quando il form non e' valido (§11.8): si preme, si
 * valida, e l'errore compare accanto al campo con il focus che ci va sopra. Un bottone
 * disabilitato nasconde all'utente il perche'.
 */
export function ExerciseForm({ exercise }: { exercise?: Exercise }) {
  const router = useRouter();
  const [name, setName] = React.useState(exercise?.name ?? "");
  const [muscleGroup, setMuscleGroup] = React.useState<MuscleGroup>(
    exercise?.muscleGroup ?? "chest",
  );
  const [equipment, setEquipment] = React.useState<Equipment>(
    exercise?.equipment ?? "barbell",
  );
  const [notes, setNotes] = React.useState(exercise?.notes ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const nameId = React.useId();
  const errorId = React.useId();

  const save = async () => {
    if (name.trim() === "") {
      setError("Dai un nome all'esercizio.");
      document.getElementById(nameId)?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = { name, muscleGroup, equipment, notes };
      if (exercise) {
        await updateExercise(getDb(), exercise.id, payload);
        toast.success(`Esercizio «${name.trim()}» aggiornato`);
        router.push(`/esercizi/${exercise.id}`);
      } else {
        const created = await createExercise(getDb(), payload);
        toast.success(`Esercizio «${created.name}» creato`);
        router.push(`/esercizi/${created.id}`);
      }
    } catch (caught) {
      setSaving(false);
      if (caught instanceof DuplicateNameError) {
        setError("Esiste già un esercizio con questo nome.");
        document.getElementById(nameId)?.focus();
        return;
      }
      toast.error("Non riesco a salvare l'esercizio su questo dispositivo.");
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <label className="flex flex-col gap-2">
        <span className="text-base font-semibold text-[var(--text-primary)]">Nome</span>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder="Rematore Kroc"
          translate="no"
          className={cn(
            "h-12 rounded-[var(--radius-sm)] border bg-[var(--input)] px-3 text-base text-[var(--text-primary)]",
            "placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
            error ? "border-2 border-[var(--danger)]" : "border-[var(--border-strong)]",
          )}
        />
        {error ? (
          <span id={errorId} className="text-sm text-[var(--danger)]">
            {error}
          </span>
        ) : null}
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold text-[var(--text-primary)]">
          Muscolo target
        </legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((value) => (
            <Radio
              key={value}
              name="muscolo"
              label={MUSCLE_GROUP_LABEL[value]}
              checked={muscleGroup === value}
              onChange={() => setMuscleGroup(value)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold text-[var(--text-primary)]">
          Attrezzatura
        </legend>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT.map((value) => (
            <Radio
              key={value}
              name="attrezzo"
              label={EQUIPMENT_LABEL[value]}
              checked={equipment === value}
              onChange={() => setEquipment(value)}
            />
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-base font-semibold text-[var(--text-primary)]">
          Note <span className="font-normal text-[var(--text-muted)]">(facoltative)</span>
        </span>
        <textarea
          value={notes}
          rows={3}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Presa, setup, cose da ricordare…"
          className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] p-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        />
      </label>

      <div className="flex flex-col gap-3 md:flex-row-reverse">
        <Button
          size="lg"
          block
          className="md:w-auto"
          loading={saving}
          loadingLabel="Salvo…"
          onClick={() => void save()}
        >
          {exercise ? "Salva modifiche" : "Crea esercizio"}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          block
          className="md:w-auto"
          onClick={() => router.back()}
        >
          Annulla
        </Button>
      </div>
    </div>
  );
}

/** Il bersaglio e' tutta l'etichetta: nessuna zona morta tra il pallino e il testo (§11.8). */
function Radio({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]",
        checked
          ? "border-[var(--primary)] bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]"
          : "border-[var(--border-strong)] bg-[var(--popover)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}
