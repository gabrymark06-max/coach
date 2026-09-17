"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { usePlan, useMe, isNoPlan } from "@/lib/hooks/useApi";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import type { Week, WeekSession } from "@/lib/api/types";
import { formatDate, weekdayLong, weekdayShort } from "@/lib/format";
import { useIsDesktop, useIsTablet } from "@/lib/hooks/useMedia";
import { PageHead } from "@/components/nav/AppShell";
import { Skeleton, SkeletonBig } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Apparatus } from "@/components/note/Apparatus";
import { NotedText } from "@/components/note/NotedText";
import { Glyph } from "@/components/ui/Glyph";
import { ProPill } from "@/components/ui/Pill";
import { SessionPanel } from "./SessionPanel";
import { ChatScreen } from "@/components/chat/ChatScreen";

const STATUS_LABEL: Record<WeekSession["status"], string> = { done: "Fatta", skipped: "Saltata", short: "Corta", today: "Oggi", planned: "", none: "" };

function cellLabel(s: WeekSession): string {
  const st = STATUS_LABEL[s.status] ? `, ${STATUS_LABEL[s.status].toLowerCase()}` : "";
  return `${weekdayLong(s.day)} ${formatDate(s.date)}, ${s.name}${st}, ${s.sets_count} serie`;
}

/** Settimana / mesociclo (§2.16): lista (< 768), tabella (≥ 768), chat a lato (≥ 1024), pannello dettaglio. */
export function WeekScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: plan, error, isLoading, mutate } = usePlan();
  const { data: me } = useMe();
  const tablet = useIsTablet();
  const desktop = useIsDesktop();
  const [selected, setSelected] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const acted = useRef(false);

  // Ritorno dal riepilogo o dai prezzi: mantenimento (free) o blocco nuovo (Pro)
  useEffect(() => {
    if (!plan || acted.current) return;
    const wantsMaint = params.get("mantenimento") === "1";
    const wantsNew = params.get("blocco") === "nuovo";
    if (!wantsMaint && !wantsNew) return;
    acted.current = true;
    (async () => {
      setActionBusy(true);
      try {
        if (wantsMaint && plan.mesocycle.status === "completed") await api.plans.maintenance();
        if (wantsNew && plan.mesocycle.status !== "active") await api.plans.newMesocycle();
        await Promise.all([mutate(), globalMutate("/today"), globalMutate("/me"), globalMutate("/chat/messages")]);
      } catch (e) {
        setActionError(isApiError(e) ? e.detail : "Errore. Riprova.");
      } finally {
        setActionBusy(false);
        router.replace("/settimana");
      }
    })();
  }, [plan, params, mutate, globalMutate, router]);

  if (isLoading || actionBusy) {
    return (
      <>
        <PageHead title="Settimana" />
        {tablet ? <SkeletonBig label="Carico la scheda…" /> : <Skeleton lines={3} label="Carico la scheda…" />}
      </>
    );
  }
  if (error) {
    return (
      <>
        <PageHead title="Settimana" />
        {isNoPlan(error) ? (
          <div className="empty">
            <h2 className="t-titolo">Il piano non c&apos;è ancora.</h2>
            <Link href="/onboarding/1" className="btn btn-primary">
              Vai all&apos;onboarding
            </Link>
          </div>
        ) : (
          <ErrorBox error={error} onRetry={() => mutate()} title="Non riesco a caricare il piano." supportEmail={me?.support_email} />
        )}
      </>
    );
  }
  if (!plan) return null;

  const meso = plan.mesocycle;
  const sub = meso.status === "maintenance" ? "Mantenimento · la settimana si ripete" : `Blocco ${meso.index} · ${meso.total_weeks} settimane`;

  return (
    <div className="week-layout">
      <div className="week-main">
        <PageHead title={<>Settimana{meso.editable && me?.entitlement.plan === "pro" ? <ProPill /> : null}</>} sub={sub} />
        {actionError ? (
          <p className="t-corpo" role="alert">
            Errore: {actionError}
          </p>
        ) : null}
        {meso.status === "completed" ? (
          <div className="pro-card" style={{ marginBottom: "var(--space-6)" }}>
            <p className="t-voce">Il blocco {meso.index} è chiuso. Scegli come continuare.</p>
            <Link href={`/blocco/${meso.index}/riepilogo`} className="btn btn-secondary">
              Vedi il riepilogo del blocco
            </Link>
          </div>
        ) : null}
        {meso.status === "maintenance" && !meso.editable ? (
          <p className="t-nota" style={{ marginBottom: "var(--space-6)" }}>
            {meso.maintenance_note_it ?? "In mantenimento la settimana si ripete uguale. Per modificarla serve il blocco 2 — Pro."}{" "}
            <Link href="/prezzi?da=maintenance_request">Vedi Pro</Link>
          </p>
        ) : null}
        {plan.weeks.length === 0 ? (
          <div className="empty">
            <h2 className="t-titolo">Il piano non c&apos;è ancora.</h2>
            <Link href="/onboarding/1" className="btn btn-primary">
              Vai all&apos;onboarding
            </Link>
          </div>
        ) : tablet ? (
          <WeekTable weeks={plan.weeks} notes={plan.notes} onSelect={setSelected} selected={selected} />
        ) : (
          <WeekList weeks={plan.weeks} notes={plan.notes} onSelect={setSelected} />
        )}
        <Apparatus notes={plan.notes} scope="plan" />
      </div>
      {desktop ? (
        <aside className="week-chat" aria-label="Coach">
          <ChatScreen embedded />
        </aside>
      ) : null}
      {selected ? <SessionPanel sessionId={selected} editable={meso.editable} onClose={() => setSelected(null)} onChanged={() => mutate()} /> : null}
    </div>
  );
}

