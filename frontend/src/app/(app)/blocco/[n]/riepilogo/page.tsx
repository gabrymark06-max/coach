"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMe, useSummary } from "@/lib/hooks/useApi";
import { api } from "@/lib/api/endpoints";
import { PageHead } from "@/components/nav/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { NotedText } from "@/components/note/NotedText";
import { Apparatus } from "@/components/note/Apparatus";
import { ProCard } from "@/components/paywall/ProCard";
import { formatKg } from "@/lib/format";
import type { Highlight } from "@/lib/api/types";

function highlightText(h: Highlight): { text: string; label: string } {
  if (h.kind === "count") return { text: `${h.from ?? 0} su ${h.to ?? 0}`, label: `${h.from ?? 0} ${h.label_it} su ${h.to ?? 0}` };
  const f = h.kind === "weight" ? formatKg(h.from) : String(h.from ?? "—");
  const t = h.kind === "weight" ? formatKg(h.to) : String(h.to ?? "—");
  return { text: `${f} → ${t}`, label: `${h.label_it}: da ${f} a ${t}${h.unit ? ` ${h.unit}` : ""}` };
}

/** Riepilogo di fine blocco (§2.11): tre numeri, il paragrafo con note, card Pro superficie 1. */
export default function RiepilogoPage() {
  const { n } = useParams<{ n: string }>();
  const idx = Number(n);
  const { data: me } = useMe();
  const { data, error, isLoading, mutate } = useSummary(Number.isInteger(idx) ? idx : null);
  const sent = useRef(false);
  useEffect(() => {
    if (data && !data.is_pro && !sent.current) {
      sent.current = true;
      void api.events({ name: "paywall_shown", props: { surface: "end_of_block", source: "ui" } }).catch(() => {});
    }
  }, [data]);

  return (
    <>
      <PageHead title={`Blocco ${idx}`} sub={data ? `Blocco ${data.block_index} · ${data.sessions_planned} sedute` : undefined} />
      <div className="stack-8" style={{ maxWidth: "var(--measure-voice)" }}>
        {isLoading ? <Skeleton lines={3} label="Preparo il riepilogo del blocco…" /> : null}
        {error ? <ErrorBox error={error} onRetry={() => mutate()} title="Il riepilogo non è pronto." supportEmail={me?.support_email} /> : null}
        {data ? (
          <>
            <h2 className="t-titolo">Blocco {data.block_index}, chiuso.</h2>
            <div className="highlights">
              {data.highlights.slice(0, 3).map((h, i) => {
                const { text, label } = highlightText(h);
                return (
                  <div key={i}>
                    <p className="t-numero" aria-label={label}>
                      {text}
                    </p>
                    <p className="t-etichetta muted">{h.label_it}</p>
                  </div>
                );
              })}
            </div>
            <p className="t-voce">
              <NotedText text={data.coach_paragraph} notes={data.notes} scope="summary" numbers />
            </p>
            <ProCard surface="end_of_block" titleId="pro-h" isPro={data.is_pro}>
              <h2 id="pro-h" className="t-corpo-strong">
                Il blocco {data.block_index + 1}
              </h2>
              <p className="t-voce">{data.next_block_preview_it}</p>
            </ProCard>
            <Apparatus notes={data.notes} scope="summary" />
          </>
        ) : null}
      </div>
    </>
  );
}
