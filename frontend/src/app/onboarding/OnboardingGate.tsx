"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth, useHydrated } from "@/lib/auth/useAuth";
import { NotesProvider } from "@/components/note/NotesProvider";
import { Logo } from "@/components/nav/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/** Onboarding: autenticato, senza rail né tab (§4.5). Mai un paywall qui (§2.5). */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const { loggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (hydrated && !loggedIn) router.replace(`/accedi?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, loggedIn, router, pathname]);
  if (!hydrated || !loggedIn) {
    return (
      <div className="onb">
        <Skeleton lines={2} />
      </div>
    );
  }
  return (
    <NotesProvider>
      <div className="onb">
        <header style={{ marginBottom: "var(--space-8)" }}>
          <Logo />
        </header>
        <main id="contenuto" tabIndex={-1}>
          {children}
        </main>
      </div>
    </NotesProvider>
  );
}
