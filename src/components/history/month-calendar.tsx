"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { announce } from "@/lib/announce";
import { getDb } from "@/lib/db/db";
import { calendarMonth, latestMonthWithSessions, type CalendarDay } from "@/lib/db/queries";
import { formatSessionCount } from "@/lib/format";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  addMonths,
  dayKey,
  dayLabel,
  formatMonthKey,
  initialFocusDay,
  monthGrid,
  monthLabel,
  monthOf,
  moveFocus,
  WEEKDAYS,
  type CalendarMove,
  type MonthKey,
} from "@/lib/logic/calendar";
import { cn } from "@/lib/utils";

const KEY_MOVES: Record<string, CalendarMove> = {
  ArrowLeft: "prev-day",
  ArrowRight: "next-day",
  ArrowUp: "prev-week",
  ArrowDown: "next-week",
  Home: "week-start",
  End: "week-end",
  PageUp: "prev-month",
  PageDown: "next-month",
};

/**
 * `MonthCalendar` — §4.27.
 *
 * **Due canali ortogonali, cosi' non si contendono mai lo stesso segnale**: il
 * riempimento dice «allenato», la sottolineatura dice «oggi». Togliendo tutti i colori
 * un giorno allenato resta riconoscibile dal riempimento scuro, dalla barra sotto e dal
 * peso 700; oggi resta riconoscibile dalla sottolineatura.
 *
 * Il mese in vista sta nella **query string** (`/profilo?mese=2026-09`), non in
 * `useState` (§11.5): il tasto Indietro torna al mese precedente e il link e'
 * condivisibile.
 *
 * Tastiera: pattern griglia APG. Roving tabindex — una sola cella nel tab order —
 * frecce, `Home`/`End`, `PagSu`/`PagGiù`; **uscire dal mese con le frecce lo cambia**.
 */
