"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useToday, isNoPlan } from "@/lib/hooks/useApi";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import type { ReadinessOut, SessionPreview } from "@/lib/api/types";
import { formatDayLabel } from "@/lib/format";
import { AdaptedSummary } from "@/components/session/AdaptedSession";
import { PageHead } from "@/components/nav/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { EmptyState } from "@/components/today/EmptyState";
import { Button } from "@/components/ui/Button";
import { writeTodayHint } from "@/lib/draft/todayHint";

/** Hub Oggi (§3.1): la seduta di oggi, uno stato vuoto, o redirect a /chat se la seduta è saltata. Mai un paywall qui. */
export default function OggiPage() {
  const { data, error, isLoading, mutate } = useToday();
  const router = useRouter();

  useEffect(() => {
    if (data?.kind === "session_skipped" && data.redirect) router.replace(data.redirect);
  }, [data, router]);

  if (isLoading) {
    return (
      <>
        <PageHead title="Oggi" />
        <div className="empty">
          <Skeleton lines={3} label="Carico la scheda…" />
        </div>
      </>
    );
  }
  if (error) {
    if (isNoPlan(error)) {
      return (
        <>
          <PageHead title="Oggi" />
          <div className="empty">
            <h2 className="t-titolo">Il piano non c&apos;è ancora.</h2>
            <p className="t-voce">Cinque domande e una per sicurezza: due minuti.</p>
            <Link href="/onboarding/1" className="btn btn-primary">
              Vai all&apos;onboarding
            </Link>
          </div>
        </>
      );
    }
    return (
      <>
        <PageHead title="Oggi" />
        <div className="empty">
          <ErrorBox error={error} onRetry={() => mutate()} title="Non riesco a caricare oggi." />
          <p className="t-voce">Riprova tra poco. La seduta, se c&apos;era, è salvata sul telefono.</p>
        </div>
      </>
    );
  }
  if (!data) return null;

  if (data.kind === "session_skipped") {
    return (
      <>
        <PageHead title="Oggi" />
        <p className="t-corpo" aria-busy="true">
          Il coach ti ha scritto: apro la conversazione…
        </p>
        {data.redirect ? (
          <Link href={data.redirect} className="btn btn-tertiary">
            Vai alla chat
          </Link>
        ) : null}
      </>
    );
  }

  if (data.kind !== "session" || !data.session_preview) {
    if (data.empty_state) {
      return (
        <>
          <PageHead title="Oggi" />
          <EmptyState state={data.empty_state} date={data.date} />
        </>
      );
    }
    return (
      <>
        <PageHead title="Oggi" />
        <div className="empty">
          <h2 className="t-titolo">Oggi non c&apos;è una seduta in programma.</h2>
          <Link href="/settimana" className="btn btn-secondary">
            Vedi la settimana
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Oggi" sub={<time dateTime={data.date}>{formatDayLabel(data.date)}</time>} />
      <PreviewCard preview={data.session_preview} readinessRequired={data.readiness_required} date={data.date} />
    </>
  );
}

/** Anteprima della seduta (§3.3 passo 1): nome, N esercizi, durata, "Inizia" e, se il backend lo permette, la versione corta. */
function PreviewCard({ preview: p, readinessRequired, date }: { preview: SessionPreview; readinessRequired: boolean; date: string }) {
  const { mutate, cache } = useSWRConfig();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [short, setShort] = useState<ReadinessOut | null>(null);
  const [shortError, setShortError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const done = p.status !== "planned";

  // QA M1: chi vede l'anteprima sta per aprire la seduta. L'id resta in memoria per il giorno e, se la readiness non
  // c'è di mezzo (è lei a scrivere la seduta adattata in cache), la seduta si scalda in cache SWR: /oggi/seduta non rifà la GET.
  useEffect(() => {
    writeTodayHint(p.session_id, date);
    if (done || readinessRequired) return;
    const key = `/sessions/${p.session_id}`;
    if (cache.get(key)?.data) return;
    mutate(key, api.sessions.get(p.session_id), { revalidate: false }).catch(() => {});
  }, [p.session_id, date, done, readinessRequired, cache, mutate]);

  async function makeShort() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setShortError(null);
    // QA produzione D3: quando si esce verso la seduta la guardia resta chiusa fino allo smontaggio.
    let leaving = false;
    try {
      const out = await api.sessions.short(p.session_id);
      await mutate(`/sessions/${p.session_id}`, out.session, { revalidate: false });
      await mutate("/today");
      setShort(out);
    } catch (err) {
      if (isApiError(err) && (err.code === "already_short" || err.code === "session_closed")) {
        leaving = true;
        router.push("/oggi/seduta");
        return;
      }
      setShortError(isApiError(err) ? err.detail : "Errore. Riprova.");
    } finally {
      if (!leaving) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <section aria-labelledby="seduta-h" className="stack-6" style={{ maxWidth: "var(--measure-voice)" }}>
      <div className="stack-2">
        <h2 id="seduta-h" className="t-titolo">
          {p.name}
        </h2>
        <p className="t-corpo muted">
          {p.exercises_count} esercizi · circa <span className="tnum">{p.est_minutes}</span> minuti
        </p>
      </div>
      {done ? (
        <div className="stack">
          <p className="t-voce">
            {p.status === "done" ? "Seduta fatta." : p.status === "short" ? "Seduta fatta, versione corta." : "Seduta segnata come saltata."} Il coach la commenta in chat.
          </p>
          <div className="pair">
            <Link href="/chat" className="btn btn-secondary">
              Parla col coach
            </Link>
            <Link href="/settimana" className="btn btn-secondary">
              Vedi la settimana
            </Link>
          </div>
        </div>
      ) : short ? (
        // la riga del coach della corta dice già la durata (contratto §6): non la ripetiamo nell'elenco
        <AdaptedSummary result={short} scope="corta" duration={false}>
          <div className="stack">
            <Button href="/oggi/seduta" variant="primary" block>
              Vai alla seduta
            </Button>
            {readinessRequired ? (
              <Link href="/oggi/readiness" className="btn btn-tertiary">
                Prima dimmi come stai
              </Link>
            ) : null}
          </div>
        </AdaptedSummary>
      ) : (
        <div className="stack">
          {shortError ? (
            <p className="t-corpo" role="alert">
              Errore: {shortError}
            </p>
          ) : null}
          <Button href={readinessRequired ? "/oggi/readiness" : "/oggi/seduta"} variant="primary" block>
            Inizia
          </Button>
          {p.short_available ? (
            <Button variant="tertiary" loading={busy} loadingText="Accorcio la seduta…" onClick={makeShort}>
              Versione corta (25′)
            </Button>
          ) : null}
          {!readinessRequired ? (
            <Link href="/oggi/seduta" className="btn btn-tertiary">
              Riprendi la seduta
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
