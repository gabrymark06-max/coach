"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import type { EmptyState as EmptyStateT, TodayOption } from "@/lib/api/types";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import { formatDayLabel } from "@/lib/format";
import { NotedText } from "@/components/note/NotedText";
import { Apparatus } from "@/components/note/Apparatus";
import { Button } from "@/components/ui/Button";
import { ProPill } from "@/components/ui/Pill";

/** I cinque stati vuoti (§2.10) come un solo componente alimentato da GET /today. */
export function EmptyState({ state, date }: { state: EmptyStateT; date: string }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(o: TodayOption) {
    if (o.action.type === "route") {
      router.push(o.action.target);
      return;
    }
    // v1.1: l'opzione porta con sé il messaggio del coach (contratto §4); `redirect` non si legge più.
    const messageId = o.action.message_id;
    if (!messageId) {
      setError("Non trovo il messaggio del coach: apri la chat.");
      return;
    }
    if (busy) return;
    setBusy(o.id);
    setError(null);
    try {
      const reply = await api.chat.option(o.action.target, messageId);
      await Promise.all([mutate("/today"), mutate("/plans/current"), mutate("/chat/messages")]);
      router.push(`/chat?msg=${reply.id}`);
    } catch (e) {
      if (isApiError(e) && e.code === "option_already_chosen") {
        // scelta già fatta (altro dispositivo o /today in cache): si aggiorna Oggi e si va dove la scelta è già raccontata
        await mutate("/today");
        router.push("/chat");
        return;
      }
      setError(isApiError(e) ? e.detail : "Errore. Riprova.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="empty">
      <p className="t-etichetta muted">
        <time dateTime={date}>{formatDayLabel(date)}</time>
      </p>
      <h2 className="t-titolo">{state.title}</h2>
      <p className="t-voce">
        <NotedText text={state.coach_text} notes={state.notes} scope="empty" numbers />
      </p>
      {error ? (
        <p className="t-corpo" role="alert">
          Errore: {error}
        </p>
      ) : null}
      <div className="pair">
        {state.options.map((o) =>
          o.action.type === "route" ? (
            <Link key={o.id} href={o.action.target} className="btn btn-secondary">
              {o.label}
              {o.is_pro ? <ProPill /> : null}
            </Link>
          ) : (
            <Button key={o.id} variant="secondary" loading={busy === o.id} loadingText="Ricalcolo…" softDisabled={busy !== null && busy !== o.id} onClick={() => choose(o)}>
              {o.label}
            </Button>
          ),
        )}
      </div>
      <Apparatus notes={state.notes} scope="empty" />
    </div>
  );
}
