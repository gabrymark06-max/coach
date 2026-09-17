"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMe, useToday } from "@/lib/hooks/useApi";
import { useSessionDraft, statusText } from "@/lib/draft/useSessionDraft";
import { countDone, countTodo, draftStore } from "@/lib/draft/store";
import { announce } from "@/lib/announce";
import { isApiError } from "@/lib/api/client";
import { ExerciseBlock } from "@/components/session/ExerciseBlock";
import { RestTimer, newTimer, type TimerState } from "@/components/session/RestTimer";
import { Apparatus } from "@/components/note/Apparatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CLOSE_KEY } from "@/lib/draft/closeKey";
import { readTodayHint, writeTodayHint } from "@/lib/draft/todayHint";
import { NotedText } from "@/components/note/NotedText";

const STATUS_LINE: Record<string, string> = { done: "Seduta chiusa · fatta", short: "Seduta chiusa · versione corta", skipped: "Seduta chiusa · saltata" };

/** La seduta (§2.2, §3.3): scala palestra, bozza in IndexedDB, timer a timestamp, nessun paywall. */
export default function SedutaPage() {
  const router = useRouter();
  const { data: today, error: todayError, isLoading: todayLoading, mutate: reloadToday } = useToday();
  const { data: me } = useMe();
  const [fallbackId, setFallbackId] = useState<string | null>(null);
  // QA M1: l'id della seduta di oggi lo ricordiamo dal giorno stesso (scritto da /oggi e da qui): GET /sessions/{id}
  // parte insieme a GET /today, non dopo. Se /today poi dice un'altra cosa, vince /today.
  const [hintId] = useState(() => readTodayHint());
  // Senza rete /today non risponde: la seduta si riprende dall'ultima bozza salvata sul telefono.
  useEffect(() => {
    if (!todayError || !isApiError(todayError) || todayError.status !== 0) return;
    draftStore.latest().then((dr) => setFallbackId(dr?.session_id ?? null));
  }, [todayError]);
  useEffect(() => {
    if (today?.session_preview) writeTodayHint(today.session_preview.session_id, today.date);
  }, [today]);
  const sessionId = today ? (today.session_preview?.session_id ?? null) : todayError ? (fallbackId ?? hintId) : hintId;
  const d = useSessionDraft(sessionId);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [closeAsk, setCloseAsk] = useState(false);
  const [closing, setClosing] = useState(false);
  // QA R2: due tap nello stesso giro di eventi vedono entrambi `closing === false` (stato React): la guardia vera è il ref.
  const closeInFlight = useRef(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [conflictServer, setConflictServer] = useState<import("@/lib/api/types").Session | null>(null);
  const [firstRir, setFirstRir] = useState(() => typeof window !== "undefined" && !window.localStorage.getItem("fitcoach.rir.seen"));

  // il timer sopravvive al reload (IndexedDB)
  useEffect(() => {
    if (!sessionId) return;
    draftStore.loadTimer(sessionId).then((t) => {
      if (t && t.end_at > Date.now()) setTimer({ ...t, rir_target: 2, rir: null, first_time: false });
    });
  }, [sessionId]);

  const s = d.session;

  const onCheck = useCallback(
    (setId: string, weight: number | null, reps: number | null) => {
      const ex = s?.exercises.find((e) => e.sets.some((x) => x.id === setId));
      if (!ex || !sessionId) return;
      const set = ex.sets.find((x) => x.id === setId)!;
      const rir = set.logged?.rir ?? ex.prescription.rir_target.value;
      void d.dispatch({ op: "patch_set", set_id: setId, weight_kg: weight, reps, rir, status: "done" });
      const rest = ex.prescription.rest_s.value;
      const t = newTimer(setId, rest, ex.prescription.rir_target.value, firstRir);
      setTimer(t);
      void draftStore.saveTimer({ session_id: sessionId, end_at: t.end_at, total_s: t.total_s, rest_s: t.rest_s, set_id: setId, started_at: t.started_at });
      announce(`Serie ${set.n} fatta. Riposo: ${rest} secondi.`);
      if (firstRir) {
        window.localStorage.setItem("fitcoach.rir.seen", "1");
        setFirstRir(false);
      }
    },
    [s, sessionId, d, firstRir],
  );

  const closeTimer = useCallback(() => {
    setTimer(null);
    if (sessionId) void draftStore.clearTimer(sessionId);
  }, [sessionId]);

  const todo = useMemo(() => (s ? countTodo(s) : 0), [s]);

  async function doClose(force = false) {
    if (closing || closeInFlight.current) return;
    closeInFlight.current = true;
    setClosing(true);
    setCloseError(null);
    try {
      const r = await d.close({ force });
      if (r.kind === "conflict") {
        setConflictServer(r.server);
        return;
      }
      if (r.kind === "closed") {
        // già chiusa (altro dispositivo, o doppio invio): la pagina passa da sola in sola lettura
        closeTimer();
        return;
      }
      closeTimer();
      if (r.kind === "offline") {
        // QA N1: senza rete non si naviga (la navigazione RSC fallisce e ricarica la seduta aperta). La pagina passa in
        // sola lettura sul posto: la chiusura è in coda e parte da qualunque schermata appena torna la rete.
        announce("Seduta chiusa sul telefono. La mando al coach appena torna la rete.");
        window.setTimeout(() => document.getElementById("chiusa-h")?.focus(), 0);
        return;
      }
      window.sessionStorage.setItem(CLOSE_KEY, JSON.stringify({ close_line: r.out.close_line, notes: r.out.notes, offline: false }));
      router.replace("/oggi/chiusa");
    } catch (e) {
      setCloseError(isApiError(e) ? e.detail : "Errore. Riprova.");
    } finally {
      closeInFlight.current = false;
      setClosing(false);
      setCloseAsk(false);
    }
  }

  // seduta chiusa: il timer non ha più senso (quello salvato lo cancella markClosed insieme alla bozza)
  const timerShown = d.closed ? null : timer;

  if ((todayLoading && !sessionId) || (sessionId && d.loading)) {
    return (
      <div data-scale="palestra" className="session-col">
        <Skeleton lines={3} label="Apro la seduta…" />
      </div>
    );
  }
  if (todayError && !sessionId && !todayLoading) return <ErrorBox error={todayError} onRetry={() => reloadToday()} title="Non riesco a caricare oggi." supportEmail={me?.support_email} />;
  if (!sessionId) {
    return (
      <div className="empty">
        <h1 className="t-titolo">Oggi non c&apos;è una seduta.</h1>
        <Link href="/oggi" className="btn btn-secondary">
          Torna a Oggi
        </Link>
      </div>
    );
  }
  if (d.loadError && !s) {
    return (
      <div data-scale="palestra" className="session-col stack">
        <ErrorBox error={d.loadError} onRetry={() => router.refresh()} title="Non riesco ad aprire la seduta." supportEmail={me?.support_email} />
        <p className="t-voce">Senza rete la seduta si apre solo se l&apos;avevi già aperta su questo telefono.</p>
      </div>
    );
  }
  if (!s) return null;

  if (d.closed) {
    // QA G2: chiusa = sola lettura. Niente input attivi, niente "Chiudi seduta", nessun dispatch.
    // QA N1: chiusa senza rete = stessa vista, con la coda pendente detta a parole; il server la conferma da solo.
    const closePayload = JSON.stringify({ close_line: s.close_line ?? null, notes: s.notes, offline: false });
    const pending = d.closedOffline;
    const done = countDone(s);
    return (
      <div data-scale="palestra" className="session-col">
        <header className="session-head">
          <div>
            <h1 className="t-corpo-strong">{s.name}</h1>
            <p className="t-etichetta muted">
              Settimana {s.week} · seduta {s.index_in_week + 1} di {s.sessions_in_week}
              {s.short_version ? " · versione corta" : ""}
            </p>
            <p className="t-etichetta" data-status={pending ? "closed-offline" : "closed"}>
              {pending ? "Chiusa sul telefono · la mando appena torna la rete" : (STATUS_LINE[s.status] ?? "Seduta chiusa")}
            </p>
          </div>
        </header>
        <section className="session-closed stack" aria-labelledby="chiusa-h">
          <h2 id="chiusa-h" className="t-titolo" tabIndex={-1}>
            Questa seduta è chiusa.
          </h2>
          {pending ? (
            <p className="t-voce" role="status">
              Senza rete. In coda sul telefono: la chiusura e {done === 1 ? "la serie fatta" : `le ${done} serie fatte`}. Partono da sole appena torna la rete, da qualunque schermata; poi il coach la commenta in chat.
            </p>
          ) : (
            <p className="t-voce">{s.close_line ? <NotedText text={s.close_line} notes={s.notes} scope="close" numbers /> : "Il log qui sotto è quello registrato. Il coach la commenta in chat."}</p>
          )}
          <div className="pair">
            {pending ? null : (
              <Link href="/oggi/chiusa" className="btn btn-secondary" onClick={() => window.sessionStorage.setItem(CLOSE_KEY, closePayload)}>
                Vedi la chiusura
              </Link>
            )}
            <Link href="/oggi" className="btn btn-secondary">
              Torna a Oggi
            </Link>
          </div>
        </section>
        {s.exercises.map((ex) => (
          <ExerciseBlock
            key={ex.id}
            exercise={ex}
            notes={s.notes}
            firstRir={false}
            rowErrors={d.rowErrors}
            readOnly
            onCheck={() => {}}
            onUncheck={() => {}}
            onRestoreSet={() => {}}
            onAddSet={() => {}}
            onRemoveLastSet={() => {}}
            onSkip={() => {}}
            onRestore={() => {}}
            onSubstitute={() => Promise.resolve()}
            onRetryRow={() => {}}
          />
        ))}
        <Apparatus notes={s.notes} scope="session" />
      </div>
    );
  }

  return (
    <div data-scale="palestra" className="session-col">
      <header className="session-head">
        <div>
          <h1 className="t-corpo-strong">{s.name}</h1>
          <p className="t-etichetta muted">
            Settimana {s.week} · seduta {s.index_in_week + 1} di {s.sessions_in_week}
            {s.short_version ? " · versione corta" : ""}
          </p>
          <p className="t-etichetta muted" aria-live="off" data-status={d.status}>
            {statusText(d.status, d.resumed)}
          </p>
        </div>
        <Button variant="tertiary" onClick={() => (todo > 0 ? setCloseAsk(true) : void doClose())} loading={closing} loadingText="Chiudo…">
          Chiudi seduta
        </Button>
      </header>

      {timerShown ? (
        <RestTimer
          key={`${timerShown.set_id}-${timerShown.end_at}`}
          timer={timerShown}
          onChange={(t) => {
            setTimer(t);
            void draftStore.saveTimer({ session_id: sessionId, end_at: t.end_at, total_s: t.total_s, rest_s: t.rest_s, set_id: t.set_id, started_at: t.started_at });
          }}
          onClose={closeTimer}
          onRir={(rir) => {
            setTimer((t) => (t ? { ...t, rir } : t));
            void d.dispatch({ op: "patch_set", set_id: timerShown.set_id, rir });
          }}
        />
      ) : null}

      {closeError || d.closeFailure ? (
        <p className="t-corpo" role="alert" style={{ marginBottom: "var(--space-4)" }}>
          Errore: {closeError ?? d.closeFailure}
        </p>
      ) : null}

      {s.exercises.map((ex) => (
        <ExerciseBlock
          key={ex.id}
          exercise={ex}
          notes={s.notes}
          firstRir={firstRir}
          rowErrors={d.rowErrors}
          onCheck={onCheck}
          onUncheck={(setId) => void d.dispatch({ op: "patch_set", set_id: setId, status: "todo" })}
          onRestoreSet={(setId) => void d.dispatch({ op: "patch_set", set_id: setId, status: "todo" })}
          onAddSet={() => void d.dispatch({ op: "add_set", exercise_id: ex.id })}
          onRemoveLastSet={() => {
            const last = ex.sets[ex.sets.length - 1];
            if (last) void d.dispatch({ op: "delete_set", set_id: last.id, exercise_id: ex.id });
          }}
          onSkip={() => void d.dispatch({ op: "skip", exercise_id: ex.id })}
          onRestore={() => (ex.removed_today ? void d.restoreRemoved(ex.exercise_id) : void d.dispatch({ op: "restore", exercise_id: ex.id }))}
          onSubstitute={(slug) => d.substitute(ex.id, slug)}
          onRetryRow={() => void d.flush()}
        />
      ))}

      <Apparatus notes={s.notes} scope="session" />

      <ConfirmDialog
        open={closeAsk}
        title="Chiudo la seduta?"
        confirmLabel="Chiudi comunque"
        loading={closing}
        loadingText="Chiudo…"
        onConfirm={() => void doClose()}
        onCancel={() => setCloseAsk(false)}
      >
        Ci sono {todo} serie non fatte. Le segno come saltate e chiudo?
      </ConfirmDialog>

      <ConfirmDialog
        open={d.conflict !== null || conflictServer !== null}
        title="Ho trovato una seduta più recente sul server."
        confirmLabel="Quella sul telefono"
        loading={closing}
        loadingText="Chiudo…"
        onConfirm={() => {
          if (conflictServer) {
            setConflictServer(null);
            void doClose(true);
          } else {
            void d.keepLocal();
          }
        }}
        onCancel={() => {
          if (conflictServer) {
            const srv = conflictServer;
            setConflictServer(null);
            void d.adoptServer(srv);
          } else {
            void d.keepServer();
          }
        }}
      >
        Quale tengo? &quot;Annulla&quot; tiene quella sul server.
      </ConfirmDialog>
    </div>
  );
}
