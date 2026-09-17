import { isApiError } from "./client";

/** La frase da mostrare per un errore, una sola per tutta l'app (ErrorBox in pagina, composer della chat, QA N4).
 * v1.1.2 §17.2: un 5xx arriva con `{code, detail}` e `X-Request-Id`; si mostra il detail del server e il codice da citare. */
export function errorText(error: unknown, supportEmail?: string | null): string {
  const api = isApiError(error) ? error : null;
  if (!api) return "Errore. Riprova tra poco.";
  if (api.status < 500) return api.detail;
  const where = supportEmail ? ` Se continua, scrivimi a ${supportEmail}` : "";
  const rid = api.requestId ? `${where ? " e cita" : " Al supporto cita"} il codice ${api.requestId}` : "";
  return `${api.detail}${where}${rid}${where || rid ? "." : ""}`;
}
