"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import { listExercises, listRoutines } from "@/lib/db/queries";
import { normalizeName } from "@/lib/db/schema";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { cn } from "@/lib/utils";
import { pushRecentSearch, readRecentSearches, type RecentHit } from "./recent-searches";

const MAX_HITS = 8;
const DEBOUNCE_MS = 120;
const ANNOUNCE_MS = 500;

/**
 * `GlobalSearch` — §4.19.3, in cima alla sidebar.
 *
 * Il riferimento ha «Cerca utenti». Qui non ci sono utenti: il campo cerca **esercizi e
 * routine**, che sono le due cose che si cercano davvero in un'app di allenamento.
 *
 * Non ha uno stato di caricamento, e non e' una dimenticanza: 300 voci in memoria si
 * filtrano in meno di 16ms, e §4.14 dice che sotto il secondo non si mostra un
 * indicatore. Ha invece **due** stati vuoti distinti — campo vuoto e nessun risultato —
 * perche' sono due situazioni diverse e meritano due frasi diverse.
 *
 * **Sotto 1024px non esiste.** Non si aggiunge una lente alla bottom nav: la ricerca
 * della libreria e' gia' in cima a `/esercizi`, e due campi che cercano cose diverse con
 * la stessa icona sono peggio di uno solo.
 */
export function GlobalSearch() {
  const router = useRouter();
  const inputId = React.useId();
  const listId = React.useId();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const [recents, setRecents] = React.useState<RecentHit[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounce = React.useRef(0);

  /*
    Tutto in memoria, una volta sola: §9.6 dice esplicitamente «nessuna query per tasto».
    `liveQuery` rinfresca da sola quando l'utente crea un esercizio o una routine.
  */
  const data = useLiveData(async () => {
    const db = getDb();
    const [exercises, routines] = await Promise.all([
      listExercises(db),
      listRoutines(db),
    ]);
    return { exercises, routines };
  }, []);

  const hits = React.useMemo<RecentHit[]>(() => {
    const needle = normalizeName(query);
    if (needle === "" || !data.data) return [];

    const found: RecentHit[] = [];
    for (const routine of data.data.routines) {
      if (found.length >= MAX_HITS) break;
      if (!normalizeName(routine.name).includes(needle)) continue;
      found.push({
        id: routine.id,
        label: routine.name,
        href: `/allenamento/routine/${routine.id}`,
        group: "ROUTINE",
      });
    }
    for (const exercise of data.data.exercises) {
      if (found.length >= MAX_HITS) break;
      if (!exercise.nameKey.includes(needle)) continue;
      found.push({
        id: exercise.id,
        label: exercise.name,
        href: `/esercizi/${exercise.id}`,
        group: "ESERCIZI",
      });
    }
    return found;
  }, [query, data.data]);

  const typing = query !== "";
  const visible = typing ? hits : recents;

  // Annuncio con debounce: mai un annuncio per tasto (§4.19.3).
  React.useEffect(() => {
    if (!open || !typing) return;
    const timer = window.setTimeout(() => {
      announce(
        "system",
        hits.length === 0
          ? "Nessun risultato."
          : `${hits.length} ${hits.length === 1 ? "risultato" : "risultati"}.`,
      );
    }, ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [hits.length, open, typing]);

  const choose = (hit: RecentHit) => {
    setOpen(false);
    setQuery("");
    if (inputRef.current) inputRef.current.value = "";
    setRecents(pushRecentSearch(hit));
    router.push(hit.href);
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        Cerca esercizi o routine
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
        strokeWidth={1.75}
      />
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && visible[cursor] ? `${listId}-${visible[cursor].id}` : undefined
        }
        autoComplete="off"
        // §11.8: un'istruzione come placeholder finisce con i puntini
        placeholder="Cerca esercizi o routine…"
        /*
          Non controllato, con eco immediato sul campo e filtro con debounce (§4.26): il
          campo non aspetta mai il filtro.
        */
        onFocus={() => {
          setRecents(readRecentSearches());
          setOpen(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
        onChange={(event) => {
          const value = event.currentTarget.value;
          window.clearTimeout(debounce.current);
          debounce.current = window.setTimeout(() => {
            setQuery(value);
            setCursor(0);
          }, DEBOUNCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // §8.10: `Esc` chiude e **restituisce il focus al campo**
            setOpen(false);
            event.currentTarget.focus();
            return;
          }
          if (!open || visible.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((value) => (value + 1) % visible.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((value) => (value - 1 + visible.length) % visible.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            const hit = visible[cursor];
            if (hit) choose(hit);
          }
        }}
        className={cn(
          "h-[var(--sidebar-search-h)] w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)]",
          "bg-[var(--input)] pl-9 pr-3 text-base text-[var(--text-primary)]",
          "placeholder:text-[var(--text-muted)]",
          "focus-visible:border-[var(--accent-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        )}
      />

      {open ? (
        <div
          className={cn(
            "absolute inset-x-0 top-[calc(var(--sidebar-search-h)+var(--space-2))] z-[var(--z-dialog)]",
            "rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--popover)]",
            "p-1 shadow-[var(--elev-2)]",
          )}
        >
          {data.status === "error" ? (
            <Message
              line="Impossibile leggere la libreria."
              action={{ label: "Riprova", onSelect: data.retry }}
            />
          ) : visible.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Risultati della ricerca">
              {visible.map((hit, index) => {
                const heading = typing
                  ? index === 0 || visible[index - 1].group !== hit.group
                    ? hit.group
                    : null
                  : index === 0
                    ? "RECENTI"
                    : null;
                return (
                  <React.Fragment key={`${hit.group}-${hit.id}`}>
                    {heading ? (
                      <li
                        role="presentation"
                        className="px-3 pb-1 pt-2 text-label text-[var(--text-secondary)]"
                      >
                        {heading}
                      </li>
                    ) : null}
                    <li
                      id={`${listId}-${hit.id}`}
                      role="option"
                      aria-selected={index === cursor}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(hit)}
                      onMouseEnter={() => setCursor(index)}
                      className={cn(
                        "flex min-h-11 cursor-default items-center rounded-[var(--radius-sm)] px-3",
                        index === cursor && "bg-[var(--surface-hover)]",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-base text-[var(--text-primary)]">
                        {hit.label}
                      </span>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          ) : typing ? (
            <Message
              line={`Nessun risultato per «${query}».`}
              action={{
                label: `Crea l'esercizio «${query}»`,
                onSelect: () => {
                  setOpen(false);
                  router.push(`/esercizi/nuovo?nome=${encodeURIComponent(query)}`);
                },
              }}
            />
          ) : (
            <Message line="Scrivi il nome di un esercizio o di una routine." />
          )}
        </div>
      ) : null}
    </div>
  );
}

function Message({
  line,
  action,
}: {
  line: string;
  action?: { label: string; onSelect: () => void };
}) {
  return (
    <div className="px-3 py-3">
      <p className="text-sm text-[var(--text-secondary)]">{line}</p>
      {action ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={action.onSelect}
          className="mt-2 h-11 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
