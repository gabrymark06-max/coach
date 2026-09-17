import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { errorText } from "./errorText";

describe("errorText: la frase di un errore, uguale in pagina (ErrorBox) e nel composer della chat (QA N4)", () => {
  it("su un 5xx cita il detail del server, l'email del supporto e il request_id", () => {
    const e = new ApiError(500, { code: "internal_error", detail: "Errore dalla nostra parte, non tua. Riprova tra un minuto." }, { requestId: "req-abc" });
    expect(errorText(e, "ciao@fitcoach.example")).toBe("Errore dalla nostra parte, non tua. Riprova tra un minuto. Se continua, scrivimi a ciao@fitcoach.example e cita il codice req-abc.");
  });
  it("senza email del supporto chiede comunque di citare il codice", () => {
    const e = new ApiError(502, { code: "llm_unavailable", detail: "Il coach non risponde." }, { requestId: "req-1" });
    expect(errorText(e)).toBe("Il coach non risponde. Al supporto cita il codice req-1.");
  });
  it("un 5xx senza request_id resta il solo detail", () => {
    expect(errorText(new ApiError(500, { code: "internal_error", detail: "Boom." }))).toBe("Boom.");
  });
  it("un 4xx è il solo detail; un errore non API è generico", () => {
    expect(errorText(new ApiError(422, { code: "validation_error", detail: "Testo troppo lungo." }, { requestId: "req-2" }))).toBe("Testo troppo lungo.");
    expect(errorText(new Error("x"))).toBe("Errore. Riprova tra poco.");
  });
});
