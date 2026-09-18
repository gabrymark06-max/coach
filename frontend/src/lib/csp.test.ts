import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

/** Seam: la stringa CSP servita dagli header (D4 del QA di produzione). Il test è la regola scritta:
 * niente eval, niente antenati in frame, e l'API è l'unica origine esterna a cui il browser può parlare. */
describe("contentSecurityPolicy", () => {
  const csp = contentSecurityPolicy("https://fitcoach-api-208b.onrender.com");

  function directive(name: string, policy = csp): string | null {
    const found = policy
      .split(";")
      .map((d) => d.trim())
      .find((d) => d === name || d.startsWith(`${name} `));
    return found ?? null;
  }

  it("blocca tutto per default e apre solo l'origine del sito", () => {
    expect(directive("default-src")).toBe("default-src 'self'");
  });

  it("non permette mai eval", () => {
    expect(csp).not.toContain("unsafe-eval");
  });

  it("lascia parlare il browser solo con il sito e con l'API", () => {
    expect(directive("connect-src")).toBe("connect-src 'self' https://fitcoach-api-208b.onrender.com");
  });

  it("senza un'origine API valida non apre nulla in più", () => {
    expect(directive("connect-src", contentSecurityPolicy(""))).toBe("connect-src 'self'");
    expect(directive("connect-src", contentSecurityPolicy("non-un-url"))).toBe("connect-src 'self'");
  });

  it("tiene solo l'origine di un URL con percorso", () => {
    expect(directive("connect-src", contentSecurityPolicy("https://api.esempio.it/v1/"))).toBe("connect-src 'self' https://api.esempio.it");
  });

  it("vieta l'incorniciamento e i plugin", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'self'");
  });

  it("serve i font e il service worker dal sito, le immagini anche da data: e blob:", () => {
    expect(directive("font-src")).toBe("font-src 'self'");
    expect(directive("worker-src")).toBe("worker-src 'self'");
    expect(directive("img-src")).toBe("img-src 'self' data: blob:");
    expect(directive("manifest-src")).toBe("manifest-src 'self'");
  });

  it("è una riga sola, senza direttive vuote né punto e virgola finale", () => {
    expect(csp).not.toContain("\n");
    expect(csp.endsWith(";")).toBe(false);
    expect(csp.split(";").every((d) => d.trim().length > 0)).toBe(true);
  });
});
