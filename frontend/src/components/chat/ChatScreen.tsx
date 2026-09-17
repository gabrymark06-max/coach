"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useChatMessages, useChatQuota, useMe } from "@/lib/hooks/useApi";
import { api } from "@/lib/api/endpoints";
import { ApiError, errorMeta, isApiError, newOpId } from "@/lib/api/client";
import { errorText } from "@/lib/api/errorText";
import { parseSse } from "@/lib/sse/parse";
import { announce } from "@/lib/announce";
import type { ChatMessage, OptionItem, ParagraphBlock, SseEvent } from "@/lib/api/types";
import { PageHead } from "@/components/nav/AppShell";
import { AiBadge } from "./AiBadge";
import { CoachMessage, UserMessage } from "./CoachMessage";
import { Composer } from "./Composer";
import { ProCard } from "@/components/paywall/ProCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Button } from "@/components/ui/Button";

type Pending = { client_op_id: string; text: string; status: "sending" | "failed" | "llm_failed" };
type Streaming = { message: ChatMessage } | null;

/** La chat come pagina (§2.4): badge AI, thread, composer con quota, card Pro a 15/15, streaming SSE. */
export function ChatScreen({ embedded }: { embedded?: boolean }) {
  const params = useSearchParams();
  const focusMsg = params.get("msg");
  const { mutate: globalMutate } = useSWRConfig();
  const { data: me } = useMe();
  const { data: messages, error, isLoading, mutate } = useChatMessages();
  const { data: quota, mutate: reloadQuota } = useChatQuota();
  const [pending, setPending] = useState<Pending | null>(null);
  const [streaming, setStreaming] = useState<Streaming>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const msgMissing = useMemo(() => Boolean(focusMsg && messages && !messages.some((m) => m.id === focusMsg)), [focusMsg, messages]);
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastBand = useRef<string | null>(null);

  // deep link ?msg=
  useEffect(() => {
    if (!focusMsg || !messages) return;
    const el = document.getElementById(`msg-${focusMsg}`);
    if (el) {
      el.scrollIntoView({ block: "start" });
      el.setAttribute("tabindex", "-1");
      el.focus();
    }
  }, [focusMsg, messages]);

  useEffect(() => {
    if (!focusMsg) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, pending, streaming?.message.blocks.length, focusMsg]);

  // annuncio quota solo al cambio di fascia (§5.5)
  useEffect(() => {
    if (!quota || !me) return;
    const left = quota.limit - quota.used;
    const band = quota.exhausted ? "exhausted" : left <= 3 ? "low" : "ok";
    if (lastBand.current && lastBand.current !== band && me.entitlement.plan === "free") {
      announce(band === "exhausted" ? "Messaggi del mese finiti." : `Ti restano ${left} messaggi questo mese.`);
    }
    lastBand.current = band;
  }, [quota, me]);

  const send = useCallback(
    async (text: string, opId?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const client_op_id = opId ?? newOpId();
      setPending({ client_op_id, text, status: "sending" });
      setSendError(null);
      try {
        const res = await api.chat.send(text, client_op_id);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
          throw new ApiError(res.status, body, errorMeta(res));
        }
        if (!res.body) throw new ApiError(0, null);
        let draft: ChatMessage = { id: `streaming-${client_op_id}`, role: "coach", kind: "user_turn", at: new Date().toISOString(), status: "sent", blocks: [{ type: "paragraph", text: "" }], notes: [] };
        setStreaming({ message: draft });
        for await (const ev of parseSse<SseEvent>(res.body)) {
          if (ev.type === "delta") {
            const first = draft.blocks[0] as ParagraphBlock;
            draft = { ...draft, blocks: [{ type: "paragraph", text: first.text + ev.text }, ...draft.blocks.slice(1)] };
            setStreaming({ message: draft });
          } else if (ev.type === "block") {
            draft = { ...draft, blocks: [...draft.blocks, ev.block] };
            setStreaming({ message: draft });
          } else if (ev.type === "done") {
            setStreaming(null);
            setPending(null);
            await mutate();
            await reloadQuota();
            announce("Il coach ha risposto");
          }
        }
        setStreaming(null);
        setPending(null);
      } catch (e) {
        setStreaming(null);
        if (isApiError(e) && e.code === "chat_quota_exceeded") {
          setPending(null);
          await reloadQuota();
        } else if (isApiError(e) && e.status === 502) {
          setPending({ client_op_id, text, status: "llm_failed" });
        } else if (isApiError(e) && e.status === 0) {
          setPending({ client_op_id, text, status: "failed" });
          setSendError("Senza rete. Il messaggio parte appena torna.");
        } else {
          // QA N4: stessa frase dell'ErrorBox, request_id compreso sul 5xx
          setPending({ client_op_id, text, status: "failed" });
          setSendError(errorText(e, me?.support_email));
        }
      } finally {
        inFlight.current = false;
      }
    },
    [mutate, reloadQuota, me?.support_email],
  );

  const onOption = useCallback(
    async (o: OptionItem, m: ChatMessage) => {
      try {
        const reply = await api.chat.option(o.id, m.id);
        await mutate();
        await Promise.all([globalMutate("/today"), globalMutate("/plans/current")]);
        window.setTimeout(() => document.getElementById(`msg-${reply.id}`)?.scrollIntoView({ block: "start" }), 50);
      } catch (e) {
        setSendError(errorText(e, me?.support_email));
      }
    },
    [mutate, globalMutate, me?.support_email],
  );

  const onProposal = useCallback(
    async (id: string, action: "apply" | "reject") => {
      try {
        if (action === "apply") await api.plans.apply(id);
        else await api.plans.reject(id);
        await mutate();
        await globalMutate("/plans/current");
      } catch (e) {
        setSendError(errorText(e, me?.support_email));
      }
    },
    [mutate, globalMutate, me?.support_email],
  );

  const plan = me?.entitlement.plan ?? "free";
  const exhausted = Boolean(quota?.exhausted);
  // v1.1.2 §17.1: dopo un 502 il messaggio resta nel thread con status "failed" e non ha consumato quota.
  // Se la pagina è stata ricaricata il client_op_id non c'è più: si rimanda il testo come turno nuovo.
  const last = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const lastFailed = !pending && !streaming && last && last.role === "user" && last.status === "failed" ? last : null;
  const lastFailedText = lastFailed ? lastFailed.blocks.map((b) => (b.type === "paragraph" ? (b as { text: string }).text : "")).join("\n") : "";

  return (
    <div className="chat">
      {!embedded ? <PageHead title="Coach" /> : null}
      <AiBadge />
      <div className="thread" aria-busy={isLoading || undefined}>
        {isLoading ? <Skeleton lines={3} label="Carico la conversazione…" /> : null}
        {error ? <ErrorBox error={error} onRetry={() => mutate()} title="Non riesco a caricare la conversazione." supportEmail={me?.support_email} /> : null}
        {msgMissing ? <p className="t-nota muted">Quel messaggio non c&apos;è più. Ecco la conversazione.</p> : null}
        {messages && messages.length === 0 ? (
          <div className="empty" style={{ paddingTop: 0 }}>
            <h2 className="t-titolo">Il coach non ha ancora commentato.</h2>
            <p className="t-voce">Il primo messaggio arriva con la scheda. Se non c&apos;è, chiediglielo.</p>
            <Button variant="secondary" onClick={() => send("Commenta la mia scheda")}>
              Chiedi il commento
            </Button>
          </div>
        ) : null}
        {messages?.map((m) => (m.role === "coach" ? <CoachMessage key={m.id} message={m} onOption={onOption} onProposal={onProposal} /> : <UserMessage key={m.id} message={m} />))}
        {lastFailed ? (
          <p className="t-corpo">
            Il coach non ha risposto: il messaggio non conta nella quota.{" "}
            <button type="button" className="btn btn-tertiary" onClick={() => send(lastFailedText)}>
              Riprova
            </button>
          </p>
        ) : null}
        {pending ? (
          <>
            <UserMessage message={{ id: `pending-${pending.client_op_id}`, role: "user", kind: "user_turn", at: new Date().toISOString(), status: "sent", blocks: [{ type: "paragraph", text: pending.text }], notes: [] }} status={pending.status === "sending" ? "sending" : "failed"} />
            {pending.status === "llm_failed" ? (
              <CoachMessage message={{ id: `failed-${pending.client_op_id}`, role: "coach", kind: "user_turn", at: new Date().toISOString(), status: "failed", blocks: [], notes: [] }} failed onRetry={() => send(pending.text, pending.client_op_id)} />
            ) : null}
            {pending.status === "failed" ? (
              <p className="t-corpo">
                non inviato ·{" "}
                <button type="button" className="btn btn-tertiary" onClick={() => send(pending.text, pending.client_op_id)}>
                  Riprova
                </button>
              </p>
            ) : null}
          </>
        ) : null}
        {streaming ? <CoachMessage message={streaming.message} streaming /> : null}
        <div ref={endRef} />
      </div>
      {exhausted && plan === "free" ? (
        <ProCard surface="chat_quota" titleId="quota-h" resetsAt={quota?.resets_at} />
      ) : (
        <Composer key={pending?.status === "failed" ? pending.client_op_id : "new"} onSend={(t) => send(t)} sending={pending?.status === "sending" || streaming !== null} quota={quota} plan={plan} error={sendError} keepText={pending?.status === "failed" ? pending.text : undefined} />
      )}
    </div>
  );
}
