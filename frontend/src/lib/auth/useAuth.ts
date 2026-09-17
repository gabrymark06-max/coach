"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { readAuth, subscribeAuth, writeAuth, type StoredAuth } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";

const serverSnapshot = (): StoredAuth | null => null;

export function useAuth() {
  const auth = useSyncExternalStore(subscribeAuth, readAuth, serverSnapshot);
  const router = useRouter();
  const logout = useCallback(async () => {
    const a = readAuth();
    writeAuth(null);
    if (a) {
      try {
        await api.auth.logout(a.refresh_token);
      } catch {
        // il token locale è già via: il server lo scarta comunque alla scadenza
      }
    }
    router.replace("/accedi");
  }, [router]);
  return { auth, loggedIn: auth !== null, logout };
}

/** Vero dopo l'idratazione: prima non sappiamo se c'è un token (localStorage). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
