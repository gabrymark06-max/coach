"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { NotesProvider } from "@/components/note/NotesProvider";
import { Logo } from "./Logo";
import { useAuth, useHydrated } from "@/lib/auth/useAuth";
import { useChatTexts } from "@/lib/hooks/useApi";

/** Header e footer delle pagine pubbliche (§8). Il footer porta la riga AI. */
export function PublicChrome({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const { loggedIn } = useAuth();
  // v1.1: l'email di supporto arriva da GET /chat/texts (pubblica), la stessa di GET /me. Nessuna env del client.
  const { data: texts } = useChatTexts();
  const supportEmail = texts?.support_email;
  return (
    <NotesProvider>
      <div className="container">
        <header className="site-header">
          <Logo landing />
          <nav aria-label="Sito">
            <Link href="/prezzi">Prezzi</Link>
            {hydrated && loggedIn ? (
              <Link href="/oggi" className="btn btn-secondary nav-cta">
                Vai a Oggi
              </Link>
            ) : (
              <>
                <Link href="/accedi">Accedi</Link>
                <Link href="/registrati" className="btn btn-secondary nav-cta">
                  Fai la tua scheda
                </Link>
              </>
            )}
          </nav>
        </header>
        <main id="contenuto" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer t-etichetta">
          <Link href="/privacy">Privacy</Link>
          <Link href="/termini">Termini</Link>
          <Link href="/crediti">Crediti</Link>
          {supportEmail ? <a href={`mailto:${supportEmail}`}>Contatti</a> : null}
          <span>Parli con un coach AI, non con una persona.</span>
        </footer>
      </div>
    </NotesProvider>
  );
}