function WeekTable({ weeks, notes, onSelect, selected }: { weeks: Week[]; notes: import("@/lib/api/types").Note[]; onSelect: (id: string) => void; selected: string | null }) {
  const cols = Math.max(...weeks.map((w) => w.sessions.length), 1);
  return (
    <div className="week-table-wrap" tabIndex={0}>
      <table className="week-table">
        <caption className="visually-hidden">Le settimane del blocco</caption>
        <thead>
          <tr>
            <th scope="col" className="t-etichetta">
              Settimana
            </th>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} scope="col" className="t-etichetta">
                Seduta {String.fromCharCode(65 + i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={`${w.n}-${i}`}>
              <th scope="row">
                <span className="t-corpo-strong">{w.label_it}</span>
                {w.changes_it.map((c, i) => (
                  <span key={i} className="t-nota muted" style={{ display: "block" }}>
                    <NotedText text={c.text} notes={notes} scope="plan" />
                  </span>
                ))}
              </th>
              {Array.from({ length: cols }).map((_, i) => {
                const s = w.sessions[i];
                if (!s) return <td key={i} />;
                return (
                  <td key={s.session_id}>
                    <button type="button" className="week-cell" data-today={s.status === "today" || undefined} aria-label={cellLabel(s)} aria-pressed={selected === s.session_id} onClick={() => onSelect(s.session_id)}>
                      <span className="t-etichetta muted">{weekdayShort(s.day)}</span>
                      <span className="t-corpo-strong">{s.name}</span>
                      <span className="t-nota muted">
                        {s.exercises_count} esercizi · {s.sets_count} serie · {s.est_minutes}′
                      </span>
                      {STATUS_LABEL[s.status] ? <span className="t-etichetta">{STATUS_LABEL[s.status]}</span> : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** In mantenimento le settimane si ripetono con la stessa etichetta: il nome del landmark aggiunge la data (QA M7). */
function weekName(w: Week, weeks: Week[]): string {
  const twins = weeks.filter((x) => x.label_it === w.label_it).length;
  const first = w.sessions[0];
  return twins > 1 && first ? `${w.label_it}, dal ${formatDate(first.date)}` : w.label_it;
}

function WeekList({ weeks, notes, onSelect }: { weeks: Week[]; notes: import("@/lib/api/types").Note[]; onSelect: (id: string) => void }) {
  return (
    <div className="stack-6">
      {weeks.map((w, i) => (
        <section key={`${w.n}-${i}`} aria-label={weekName(w, weeks)}>
          <h2 id={`w-${w.n}-${i}`} className="t-corpo-strong">
            {w.label_it}
          </h2>
          {w.changes_it.map((c, i) => (
            <p key={i} className="t-nota muted">
              <NotedText text={c.text} notes={notes} scope="plan" />
            </p>
          ))}
          <ul className="week-list">
            {w.sessions.map((s) => (
              <li key={s.session_id}>
                <button type="button" data-today={s.status === "today" || undefined} aria-label={cellLabel(s)} onClick={() => onSelect(s.session_id)}>
                  <span>
                    <span className="t-etichetta muted">{weekdayShort(s.day)} </span>
                    <span className="t-corpo-strong">{s.name}</span>
                    {STATUS_LABEL[s.status] ? <span className="t-etichetta"> · {STATUS_LABEL[s.status]}</span> : null}
                  </span>
                  <Glyph name="chevron" size={20} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
