"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMe, useChatTexts, useRule } from "@/lib/hooks/useApi";
import { useAuth } from "@/lib/auth/useAuth";
import { api } from "@/lib/api/endpoints";
import { isApiError, writeAuth } from "@/lib/api/client";
import { formatDate, formatEuro } from "@/lib/format";
import { PageHead } from "@/components/nav/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Button } from "@/components/ui/Button";
import { ProPill } from "@/components/ui/Pill";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NoteMark } from "@/components/note/NoteMark";
import { useToast } from "@/components/ui/Toast";
import { useIsDesktop, useMedia } from "@/lib/hooks/useMedia";

/** Account (§2.18): profilo, abbonamento con "Recedi dal contratto qui", dati, installazione, zona pericolosa. */
export default function AccountPage() {
  const router = useRouter();
  const { data: me, error, isLoading, mutate } = useMe();
  const { data: texts } = useChatTexts();
  const { data: withdrawNote } = useRule("system.withdrawal");
  const { logout } = useAuth();
  const toast = useToast();
  const desktop = useIsDesktop();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"withdraw" | "delete" | "revoke" | null>(null);
  const installed = useMedia("(display-mode: standalone)");
  const [now] = useState(() => Date.now());
  const installSent = useRef(false);

  useEffect(() => {
    const standalone = installed || (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone && !desktop && !installSent.current) {
      installSent.current = true;
      void api.events({ name: "install_prompt_shown", props: {} }).catch(() => {});
    }
    if (standalone && me && !me.pwa.installed_reported) {
      void api.events({ name: "installed", props: {} }).catch(() => {});
    }
  }, [desktop, me, installed]);

  async function run(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(isApiError(e) ? e.detail : "Errore. Riprova.");
    } finally {
      setBusy(null);
      setDialog(null);
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHead title="Account" />
        <Skeleton lines={3} />
      </>
    );
  }
  if (error || !me) {
    return (
      <>
        <PageHead title="Account" />
        <ErrorBox error={error} onRetry={() => mutate()} title="Non riesco a caricare l'account." />
      </>
    );
  }

  const pro = me.entitlement.plan === "pro";
  const sub = me.subscription;
  const withdrawOpen = me.withdrawal_eligible_until && new Date(me.withdrawal_eligible_until).getTime() > now;
  const openUrl = (url: string) => {
    window.location.assign(url);
  };

  return (
    <>
      <PageHead title="Account" />
      <div style={{ maxWidth: "var(--measure-ui)" }}>
        {err ? (
          <p className="form-alert t-corpo" role="alert">
            Errore: {err}
          </p>
        ) : null}
        {msg ? (
          <p className="t-corpo" role="status" style={{ padding: "var(--space-4) 0" }}>
            {msg}
          </p>
        ) : null}

        <section className="account-section" aria-labelledby="prof-h">
          <h2 id="prof-h" className="t-corpo-strong">
            Profilo
          </h2>
          <p className="t-corpo">{me.user.email}</p>
          {!me.user.email_verified ? (
            <p className="t-nota">
              Email non ancora verificata.{" "}
              <Button variant="tertiary" loading={busy === "resend"} loadingText="Mando il link…" onClick={() => run("resend", async () => { const r = await api.auth.verifyResend(); setMsg(r.detail); })}>
                Rimanda il link
              </Button>
            </p>
          ) : null}
          <p className="t-corpo">
            Piano attuale: {me.mesocycle ? `blocco ${me.mesocycle.index}, settimana ${me.mesocycle.week} di ${me.mesocycle.total_weeks}` : "nessuno"}.{" "}
            <Link href="/onboarding/1">Rifai l&apos;onboarding</Link>
          </p>
        </section>

        <section className="account-section" aria-labelledby="sub-h">
          <h2 id="sub-h" className="t-corpo-strong">
            Abbonamento
          </h2>
          {pro ? (
            <p className="t-corpo">
              Piano: <ProPill /> {sub ? `· si rinnova il ${sub.renews_at ? formatDate(sub.renews_at) : "—"} · ${sub.interval === "month" ? "mensile" : "annuale"}${sub.cancel_at_period_end ? " · disdetto a fine periodo" : ""}` : `· ${me.entitlement.source}`}
            </p>
          ) : (
            <p className="t-corpo">Piano: Base. Il primo blocco è completo e gratis.</p>
          )}
          <div className="row">
            {pro && sub ? (
              <>
                <Button variant="secondary" loading={busy === "portal"} loadingText="Apro il portale…" onClick={() => run("portal", async () => openUrl((await api.billing.portal({})).url))}>
                  Gestisci abbonamento
                </Button>
                <Button variant="tertiary" loading={busy === "cancel"} loadingText="Apro il portale…" onClick={() => run("cancel", async () => openUrl((await api.billing.portal({ intent: "cancel" })).url))}>
                  Disdici
                </Button>
              </>
            ) : (
              <Link href="/prezzi" className="btn btn-primary">
                Passa a Pro
              </Link>
            )}
          </div>
          {withdrawOpen ? (
            <div className="stack-2">
              <Button variant="danger" onClick={() => setDialog("withdraw")}>
                Recedi dal contratto qui
              </Button>
              <p className="t-nota muted">
                Possibile fino al {formatDate(me.withdrawal_eligible_until!)}
                {withdrawNote ? <NoteMark note={{ ...withdrawNote, n: 1 }} scope="account" /> : null}
              </p>
            </div>
          ) : null}
        </section>

        <section className="account-section" aria-labelledby="data-h">
          <h2 id="data-h" className="t-corpo-strong">
            Dati
          </h2>
          <Button
            variant="secondary"
            loading={busy === "export"}
            loadingText="Preparo il file…"
            onClick={() =>
              run("export", async () => {
                const out = await api.me.export();
                const res = await api.me.exportFile(out.download_url.split("/").pop() ?? "");
                if (!res.ok) throw new Error("export");
                const blob = await res.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "fitcoach-dati.json";
                a.click();
                URL.revokeObjectURL(a.href);
                toast("Dati esportati.");
              })
            }
          >
            Scarica i miei dati (JSON)
          </Button>
          <p className="t-corpo">
            Consenso su infortuni e dolori: {me.health_consent.given ? "attivo" : "non dato"}.{" "}
            {me.health_consent.given ? (
              <Button variant="tertiary" onClick={() => setDialog("revoke")}>
                Revoca
              </Button>
            ) : (
              <Button variant="tertiary" loading={busy === "consent"} loadingText="Salvo…" onClick={() => run("consent", async () => { const r = await api.onboarding.consent(true); setMsg(r.detail); await mutate(); })}>
                Dai il consenso
              </Button>
            )}
          </p>
        </section>

        {!installed && !desktop ? (
          <section className="account-section" aria-labelledby="inst-h">
            <h2 id="inst-h" className="t-corpo-strong">
              Aggiungi fitcoach alla schermata Home
            </h2>
            <p className="t-nota">Per averla come app: tocca Condividi, poi &quot;Aggiungi alla schermata Home&quot;. Così la seduta funziona anche senza rete e la bozza resta sul telefono.</p>
          </section>
        ) : null}

        <section className="account-section" aria-labelledby="danger-h">
          <h2 id="danger-h" className="t-corpo-strong">
            Zona pericolosa
          </h2>
          <Button variant="danger" onClick={() => setDialog("delete")}>
            Cancella l&apos;account
          </Button>
        </section>

        <div className="row" style={{ padding: "var(--space-6) 0" }}>
          <Link href="/privacy" className="btn btn-tertiary">
            Privacy
          </Link>
          <Link href="/termini" className="btn btn-tertiary">
            Termini
          </Link>
          <Link href="/crediti" className="btn btn-tertiary">
            Crediti
          </Link>
          <Button variant="tertiary" onClick={() => void logout()}>
            Esci
          </Button>
          {texts ? (
            <span className="t-nota muted">
              Coach AI
              <NoteMark note={texts.ai_badge_note} scope="account" />
            </span>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "withdraw"}
        title="Conferma recesso"
        confirmLabel="Conferma recesso"
        destructive
        loading={busy === "withdraw"}
        loadingText="Registro il recesso…"
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          run("withdraw", async () => {
            const r = await api.billing.withdraw();
            setMsg(`Recesso registrato il ${formatDate(r.withdrawn_at)}. Rimborso di ${formatEuro(r.refund_amount)} in arrivo sulla carta. Ti ho mandato una email di conferma.`);
            await mutate();
          })
        }
      >
        L&apos;abbonamento si chiude subito e il rimborso è integrale. Il piano torna Base.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "revoke"}
        title="Revoca il consenso"
        confirmLabel="Revoca"
        destructive
        loading={busy === "revoke"}
        loadingText="Revoco…"
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          run("revoke", async () => {
            const r = await api.onboarding.consent(false);
            setMsg(r.detail);
            await mutate();
          })
        }
      >
        I dati su infortuni e dolori vengono cancellati e il piano smette di tenerne conto.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "delete"}
        title="Cancella l'account"
        confirmLabel="Cancella l'account"
        destructive
        loading={busy === "delete"}
        loadingText="Cancello…"
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          run("delete", async () => {
            await api.me.delete();
            writeAuth(null);
            router.replace("/account-cancellato");
          })
        }
      >
        Tutti i dati vengono eliminati. Non si torna indietro.
      </ConfirmDialog>
    </>
  );
}
