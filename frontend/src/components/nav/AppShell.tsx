"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth, useHydrated } from "@/lib/auth/useAuth";
import { useMe, useChatTexts } from "@/lib/hooks/useApi";
import { NotesProvider } from "@/components/note/NotesProvider";
import { Logo } from "./Logo";
import { NoteMark } from "@/components/note/NoteMark";
import { ProPill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIsDesktop } from "@/lib/hooks/useMedia";
import { useQueueDrain } from "@/lib/draft/useQueueDrain";

const ITEMS = [
  { href: "/oggi", label: "Oggi" },
  { href: "/settimana", label: "Settimana" },
  { href: "/chat", label: "Coach" },
  { href: "/progressi", label: "Progressi" },
];

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shell autenticata: rail (≥1024) + tab bar (<1024), guardia di accesso, un NotesProvider per pagina. */
export function AppShell({ children, scale }: { children: ReactNode; scale?: "palestra" | "scrivania" }) {
  const hydrated = useHydrated();
  const { loggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // La shell si monta dopo l'idratazione (guardia di accesso): la media query è già quella vera, e nel DOM vive
  // una sola nav "Principale" per volta (QA M14), rail ≥ 1024 o tab bar sotto.
  const desktop = useIsDesktop();

  useEffect(() => {
    if (hydrated && !loggedIn) {
      const next = encodeURIComponent(pathname);
      router.replace(`/accedi?next=${next}`);
    }
  }, [hydrated, loggedIn, router, pathname]);

  if (!hydrated || !loggedIn) {
    return (
      <div className="app-main">
        <Skeleton lines={2} />
      </div>
    );
  }

  return (
    <NotesProvider>
      <QueueDrain />
      <div className="app-shell" data-scale={scale}>
        {desktop ? <Rail pathname={pathname} /> : null}
        <main id="contenuto" className="app-main" tabIndex={-1}>
          {children}
        </main>
        {desktop ? null : (
          <nav className="tabbar" aria-label="Principale">
            {ITEMS.map((it) => (
              <Link key={it.href} href={it.href} aria-current={isCurrent(pathname, it.href) ? "page" : undefined}>
                {it.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </NotesProvider>
  );
}

/** QA N1: manda la coda offline (chiusure comprese) da qualunque rotta app, non solo da /oggi/seduta. */
function QueueDrain() {
  useQueueDrain();
  return null;
}

function Rail({ pathname }: { pathname: string }) {
  const { data: me } = useMe();
  const { data: texts } = useChatTexts();
  const editable = me?.engine_active && me.mesocycle?.status === "active" && me.entitlement.plan === "pro";
  return (
    <aside className="rail">
      <Logo />
      <nav aria-label="Principale">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} aria-current={isCurrent(pathname, it.href) ? "page" : undefined}>
            {it.label}
            {it.href === "/settimana" && editable ? <ProPill /> : null}
          </Link>
        ))}
        <Link href="/account" aria-current={isCurrent(pathname, "/account") ? "page" : undefined}>
          Account
        </Link>
      </nav>
      <p className="rail-foot t-nota">
        Coach AI · le regole le scrivono persone
        {texts ? <NoteMark note={texts.ai_badge_note} scope="rail" /> : null}
      </p>
    </aside>
  );
}

/** Intestazione di pagina con "Account" a destra (mobile). */
export function PageHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="t-titolo">{title}</h1>
        {sub ? <p className="t-etichetta muted">{sub}</p> : null}
      </div>
      <div className="row">
        {action}
        <Link href="/account" className="btn btn-tertiary head-account">
          Account
        </Link>
      </div>
    </header>
  );
}
