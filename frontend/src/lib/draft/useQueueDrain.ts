"use client";

// QA N1: il drain globale della coda offline. Vive nell'AppShell, quindi su ogni rotta autenticata: la chiusura fatta in
// palestra senza rete parte appena la rete torna, anche se l'utente è su /oggi, in chat, o riapre l'app da sfondo.
// Prima viveva solo nel hook della seduta: se /oggi/seduta non era montata la coda restava sul telefono.
import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { drainAll } from "./drain";

export function useQueueDrain() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    let alive = true;
    const drain = async () => {
      if (!navigator.onLine) return;
      const results = await drainAll();
      if (!alive || results.size === 0) return;
      let touched = false;
      let closed = false;
      for (const [id, r] of results) {
        if (r.kind !== "synced" && r.kind !== "closed") continue;
        touched = true;
        if (r.kind === "closed") {
          closed = true;
          if (r.session) void mutate(`/sessions/${id}`, r.session, { revalidate: false });
        } else {
          void mutate(`/sessions/${id}`, r.out.session, { revalidate: false });
        }
      }
      if (touched) void mutate("/today");
      if (closed) {
        // la chiusura produce la progressione e il commento del coach
        void mutate("/plans/current");
        void mutate("/chat/messages");
        void mutate((key) => typeof key === "string" && key.startsWith("/progress/"));
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void drain();
    };
    void drain();
    window.addEventListener("online", drain);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mutate]);
}
