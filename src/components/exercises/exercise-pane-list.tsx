"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { announce } from "@/lib/announce";
import {
  EQUIPMENT_LABEL,
  EQUIPMENT_ORDER,
  MUSCLE_GROUP_LABEL,
  MUSCLE_GROUP_ORDER,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import type { ExerciseFilterValue } from "./exercise-filters";

const DEBOUNCE_MS = 120;
const ANNOUNCE_MS = 500;
/** `--row-list-desk`: **costante**, mai misurata a runtime (§4.26). */
const ROW_H = 48;
const HEADER_H = 28;

type Riga =
  | { kind: "header"; key: string; label: string }
  | { kind: "row"; key: string; exercise: Exercise };

/**
 * Il pannello elenco della libreria a due pannelli — §4.26.
 *
 * Sta nella **colonna destra** perche' e' li' che il riferimento lo mette, e perche' la
 * colonna destra del guscio e' gia' il posto dei controlli in ogni altra schermata:
 * metterci anche l'elenco rende il guscio prevedibile invece di eccezionale.
 *
 * Tre decisioni di densita' e di prestazione, tutte misurate:
 *  - **due `<select>` nativi** invece dei chip: a 320px di larghezza, quattordici chip
 *    d'attrezzo occuperebbero quattro righe. I chip restano sotto 1280, dove la barra
 *    e' larga quanto lo schermo;
 *  - righe da 48px contro le 56 del telefono: qui si punta col mouse, e 48 fa stare 13
 *    voci in un pannello alto 640px invece di 11. Resta sopra `--tap-min`;
 *  - **nessuno skeleton al cambio filtro**: 300 voci si filtrano in meno di 16ms, e
 *    §4.14 dice che sotto il secondo non si mostra un indicatore. Lo skeleton esiste
 *    solo al primo mount.
 */
export function ExercisePaneList({
  exercises,
  filter,
  onChange,
  selectedId,
  search,
}: {
  exercises: readonly Exercise[];
  filter: ExerciseFilterValue;
  onChange: (next: ExerciseFilterValue) => void;
  selectedId: string | null;
  /**
   * La query string dei filtri, da riattaccare a ogni riga. Senza, scegliere una voce
   * azzererebbe i filtri della colonna destra: §4.26 chiede il contrario — «la
   * posizione dell'elenco si conserva quando cambia solo il dettaglio».
   */
  search: string;
}) {
  const searchId = React.useId();
  const debounce = React.useRef(0);
  const scroller = React.useRef<HTMLDivElement>(null);

  /*
    §4.26 — il raggruppamento: per gruppo muscolare senza filtro muscolo, per **famiglia
    di movimento** quando un muscolo e' selezionato. `family` e' un campo dello schema
    (§9.4), non una deduzione dal nome.
  */
  const righe = React.useMemo<Riga[]>(() => {
    const perGruppo = new Map<string, Exercise[]>();
    for (const exercise of exercises) {
      const chiave = filter.muscleGroup
        ? exercise.family || "personalizzati"
        : exercise.isCustom && !exercise.family
          ? "personalizzati"
          : exercise.muscleGroup;
      const lista = perGruppo.get(chiave);
      if (lista) lista.push(exercise);
      else perGruppo.set(chiave, [exercise]);
    }

    const chiavi = [...perGruppo.keys()].sort((a, b) => {
      if (a === "personalizzati") return 1;
      if (b === "personalizzati") return -1;
      if (!filter.muscleGroup) {
        return (
          MUSCLE_GROUP_ORDER.indexOf(a as MuscleGroup) -
          MUSCLE_GROUP_ORDER.indexOf(b as MuscleGroup)
        );
      }
      return a.localeCompare(b, "it-IT");
    });

    const out: Riga[] = [];
    for (const chiave of chiavi) {
      out.push({
        kind: "header",
        key: `h-${chiave}`,
        label:
          chiave === "personalizzati"
            ? "Personalizzati"
            : filter.muscleGroup
              ? etichettaFamiglia(perGruppo.get(chiave)![0])
              : MUSCLE_GROUP_LABEL[chiave as MuscleGroup],
      });
      for (const exercise of perGruppo.get(chiave)!) {
        out.push({ kind: "row", key: exercise.id, exercise });
      }
    }
    return out;
  }, [exercises, filter.muscleGroup]);

  /** Posizione di ogni voce nell'insieme completo, intestazioni escluse. */
  const posizione = React.useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const riga of righe) {
      if (riga.kind !== "row") continue;
      n += 1;
      map.set(riga.key, n);
    }
    return map;
  }, [righe]);

  const virtualizer = useVirtualizer({
    count: righe.length,
    getScrollElement: () => scroller.current,
    estimateSize: (index) => (righe[index].kind === "header" ? HEADER_H : ROW_H),
    overscan: 8,
  });

  /*
    §4.26: «la selezione corrente e' sempre montata». In una lista virtualizzata la voce
    scelta puo' stare a duecento righe di distanza dalla finestra visibile e quindi non
    esistere nel DOM: si scorre fino a lei una volta, quando cambia.
  */
  const indiceSelezionato = React.useMemo(
    () => (selectedId ? righe.findIndex((riga) => riga.key === selectedId) : -1),
    [righe, selectedId],
  );
  const ultimoScroll = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (indiceSelezionato < 0 || ultimoScroll.current === indiceSelezionato) return;
    ultimoScroll.current = indiceSelezionato;
    virtualizer.scrollToIndex(indiceSelezionato, { align: "center" });
  }, [indiceSelezionato, virtualizer]);

  // Il contatore si annuncia con debounce, **mai per tasto** (§4.26).
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      announce("system", `${exercises.length} esercizi.`);
    }, ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [exercises.length]);

  return (
    <div className="flex h-[calc(100dvh-var(--space-8)*2)] flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <h2 className="text-h3 text-[var(--text-primary)]">Libreria</h2>
        <Link
          href="/esercizi/nuovo"
          className="inline-flex h-11 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Personalizzato
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${searchId}-attrezzo`} className="sr-only">
          Filtra per attrezzo
        </label>
        <select
          id={`${searchId}-attrezzo`}
          className={SELECT_CLASS}
          value={filter.equipment ?? ""}
          onChange={(event) =>
            onChange({
              ...filter,
              equipment: (event.target.value || null) as Equipment | null,
            })
          }
        >
          <option value="">Tutti gli attrezzi</option>
          {EQUIPMENT_ORDER.map((equipment) => (
            <option key={equipment} value={equipment}>
              {EQUIPMENT_LABEL[equipment]}
            </option>
          ))}
        </select>

        <label htmlFor={`${searchId}-muscolo`} className="sr-only">
          Filtra per muscolo
        </label>
        <select
          id={`${searchId}-muscolo`}
          className={SELECT_CLASS}
          value={filter.muscleGroup ?? ""}
          onChange={(event) =>
            onChange({
              ...filter,
              muscleGroup: (event.target.value || null) as MuscleGroup | null,
            })
          }
        >
          <option value="">Tutti i muscoli</option>
          {MUSCLE_GROUP_ORDER.map((muscle) => (
            <option key={muscle} value={muscle}>
              {MUSCLE_GROUP_LABEL[muscle]}
            </option>
          ))}
        </select>

        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Cerca un esercizio
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            strokeWidth={1.75}
          />
          {/*
            Campo **non controllato** con eco immediato: il filtro parte con 120ms di
            debounce e il campo non lo aspetta mai (§4.26).
          */}
          <input
            id={searchId}
            type="search"
            defaultValue={filter.q}
            placeholder="Cerca esercizi…"
            onChange={(event) => {
              const value = event.currentTarget.value;
              window.clearTimeout(debounce.current);
              debounce.current = window.setTimeout(() => {
                onChange({ ...filter, q: value });
              }, DEBOUNCE_MS);
            }}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--input)] pl-9 pr-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          />
        </div>
      </div>

      <p className="py-2 text-sm text-[var(--text-muted)]" role="status">
        {exercises.length} {exercises.length === 1 ? "esercizio" : "esercizi"}
      </p>

      {exercises.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Nessun esercizio per{" "}
            <em>
              {[
                filter.muscleGroup ? MUSCLE_GROUP_LABEL[filter.muscleGroup] : null,
                filter.equipment ? EQUIPMENT_LABEL[filter.equipment] : null,
                filter.q || null,
              ]
                .filter(Boolean)
                .join(" + ") || "questi filtri"}
            </em>
            .
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onChange({ q: "", muscleGroup: null, equipment: null })}
              className="h-11 rounded-[var(--radius-sm)] text-left text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Azzera filtri
            </button>
            <Link
              href="/esercizi/nuovo"
              className="flex h-11 items-center rounded-[var(--radius-sm)] text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Crea esercizio personalizzato
            </Link>
          </div>
        </div>
      ) : (
        <div
          id="elenco-esercizi"
          ref={scroller}
          data-scroll-area=""
          className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain] [scrollbar-gutter:stable]"
        >
          {/*
            **Una lista di link, non un `listbox`.** Ogni voce porta a una rotta vera
            (`/esercizi/[id]`): un `role="option"` su un `<a>` prometterebbe la
            selezione di un valore dentro un form, e in piu' con la virtualizzazione
            servirebbero `option` figli diretti del `listbox` — cosa che i `<li>` del
            contenitore rendono impossibile senza mentire sulla struttura.

            §8.9 chiede comunque di esporre il numero totale su una lista virtualizzata:
            lo fanno `aria-setsize` e `aria-posinset`, che su `listitem` sono legittimi.
            Senza, uno screen reader annuncerebbe «1 di 13» in mezzo a 269 esercizi.
          */}
          <ul aria-label="Esercizi" className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const riga = righe[item.index];
              const posInSet = riga.kind === "row" ? posizione.get(riga.key) : undefined;
              return (
                <li
                  key={riga.key}
                  aria-posinset={posInSet}
                  aria-setsize={posInSet === undefined ? undefined : exercises.length}
                  className="absolute inset-x-0 top-0"
                  style={{
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  {riga.kind === "header" ? (
                    <p className="flex h-full items-end pb-1 text-label text-[var(--text-secondary)]">
                      {riga.label}
                    </p>
                  ) : (
                    <PaneRow
                      exercise={riga.exercise}
                      selected={riga.exercise.id === selectedId}
                      search={search}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** §11.2: su Windows in tema scuro il `<select>` nativo rende bianco su bianco. */
const SELECT_CLASS = cn(
  "h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)]",
  "bg-[var(--input)] px-3 text-base text-[var(--text-primary)]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
);

/**
 * La voce selezionata porta `aria-current="true"` **e** la corsia: su `--card` la sola
 * differenza di fondo fa 1.36:1, che non e' un segnale (§8.10).
 */
function PaneRow({
  exercise,
  selected,
  search,
}: {
  exercise: Exercise;
  selected: boolean;
  search: string;
}) {
  return (
    <Link
      href={`/esercizi/${exercise.id}${search}`}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex h-12 items-center gap-3 border-b border-[var(--border)] pl-4 pr-2",
        "hover:bg-[var(--surface-hover)]",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        selected && "bg-[var(--surface-hover)]",
      )}
    >
      {selected ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-[3px] rounded-[var(--radius-xs)] bg-[var(--blue-brand)]"
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base text-[var(--text-primary)]">
          {exercise.name}
        </span>
        <span className="block truncate text-xs text-[var(--text-secondary)]">
          {MUSCLE_GROUP_LABEL[exercise.muscleGroup]} ·{" "}
          {EQUIPMENT_LABEL[exercise.equipment]}
        </span>
      </span>
    </Link>
  );
}

/** «Panca piana» da `family` + il nome della prima voce: l'intestazione di famiglia. */
function etichettaFamiglia(exercise: Exercise): string {
  const aperta = exercise.name.indexOf(" (");
  const base = aperta > 0 ? exercise.name.slice(0, aperta) : exercise.name;
  return exercise.variant ? base.replace(` ${exercise.variant}`, "") : base;
}
