"use client";

// Risposte dell'onboarding tra un passo e l'altro (sessionStorage, versionato).
import { useCallback, useSyncExternalStore } from "react";

export type OnbAnswers = {
  v: 1;
  goal?: string;
  level?: string;
  days_per_week?: string;
  minutes_per_session?: string;
  location?: string;
  equipment?: string[];
  health_consent?: boolean;
  constraints_text?: string;
  safety_answers?: Record<string, boolean>;
  result?: { first_session_id: string; coach_comment_message_id: string; safety_notice_it: string | null };
};

const KEY = "fitcoach.onb.v1";
const EMPTY: OnbAnswers = { v: 1 };
let cache: OnbAnswers | null = null;
const subs = new Set<() => void>();

function read(): OnbAnswers {
  if (cache) return cache;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as OnbAnswers) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: OnbAnswers) {
  cache = next;
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
  subs.forEach((s) => s());
}

export function useOnboardingAnswers() {
  const answers = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    read,
    () => EMPTY,
  );
  const update = useCallback((patch: Partial<OnbAnswers>) => write({ ...read(), ...patch }), []);
  const clear = useCallback(() => write(EMPTY), []);
  return { answers, update, clear };
}
