"use client";

import { Button } from "./Button";
import { isApiError } from "@/lib/api/client";
import { errorText } from "@/lib/api/errorText";
import Link from "next/link";

/** Errore in pagina (§6.2): titolo + voce + [Riprova]. 401 → [Accedi]. Mai un toast. */
export function ErrorBox({ error, onRetry, title, supportEmail }: { error: unknown; onRetry?: () => void; title?: string; supportEmail?: string | null }) {
  const api = isApiError(error) ? error : null;
  if (api?.status === 401) {
    return (
      <div className="stack" role="alert">
        <h2 className="t-titolo">La sessione è scaduta.</h2>
        <p className="t-voce measure-voice">Entra di nuovo: la seduta, se c&apos;era, è salvata sul telefono.</p>
        <Button href="/accedi" variant="secondary">
          Accedi
        </Button>
      </div>
    );
  }
  // v1.1.2: un 5xx arriva con `{code, detail}` e `X-Request-Id`: si mostra il detail del server e l'id da citare al supporto.
  const text = errorText(error, supportEmail);
  if (api?.status === 403 && api.code === "plan_required") {
    return (
      <div className="stack" role="alert">
        <p className="t-voce measure-voice">{api.detail}</p>
        <div className="row">
          <Link href="/prezzi" className="btn btn-secondary">
            Vedi Pro
          </Link>
          {onRetry ? (
            <Button variant="tertiary" onClick={onRetry}>
              Lascia stare
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="stack" role="alert">
      {title ? <h2 className="t-titolo">{title}</h2> : null}
      <p className="t-voce measure-voice">{text}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Riprova
        </Button>
      ) : null}
    </div>
  );
}