export function MonthCalendar({
  month,
  onMonthChange,
}: {
  month: MonthKey;
  onMonthChange: (next: MonthKey) => void;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const titleId = React.useId();

  const state = useLiveData(
    () => calendarMonth(getDb(), month.year, month.month),
    [month.year, month.month],
  );

  const giorni = React.useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const giorno of state.data ?? []) map.set(giorno.day, giorno);
    return map;
  }, [state.data]);

  const oggi = React.useMemo(() => new Date(), []);
  const oggiKey = dayKey(oggi);

  const [focusDay, setFocusDay] = React.useState<string | null>(null);
  // `true` solo dopo un movimento da tastiera: non si ruba il fuoco all'apertura.
  const wantFocus = React.useRef(false);

  const trained = React.useMemo(() => [...giorni.keys()], [giorni]);
  const roving =
    focusDay && focusDay.startsWith(formatMonthKey(month))
      ? focusDay
      : initialFocusDay(month, trained, oggi);

  /*
    Il fuoco si sposta **dopo** che la cella esiste, non appena cambia `focusDay`.
    Uscire dal mese con una freccia cambia anche il mese, e il mese passa dalla query
    string: per un render la griglia in pagina e' ancora quella vecchia, dove il giorno
    di destinazione e' una cella di coda senza id. Un effetto senza lista di dipendenze
    riprova al render successivo, che e' esattamente quando la cella compare.
  */
  React.useEffect(() => {
    if (!wantFocus.current || !focusDay) return;
    const node = document.getElementById(`cal-${focusDay}`);
    if (!node) return;
    wantFocus.current = false;
    node.focus();
  });

  const vaiAlMese = React.useCallback(
    (next: MonthKey, conteggio?: number) => {
      onMonthChange(next);
      // §8.10: **una volta sola**, non a ogni cella attraversata.
      announce(
        "system",
        conteggio === undefined
          ? monthLabel(next)
          : `${monthLabel(next)}, ${formatSessionCount(conteggio)}`,
      );
    },
    [onMonthChange],
  );

  const onKeyDown = (event: React.KeyboardEvent, day: string) => {
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();

    const next = moveFocus(day, move);
    const nextMonth = monthOf(new Date(next.replace(/-/g, "/")));
    wantFocus.current = true;
    setFocusDay(next);

    if (nextMonth.year !== month.year || nextMonth.month !== month.month) {
      vaiAlMese(nextMonth);
    }
  };

  if (state.status === "loading") {
    return (
      <div>
        <Intestazione
          titleId={titleId}
          month={month}
          onPrev={() => vaiAlMese(addMonths(month, -1))}
          onNext={() => vaiAlMese(addMonths(month, 1))}
        />
        <Griglia aria-hidden="true">
          {Array.from({ length: 42 }, (_, i) => (
            <Skeleton key={i} className="size-[var(--cal-cell)] rounded-full" />
          ))}
        </Griglia>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--danger)] p-4">
        <p className="text-base text-[var(--text-primary)]">
          Non riesco a leggere il calendario.
        </p>
        <button
          type="button"
          onClick={state.retry}
          className="mt-2 h-11 rounded-[var(--radius-sm)] text-sm font-semibold text-[var(--accent-blue)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          Riprova
        </button>
      </div>
    );
  }

  const celle = monthGrid(month);

  return (
    <div>
      <Intestazione
        titleId={titleId}
        month={month}
        onPrev={() => vaiAlMese(addMonths(month, -1))}
        onNext={() => vaiAlMese(addMonths(month, 1))}
      />

      {/*
        `table-fixed`: le sette colonne si dividono la larghezza disponibile invece di
        pretenderne 44 ciascuna. Con celle a larghezza fissa il mese veniva **tagliato**
        a destra — cinque colonne su sette a 375px — e una griglia tagliata non e' una
        griglia. L'altezza resta 44px ovunque; la larghezza vale 45,5px a 375 (dove il
        contenitore non ha imbottitura orizzontale) e ~38px nella colonna destra, che
        esiste solo da 1280 in su, dove si punta col mouse.
      */}
      <table
        role="grid"
        aria-labelledby={titleId}
        className={cn(
          "w-full table-fixed border-separate border-spacing-[var(--cal-gap)]",
          reduced ? "" : "transition-opacity duration-[var(--dur-2)] ease-[var(--ease-out)]",
        )}
      >
        <thead>
          <tr>
            {WEEKDAYS.map((weekday, index) => (
              <th
                key={index}
                scope="col"
                className="pb-1 text-label font-semibold text-[var(--text-secondary)]"
              >
                <span aria-hidden="true">{weekday.short}</span>
                <span className="sr-only">{weekday.long}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, riga) => (
            <tr key={riga}>
              {celle.slice(riga * 7, riga * 7 + 7).map((cella) => (
                <Cella
                  key={cella.day}
                  cella={cella}
                  giorno={giorni.get(cella.day)}
                  oggi={cella.day === oggiKey}
                  futuro={cella.day > oggiKey}
                  roving={cella.day === roving}
                  onKeyDown={onKeyDown}
                  onOpen={(id) => router.push(`/profilo/sessione/${id}`)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {state.data.length === 0 ? <MeseVuoto month={month} onGo={vaiAlMese} /> : null}
    </div>
  );
}

function Intestazione({
  titleId,
  month,
  onPrev,
  onNext,
}: {
  titleId: string;
  month: MonthKey;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <BottoneMese
        direction="prev"
        label={`Mese precedente, ${monthLabel(addMonths(month, -1))}`}
        onClick={onPrev}
      />
      <h3 id={titleId} className="min-w-0 truncate text-h3 text-[var(--text-primary)]">
        {monthLabel(month)}
      </h3>
      <BottoneMese
        direction="next"
        label={`Mese successivo, ${monthLabel(addMonths(month, 1))}`}
        onClick={onNext}
      />
    </div>
  );
}

function BottoneMese({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="press inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
    </button>
  );
}

function Griglia({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="grid grid-cols-7 gap-[var(--cal-gap)] justify-items-center" {...props}>
      {children}
    </div>
  );
}

/**
 * Una cella della griglia.
 *
 * **Il `gridcell` e' la `<td>`**, non un elemento dentro di lei: un `role="gridcell"`
 * su un figlio ha come genitore una `<td>` (ruolo `cell`) e non una `row`, e axe lo
 * segnala giustamente con `aria-required-parent`. Quindi la cella e' anche l'elemento
 * focalizzabile, come nella variante «focusable gridcell» del pattern APG: il roving
 * tabindex, l'etichetta e i tasti stanno tutti qui.
 */
function Cella({
  cella,
  giorno,
  oggi,
  futuro,
  roving,
  onKeyDown,
  onOpen,
}: {
  cella: { day: string; dayOfMonth: number; inMonth: boolean };
  giorno?: CalendarDay;
  oggi: boolean;
  futuro: boolean;
  roving: boolean;
  onKeyDown: (event: React.KeyboardEvent, day: string) => void;
  onOpen: (sessionId: string) => void;
}) {
  const [aperto, setAperto] = React.useState(false);
  const allenato = Boolean(giorno && giorno.sessions.length > 0);
  const quante = giorno?.sessions.length ?? 0;

  /*
    Fuori dal mese: chiude la griglia e basta. Esce dall'albero accessibile e dal tab
    order. Il numerale resta — aiuta a capire dove finisce il mese — ma **non in
    `--text-disabled`**: a 2,92:1 fallirebbe 1.4.3, e §8.1 dice che il contrasto non si
    negozia mai. Scostamento dichiarato rispetto a §4.27, che quel 2,92 lo dava per
    esente.
  */
  if (!cella.inMonth) {
    return (
      <td aria-hidden="true" className="p-0 text-center">
        <span className="tnum inline-flex h-11 w-full items-center justify-center text-num-md font-normal text-[var(--text-muted)]">
          {cella.dayOfMonth}
        </span>
      </td>
    );
  }

  const etichetta = `${dayLabel(cella.day)}${oggi ? ", oggi" : ""}, ${
    allenato
      ? `${formatSessionCount(quante)}: ${giorno!.sessions.map((s) => s.name).join(", ")}`
      : "nessun allenamento"
  }`;

  const apri = () => {
    if (!allenato) return;
    if (quante === 1) onOpen(giorno!.sessions[0].id);
    else setAperto(true);
  };

  const contenuto = (
    <span className="group flex flex-col items-center justify-center">
      <span
        className={cn(
          "tnum inline-flex size-[var(--cal-cell)] items-center justify-center rounded-full",
          "transition-transform duration-[var(--dur-1)] ease-[var(--ease-tap)]",
          allenato
            ? "bg-[var(--primary)] font-bold text-[var(--primary-foreground)] group-hover:bg-[var(--primary-hover)] group-active:scale-[0.94] motion-reduce:group-active:scale-100"
            : futuro
              ? "text-[var(--text-muted)]"
              : "text-[var(--text-primary)]",
          oggi &&
            "underline decoration-2 underline-offset-[3px] " +
              (allenato ? "" : "font-bold text-[var(--accent-blue)]"),
        )}
      >
        {cella.dayOfMonth}
      </span>

      {/* il secondo canale: la corsia del sistema, girata di 90 gradi sotto al cerchio */}
      {allenato ? (
        <span aria-hidden="true" className="mt-0.5 flex justify-center gap-[3px]">
          {Array.from({ length: Math.min(quante, 2) }, (_, i) => (
            <span
              key={i}
              className="block h-[3px] rounded-[var(--radius-xs)] bg-[var(--blue-brand)]"
              style={{
                width:
                  quante === 1 ? "var(--cal-cell)" : "calc((var(--cal-cell) - 3px) / 2)",
              }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );

  const cellaTd = (
    <td
      id={`cal-${cella.day}`}
      role="gridcell"
      tabIndex={roving ? 0 : -1}
      aria-label={etichetta}
      onKeyDown={(event) => {
        if (allenato && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          apri();
          return;
        }
        onKeyDown(event, cella.day);
      }}
      onClick={apri}
      className={cn(
        "h-11 p-0 text-center align-middle",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        allenato && "cursor-pointer",
      )}
    >
      {contenuto}
    </td>
  );

  /*
    Un solo allenamento: `Invio` apre il dettaglio. Due o piu': un popover con l'elenco,
    non una scelta arbitraria fatta al posto dell'utente.
  */
  if (quante <= 1) return cellaTd;

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverAnchor asChild>{cellaTd}</PopoverAnchor>
      <PopoverContent align="center" onOpenAutoFocus={(event) => event.preventDefault()}>
        <ul className="flex flex-col">
          {giorno!.sessions.map((sessione) => (
            <li key={sessione.id}>
              <Link
                href={`/profilo/sessione/${sessione.id}`}
                className="flex h-12 items-center rounded-[var(--radius-sm)] px-3 text-base text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                {sessione.name}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Mese senza allenamenti: la griglia **resta** — serve comunque a orientarsi — e sotto
 * compare la frase, con un link al mese piu' recente che ne ha. Cliccare la freccia al
 * buio finche' non si trova qualcosa non e' navigare.
 */
function MeseVuoto({
  month,
  onGo,
}: {
  month: MonthKey;
  onGo: (next: MonthKey, conteggio?: number) => void;
}) {
  const precedente = useLiveData(
    () => latestMonthWithSessions(getDb(), month),
    [month.year, month.month],
  );

  return (
    <p className="mt-3 text-sm text-[var(--text-secondary)]">
      Nessun allenamento a {monthLabel(month).replace(/ \d{4}$/, "")}.
      {precedente.data ? (
        <>
          {" "}
          <button
            type="button"
            onClick={() =>
              onGo(
                { year: precedente.data!.year, month: precedente.data!.month },
                precedente.data!.count,
              )
            }
            className="font-semibold text-[var(--accent-blue)] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Vai a {monthLabel({ year: precedente.data.year, month: precedente.data.month })} (
            {formatSessionCount(precedente.data.count)})
          </button>
        </>
      ) : null}
    </p>
  );
}
