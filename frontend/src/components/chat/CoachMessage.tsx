"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChatBlock, ChatMessage, OptionItem, PlanChangeBlock } from "@/lib/api/types";
import { formatTime } from "@/lib/format";
import { NotedText } from "@/components/note/NotedText";
import { Apparatus } from "@/components/note/Apparatus";
import { NoteMark } from "@/components/note/NoteMark";
import { Button } from "@/components/ui/Button";
import { ProPill } from "@/components/ui/Pill";
import { pricingHref } from "@/components/paywall/ProCard";

export type CoachMessageProps = {
  message: ChatMessage;
  streaming?: boolean;
  onOption?: (option: OptionItem, message: ChatMessage) => Promise<void>;
  onProposal?: (proposalId: string, action: "apply" | "reject", message: ChatMessage) => Promise<void>;
  onRetry?: () => void;
  failed?: boolean;
};

/** Messaggio del coach (§2.4.2): paragrafi in Newsreader con filetto; blocchi options / plan_change / safety / paywall. */
export function CoachMessage({ message, streaming, onOption, onProposal, onRetry, failed }: CoachMessageProps) {
  const isSafety = message.kind === "safety" || message.blocks.some((b) => b.type === "safety");
  const time = streaming ? "sta scrivendo" : formatTime(message.at);
  const scope = `msg-${message.id}`;
  return (
    <article className="msg-coach" aria-label={`Coach, ${time}`} aria-busy={streaming || undefined} data-safety={isSafety || undefined} id={`msg-${message.id}`}>
      <p className="msg-label t-etichetta">Coach · {time}</p>
      {failed ? (
        <div className="stack-2">
          <p className="t-corpo">Il coach non ha risposto. Il tuo messaggio è salvato: puoi rimandarlo.</p>
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              Riprova
            </Button>
          ) : null}
        </div>
      ) : null}
      {message.blocks.map((b, i) => (
        <Block key={i} block={b} message={message} scope={scope} onOption={onOption} onProposal={onProposal} />
      ))}
      {!streaming && message.notes.length > 0 ? <Apparatus notes={message.notes} scope={scope} inline /> : null}
    </article>
  );
}

function Block({ block, message, scope, onOption, onProposal }: { block: ChatBlock; message: ChatMessage; scope: string } & Pick<CoachMessageProps, "onOption" | "onProposal">) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="t-voce">
          <NotedText text={(block as { text: string }).text} notes={message.notes} scope={scope} numbers />
        </p>
      );
    case "options":
      return <Options options={(block as { options: OptionItem[] }).options} message={message} onOption={onOption} />;
    case "plan_change":
      return <PlanChange block={block as PlanChangeBlock} message={message} scope={scope} onProposal={onProposal} />;
    case "safety": {
      const sb = block as { text: string; options: OptionItem[] };
      return (
        <div role="region" aria-label="Avviso di sicurezza" className="stack">
          <p className="t-voce">{sb.text}</p>
          <Options options={sb.options} message={message} onOption={onOption} />
          <Button variant="tertiary" onClick={() => onOption?.({ id: "acknowledge", label: "Ho capito", is_pro: false, chosen: false }, message)}>
            Ho capito
          </Button>
        </div>
      );
    }
    case "paywall": {
      const pb = block as { surface: "chat_quota" | "maintenance_request"; context_line: string };
      return (
        <div className="pro-card" style={{ marginTop: "var(--space-4)" }}>
          <p className="t-voce">{pb.context_line}</p>
          <Link href={pricingHref(pb.surface)} className="btn btn-secondary">
            Passa a Pro <ProPill />
          </Link>
        </div>
      );
    }
    default:
      return null;
  }
}

