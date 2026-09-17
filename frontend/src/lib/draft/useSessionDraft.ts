"use client";

// Stato della seduta in palestra: bozza in IndexedDB prima della rete, coda idempotente, sync al ritorno online.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api/endpoints";
import { ApiError, isApiError, newOpId, nowIso } from "@/lib/api/client";
import type { CloseOut, Session, SessionExercise, SyncOp } from "@/lib/api/types";
import { applyOp, buildCloseSets, draftStore, type QueuedOp } from "./store";
import { announce } from "@/lib/announce";
import { isClosedError, sendableOps, syncSession } from "./drain";

export type NetStatus = "saved" | "saving" | "offline" | "syncing" | "error";

const STATUS_TEXT: Record<NetStatus, string> = {
  saved: "Salvato",
  saving: "Salvo…",
  offline: "Senza rete · salvo sul telefono",
  syncing: "Rete tornata · sincronizzo…",
  error: "Errore di sincronizzazione · riprovo",
};

export function statusText(s: NetStatus, resumed: boolean): string {
  return resumed && s === "saved" ? "Bozza ripresa · salvato" : STATUS_TEXT[s];
}

type Conflict = { server: Session; draft: Session } | null;

const SEVEN_DAYS = 7 * 24 * 3600 * 1000;

export function useSessionDraft(sessionId: string | null) {
  const { mutate, cache } = useSWRConfig();
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<NetStatus>("saved");
  const [resumed, setResumed] = useState(false);
  const [conflict, setConflict] = useState<Conflict>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [closedFlag, setClosedFlag] = useState(false);
  // QA N1: chiusa senza rete. La chiusura è in coda sul telefono; la pagina passa in sola lettura sul posto, senza
  // navigare (offline la navigazione RSC fallisce e ricarica la seduta aperta). Torna false quando il server la conferma.
  const [closedOffline, setClosedOffline] = useState(false);
  /** La chiusura accodata è stata rifiutata dal server (la seduta è ancora aperta): la pagina torna aperta e lo dice. */
  const [closeFailure, setCloseFailure] = useState<string | null>(null);
  const serverRef = useRef<Session | null>(null); // ultima verità del server
  const localRef = useRef<Session | null>(null);
  const flushing = useRef(false);
  const wasOffline = useRef(false);
  const closedRef = useRef(false);

  // QA G2 / contratto v1.1.2 §17.3: la seduta chiusa è di sola lettura. La coda locale si svuota (il server non la
  // accetterebbe più) e si mostra la versione del server, che ha già la progressione calcolata.
  const markClosed = useCallback(
    async (server?: Session | null) => {
      closedRef.current = true;
      setClosedFlag(true);
      setClosedOffline(false);
      setConflict(null);
      let s = server ?? null;
      if (!s && sessionId) {
        try {
          s = await api.sessions.get(sessionId);
        } catch {
          s = null;
        }
      }
      if (s) {
        serverRef.current = s;
        localRef.current = s;
        setSession(s);
        void mutate(`/sessions/${s.id}`, s, { revalidate: false });
      }
      if (sessionId) {
        const ops = await draftStore.pendingOps(sessionId).catch(() => []);
        await draftStore.removeOps(ops.map((o) => o.client_op_id)).catch(() => {});
        await draftStore.remove(sessionId).catch(() => {});
      }
      setRowErrors({});
      setStatus("saved");
      void mutate("/today");
    },
    [sessionId, mutate],
  );

  const recompute = useCallback(async () => {
    // sessione mostrata = server + operazioni ancora in coda
    if (!sessionId || !serverRef.current) return;
    const ops = await draftStore.pendingOps(sessionId);
    let s = serverRef.current;
    for (const op of ops) s = applyOp(s, op);
    localRef.current = s;
    setSession(s);
  }, [sessionId]);

  // ---- sync della coda ----
  // L'invio vero sta in drain.ts (una richiesta in volo per seduta, condivisa col drain globale dell'AppShell):
  // qui si aggiornano lo stato mostrato e la bozza.
  const flush = useCallback(async (): Promise<boolean> => {
    if (!sessionId || flushing.current) return false;
    const ops = await draftStore.pendingOps(sessionId);
    if (sendableOps(ops).length === 0) {
      setStatus((s) => (s === "offline" ? "offline" : "saved"));
      return true;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return false;
    }
    flushing.current = true;
    setStatus((s) => (s === "offline" || s === "syncing" ? "syncing" : "saving"));
    try {
      const r = await syncSession(sessionId);
      flushing.current = false;
      if (r.kind === "closed") {
        // seduta chiusa altrove, o la chiusura in coda è arrivata: la coda non serve più
        await markClosed(r.session);
        return true;
      }
      if (r.kind === "offline") {
        setStatus("offline");
        if (!wasOffline.current) {
          wasOffline.current = true;
          announce("Senza rete: salvo sul telefono");
        }
        return false;
      }
      if (r.kind === "error") {
        // 5xx, 401, 422…: errore del server o della richiesta, non della rete (contratto v1.1.2 §17.2)
        setStatus("error");
        return false;
      }
      if (r.kind === "empty") {
        setStatus((s) => (s === "offline" ? "offline" : "saved"));
        return true;
      }
      const { out, sent } = r;
      serverRef.current = out.session;
      const failed = out.results.filter((x) => x.status === "error");
      const closeRejected = failed.find((f) => sent.find((o) => o.client_op_id === f.client_op_id)?.op === "close");
      if (closeRejected) {
        // la seduta sul server è ancora aperta: niente "chiusa" finta, si riapre e si chiede di riprovare
        closedRef.current = false;
        setClosedOffline(false);
        setCloseFailure(closeRejected.detail ?? "Il server non ha accettato la chiusura. Riprova.");
      }
      if (failed.length > 0) {
        const errs: Record<string, string> = {};
        for (const f of failed) {
          const op = sent.find((o) => o.client_op_id === f.client_op_id);
          if (op?.set_id) errs[op.set_id] = f.detail ?? "Il server ha rifiutato questa serie.";
        }
        setRowErrors((e) => ({ ...e, ...errs }));
      }
      await recompute();
      await draftStore.save({ session_id: sessionId, session: localRef.current ?? out.session, updated_at: localRef.current?.updated_at ?? out.session.updated_at, saved_at: Date.now() });
      setStatus("saved");
      if (wasOffline.current) {
        wasOffline.current = false;
        announce("Rete tornata: sincronizzo");
      }
      void mutate("/today");
      const remaining = await draftStore.pendingOps(sessionId);
      if (sendableOps(remaining).length > 0) {
        // operazioni arrivate durante la sync (o patch di serie appena rimappate): le manda il prossimo giro
        window.setTimeout(() => window.dispatchEvent(new Event("fitcoach:flush")), 0);
      }
      return true;
    } catch (e) {
      flushing.current = false;
      if (isClosedError(e)) {
        await markClosed();
        return true;
      }
      setStatus(isApiError(e) && e.status === 0 ? "offline" : "error");
      return false;
    }
  }, [sessionId, recompute, mutate, markClosed]);

  // ---- caricamento: bozza locale + server ----
  // QA M1: il server parte subito (o viene dalla cache SWR, scaldata da /oggi e dalla readiness) e la bozza,
  // se c'è, si mostra appena letta da IndexedDB: il server riconcilia dopo, senza tenere lo schermo vuoto.
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    closedRef.current = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setClosedFlag(false);
      void draftStore.purgeOlderThan(SEVEN_DAYS).catch(() => {});
      let err: unknown = null;
      const cached = cache.get(`/sessions/${sessionId}`)?.data as Session | undefined;
      const serverP: Promise<Session | null> = cached
        ? Promise.resolve(cached)
        : api.sessions.get(sessionId).catch((e: unknown) => {
            err = e;
            return null;
          });
      const draft = await draftStore.load(sessionId).catch(() => null);
      if (!alive) return;
      if (draft && !cached) {
        // prima pittura dalla bozza; il server, quando arriva, conferma o corregge
        setResumed(true);
        serverRef.current = draft.session;
        localRef.current = draft.session;
        setSession(draft.session);
        setLoading(false);
      }
      const server = await serverP;
      if (!alive) return;
      if (server && server.status !== "planned") {
        await markClosed(server);
        setLoading(false);
        return;
      }
      if (draft) {
        setResumed(true);
        const pending = await draftStore.pendingOps(sessionId);
        // chiusa senza rete e pagina riaperta prima che la rete tornasse: resta chiusa, in attesa
        if (pending.some((o) => o.op === "close")) {
          closedRef.current = true;
          setClosedOffline(true);
        }
        if (server && pending.length === 0 && server.updated_at > draft.updated_at) {
          // il server ha una versione più nuova (altro dispositivo) e qui non c'è nulla in sospeso
          serverRef.current = server;
          localRef.current = server;
          setSession(server);
        } else if (server && server.updated_at > draft.updated_at && pending.length > 0) {
          serverRef.current = server;
          setConflict({ server, draft: draft.session });
          localRef.current = draft.session;
          setSession(draft.session);
        } else {
          serverRef.current = server ?? draft.session;
          localRef.current = draft.session;
          setSession(draft.session);
          if (!server) setStatus("offline");
        }
      } else if (server) {
        serverRef.current = server;
        localRef.current = server;
        setSession(server);
        await draftStore.save({ session_id: sessionId, session: server, updated_at: server.updated_at, saved_at: Date.now() });
      } else {
        setLoadError(err);
      }
      setLoading(false);
      if (server) void flush();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const closed = closedFlag || closedOffline || (session !== null && session.status !== "planned");

  // ritorno della rete e ritorno in primo piano
  useEffect(() => {
    const onOnline = () => {
      setStatus("syncing");
      void flush();
    };
    const onOffline = () => {
      setStatus("offline");
      if (!wasOffline.current) {
        wasOffline.current = true;
        announce("Senza rete: salvo sul telefono");
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    const onFlush = () => void flush();
    window.addEventListener("fitcoach:flush", onFlush);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("fitcoach:flush", onFlush);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush]);

  // riprova periodica quando in errore
  useEffect(() => {
    if (status !== "error") return;
    const t = window.setTimeout(() => void flush(), 8000);
    return () => window.clearTimeout(t);
  }, [status, flush]);

  // ---- scrittura: bozza prima, rete dopo ----
  const dispatch = useCallback(
    async (op: Omit<SyncOp, "client_op_id" | "client_updated_at">) => {
      if (!sessionId || !localRef.current || closedRef.current) return;
      const full: QueuedOp = { ...op, client_op_id: newOpId(), client_updated_at: nowIso(), session_id: sessionId } as QueuedOp;
      const next = applyOp(localRef.current, full);
      localRef.current = next;
      setSession(next);
      try {
        await draftStore.enqueue(full);
        await draftStore.save({ session_id: sessionId, session: next, updated_at: full.client_updated_at, saved_at: Date.now() });
        if (full.set_id) setRowErrors((e) => (e[full.set_id!] ? { ...e, [full.set_id!]: "" } : e));
      } catch {
        if (full.set_id) setRowErrors((e) => ({ ...e, [full.set_id!]: "Errore: non sono riuscito a salvare questa serie sul telefono. Riprova." }));
        return;
      }
      void flush();
    },
    [sessionId, flush],
  );

  // sostituzione: solo online (serve la risposta del server con il nuovo esercizio)
  const substitute = useCallback(
    async (exId: string, newSlug: string) => {
      if (!sessionId) throw new ApiError(0, null);
      let out: SessionExercise;
      try {
        out = await api.sessions.substitute(sessionId, exId, { exercise_id: newSlug, client_op_id: newOpId(), client_updated_at: nowIso() });
      } catch (e) {
        if (isClosedError(e)) await markClosed();
        throw e;
      }
      const s = serverRef.current;
      if (s) {
        serverRef.current = { ...s, updated_at: nowIso(), exercises: s.exercises.map((e) => (e.id === exId ? out : e)) };
        await recompute();
        await draftStore.save({ session_id: sessionId, session: localRef.current!, updated_at: localRef.current!.updated_at, saved_at: Date.now() });
      }
    },
    [sessionId, recompute, markClosed],
  );

  const restoreRemoved = useCallback(
    async (slug: string) => {
      if (!sessionId) throw new ApiError(0, null);
      let s: Session;
      try {
        s = await api.sessions.restore(sessionId, slug);
      } catch (e) {
        if (isClosedError(e)) await markClosed();
        throw e;
      }
      serverRef.current = s;
      await recompute();
      await draftStore.save({ session_id: sessionId, session: localRef.current!, updated_at: localRef.current!.updated_at, saved_at: Date.now() });
    },
    [sessionId, recompute, markClosed],
  );

  const close = useCallback(
    async (opts?: { force?: boolean }): Promise<{ kind: "online"; out: CloseOut } | { kind: "offline" } | { kind: "conflict"; server: Session } | { kind: "closed" }> => {
      if (!sessionId || !localRef.current) throw new ApiError(0, null);
      setCloseFailure(null);
      const synced = await flush();
      if (closedRef.current) return { kind: "closed" };
      const local = localRef.current;
      const body = {
        client_op_id: newOpId(),
        client_updated_at: opts?.force ? nowIso() : local.updated_at,
        sets: buildCloseSets(local),
      };
      const queueClose = async () => {
        await draftStore.enqueue({ ...body, op: "close", session_id: sessionId });
        closedRef.current = true;
        setClosedOffline(true);
        setStatus("offline");
        void mutate("/today");
      };
      if (!synced && !navigator.onLine) {
        await queueClose();
        return { kind: "offline" };
      }
      try {
        const out = await api.sessions.close(sessionId, body);
        await draftStore.remove(sessionId);
        void mutate("/today");
        void mutate("/plans/current");
        void mutate("/chat/messages");
        return { kind: "online", out };
      } catch (e) {
        if (isApiError(e) && e.code === "draft_conflict") {
          return { kind: "conflict", server: e.extra.server_session as Session };
        }
        if (isClosedError(e)) {
          await markClosed();
          return { kind: "closed" };
        }
        if (isApiError(e) && e.status === 0) {
          await queueClose();
          return { kind: "offline" };
        }
        throw e;
      }
    },
    [sessionId, flush, mutate, markClosed],
  );

  const adoptServer = useCallback(
    async (server: Session) => {
      if (!sessionId) return;
      const ops = await draftStore.pendingOps(sessionId);
      await draftStore.removeOps(ops.map((o) => o.client_op_id));
      serverRef.current = server;
      localRef.current = server;
      setSession(server);
      await draftStore.save({ session_id: sessionId, session: server, updated_at: server.updated_at, saved_at: Date.now() });
      setConflict(null);
    },
    [sessionId],
  );

  const keepServer = useCallback(async () => {
    if (conflict) await adoptServer(conflict.server);
  }, [conflict, adoptServer]);

  const keepLocal = useCallback(async () => {
    setConflict(null);
    void flush();
  }, [flush]);

  return useMemo(
    () => ({ session, loading, loadError, status, resumed, conflict, rowErrors, closed, closedOffline, closeFailure, dispatch, flush, substitute, restoreRemoved, close, keepServer, keepLocal, adoptServer, markClosed }),
    [session, loading, loadError, status, resumed, conflict, rowErrors, closed, closedOffline, closeFailure, dispatch, flush, substitute, restoreRemoved, close, keepServer, keepLocal, adoptServer, markClosed],
  );
}
