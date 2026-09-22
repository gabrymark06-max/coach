"use client";

import * as React from "react";
import { getDb } from "@/lib/db/db";
import { getActiveSession, getSettings } from "@/lib/db/queries";
import type { Session, Settings } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/db/schema";
import { ensureSeeded } from "@/lib/db/seed";
import { useLiveData, type AsyncState } from "@/lib/hooks/use-live-data";

interface SessionContextValue {
  session: AsyncState<Session | undefined> & { retry: () => void };
  settings: Settings;
  settingsState: AsyncState<Settings | undefined> & { retry: () => void };
  /** true finche' il primo avvio non ha finito di preparare il database */
  booting: boolean;
  bootError: Error | null;
  retryBoot: () => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

/**
 * Una sola sottoscrizione Dexie per la sessione attiva e per le impostazioni, condivisa
 * da `SessionBar`, pill del timer, quick start e pagina `/sessione`. Senza questo, ogni
 * componente aprirebbe la propria `liveQuery` sulla stessa tabella.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = React.useState(true);
  const [bootError, setBootError] = React.useState<Error | null>(null);
  const [bootNonce, setBootNonce] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    ensureSeeded(getDb())
      .then(() => {
        if (alive) setBooting(false);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setBootError(error instanceof Error ? error : new Error(String(error)));
        setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, [bootNonce]);

  const session = useLiveData(() => getActiveSession(getDb()), [booting]);
  const settingsState = useLiveData(() => getSettings(getDb()), [booting]);

  const retryBoot = React.useCallback(() => {
    setBooting(true);
    setBootError(null);
    setBootNonce((n) => n + 1);
  }, []);

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session,
      settings: settingsState.data ?? DEFAULT_SETTINGS,
      settingsState,
      booting,
      bootError,
      retryBoot,
    }),
    [session, settingsState, booting, bootError, retryBoot],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue {
  const value = React.useContext(SessionContext);
  if (!value) throw new Error("useSessionContext va usato dentro SessionProvider");
  return value;
}

export function useActiveSession() {
  return useSessionContext().session;
}

export function useSettings(): Settings {
  return useSessionContext().settings;
}
