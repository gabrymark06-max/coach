"use client";

import Link from "next/link";
import type { Consistency as ConsistencyT, ConsistencyDay } from "@/lib/api/types";
import { formatLongDay } from "@/lib/format";
import { NoteMark } from "@/components/note/NoteMark";

const DAY_LABEL: Record<ConsistencyDay["status"], string> = {
  done: "seduta fatta",
  short: "seduta corta",
  return: "seduta fatta, sei tornato",
  skipped: "seduta non fatta",
  rest: "riposo",
  future: "in programma",
  none: "",
};

function isoWeek(d: string): number {
  const date = new Date(`${d}T12:00:00Z`);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((date.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
}

/** Costanza (§2.17): numero largo con nota, griglia 4×7 a forme (senza colore), caption e legenda a parole. */
export function Consistency({ data, plan, weeks = 4 }: { data: ConsistencyT; plan: "free" | "pro"; weeks?: number }) {
  const rows: ConsistencyDay[][] = [];
  for (let i = 0; i < data.days.length; i += 7) rows.push(data.days.slice(i, i + 7));
  const firstWeek = data.planned === 0 || rows.length < 2;
  return (
    <figure className="stack">
      <div>
        <p className="t-numero">
          {data.done} su {data.planned}
          <NoteMark note={data.note} scope="cons" />
        </p>
        <p className="t-etichetta muted">Sedute fatte nelle ultime {weeks} settimane</p>
      </div>
      <div className="dots" role="group" aria-label="Mappa delle sedute">
        <span aria-hidden="true" />
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
          <span key={i} className="dots-head t-etichetta">
            <abbr title={["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"][i]}>{d}</abbr>
          </span>
        ))}
        {rows.map((w, wi) => (
          <Row key={wi} week={w} />
        ))}
      </div>
      <figcaption className="t-nota">{firstWeek ? "Prima settimana: la mappa si riempie da qui." : data.caption_it}</figcaption>
      <dl className="legend t-nota">
        <div>
          <dt className="t-etichetta">pieno</dt>
          <dd>= fatta</dd>
        </div>
        <div>
          <dt className="t-etichetta">metà</dt>
          <dd>= corta</dd>
        </div>
        <div>
          <dt className="t-etichetta">bordo giallo</dt>
          <dd>= ritorno</dd>
        </div>
        <div>
          <dt className="t-etichetta">vuoto</dt>
          <dd>= non fatta</dd>
        </div>
        <div>
          <dt className="t-etichetta">punto</dt>
          <dd>= riposo</dd>
        </div>
      </dl>
      {plan === "pro" && weeks < 12 ? (
        <Link href="/progressi?settimane=12" className="btn btn-tertiary">
          Vedi tutto lo storico
        </Link>
      ) : data.window_limited_by_plan ? (
        <p className="t-nota muted">In Base vedi le ultime 8 settimane.</p>
      ) : null}
    </figure>
  );
}

function Row({ week }: { week: ConsistencyDay[] }) {
  const first = week[0];
  return (
    <>
      <span className="dots-row-label t-etichetta">Sett. {first ? isoWeek(first.date) : ""}</span>
      {week.map((d) => (
        <span key={d.date} className="dot" data-status={d.status} role={d.status === "none" ? undefined : "img"} aria-label={d.status === "none" ? undefined : `${formatLongDay(d.date)}: ${DAY_LABEL[d.status]}`} aria-hidden={d.status === "none" || undefined}>
          {d.status === "future" || d.status === "none" ? null : (
            <span className="dot-shape">
              {d.status === "short" ? (
                <>
                  <div />
                  <div />
                </>
              ) : null}
            </span>
          )}
        </span>
      ))}
    </>
  );
}
