"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { useActiveSession } from "@/lib/session-context";

/**
 * `Toast` — §4.17: in basso, **sopra la pill del timer se presente**, e sopra la
 * bottom nav e la barra della sessione. Sopra non vuol dire "davanti": vuol dire
 * appoggiato al pezzo di interfaccia che c'e' sotto, senza coprirlo.
 */
export function AppToaster() {
  const pathname = usePathname();
  const { data: session, status } = useActiveSession();

  const inSessione = pathname.startsWith("/sessione");
  const conSessione = status === "ready" && Boolean(session);
  const conTimer = conSessione && Boolean(session?.restStartedAt);

  const pezzi = ["env(safe-area-inset-bottom)", "var(--space-4)"];
  if (!inSessione) {
    pezzi.push("var(--nav-h)");
    if (conSessione) pezzi.push("var(--session-bar-h)");
  }
  // altezza della pill (64px) + il suo distacco dal bordo
  if (conTimer) pezzi.push("64px", "var(--space-4)");

  // Sonner ha un offset separato per gli schermi stretti (`mobileOffset`): se si
  // imposta solo `offset`, a 375 resta quello di default e il toast finisce sopra la
  // pill del timer invece che sopra di essa.
  const offset = { bottom: `calc(${pezzi.join(" + ")})` };

  return (
    <Toaster
      position="bottom-center"
      offset={offset}
      mobileOffset={offset}
      gap={8}
      visibleToasts={2}
      toastOptions={{
        className:
          "!bg-[var(--popover)] !text-[var(--text-primary)] !border !border-[var(--border-strong)] !rounded-[var(--radius-md)] !shadow-[var(--elev-2)] !font-sans",
      }}
    />
  );
}