function Options({ options, message, onOption }: { options: OptionItem[]; message: ChatMessage; onOption?: CoachMessageProps["onOption"] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const chosen = options.find((o) => o.chosen);
  if (chosen) {
    return (
      <p className="t-corpo muted" style={{ marginTop: "var(--space-3)" }}>
        Hai scelto: <span style={{ color: "var(--ink)" }}>{chosen.label}</span>
      </p>
    );
  }
  return (
    <div className="msg-options">
      {options.map((o) =>
        o.is_pro ? (
          <Link key={o.id} href={pricingHref("maintenance_request")} className="btn btn-secondary">
            <span className="t-corpo-strong">
              {o.label} <ProPill />
            </span>
            {o.description ? <span className="t-nota">{o.description}</span> : null}
          </Link>
        ) : (
          <Button
            key={o.id}
            variant="secondary"
            loading={busyId === o.id}
            loadingText="Ricalcolo…"
            softDisabled={busyId !== null && busyId !== o.id}
            onClick={async () => {
              if (busyId || !onOption) return;
              setBusyId(o.id);
              try {
                await onOption(o, message);
              } finally {
                setBusyId(null);
              }
            }}
          >
            <span className="t-corpo-strong">{o.label}</span>
            {o.description ? <span className="t-nota">{o.description}</span> : null}
          </Button>
        ),
      )}
    </div>
  );
}

function PlanChange({ block, message, scope, onProposal }: { block: PlanChangeBlock; message: ChatMessage; scope: string; onProposal?: CoachMessageProps["onProposal"] }) {
  const [busy, setBusy] = useState<"apply" | "reject" | null>(null);
  const notes = message.notes;
  if (block.valid === false) {
    return <p className="t-corpo">{block.invalid_reason_it ?? "Questa modifica non passa le regole del motore."}</p>;
  }
  return (
    <div>
      <table className="plan-change t-corpo">
        <caption className="visually-hidden">Modifica proposta</caption>
        <thead>
          <tr className="t-etichetta muted">
            <th scope="col">Esercizio</th>
            <th scope="col">Da</th>
            <th scope="col">A</th>
          </tr>
        </thead>
        <tbody>
          {block.diff.map((d, i) => {
            const note = d.note_n != null ? notes.find((n) => n.n === d.note_n) : null;
            return (
              <tr key={i}>
                <th scope="row">
                  {d.exercise} <span className="muted">({d.field})</span>
                </th>
                <td className="tnum">{String(d.from ?? "—")}</td>
                <td className="tnum">
                  {String(d.to ?? "—")}
                  {note ? <NoteMark note={note} scope={scope} /> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {block.applied === true ? (
        <p className="t-etichetta muted" style={{ marginTop: "var(--space-2)" }}>
          Applicata
        </p>
      ) : block.applied === false && !onProposal ? (
        <p className="t-etichetta muted" style={{ marginTop: "var(--space-2)" }}>
          Non applicata
        </p>
      ) : block.applied === null || block.applied === false ? (
        <div className="pair" style={{ marginTop: "var(--space-3)" }}>
          <Button variant="secondary" loading={busy === "apply"} loadingText="Applico…" onClick={async () => { if (busy) return; setBusy("apply"); try { await onProposal?.(block.proposal_id, "apply", message); } finally { setBusy(null); } }}>
            Applica
          </Button>
          <Button variant="secondary" loading={busy === "reject"} loadingText="Lascio…" onClick={async () => { if (busy) return; setBusy("reject"); try { await onProposal?.(block.proposal_id, "reject", message); } finally { setBusy(null); } }}>
            Lascia com&apos;è
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function UserMessage({ message, status }: { message: ChatMessage; status?: "sending" | "failed" }) {
  const label = status === "sending" ? "invio…" : status === "failed" || message.status === "failed" ? "non inviato" : formatTime(message.at);
  const text = message.blocks.map((b) => (b.type === "paragraph" ? (b as { text: string }).text : "")).join("\n");
  return (
    <article className="msg-user" aria-label={`Tu, ${label}`} id={`msg-${message.id}`}>
      <p className="msg-label t-etichetta">Tu · {label}</p>
      <p className="t-corpo">{text}</p>
    </article>
  );
}
