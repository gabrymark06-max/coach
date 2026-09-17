// Timer di riposo a timestamp (design-system §2.2.4, verifica #26): il residuo si ricalcola da end_at, mai da tick.
export type RestTimer = { started_at: number; end_at: number; total_s: number; rest_s: number };

export function startTimer(restSeconds: number, now: number = Date.now()): RestTimer {
  return { started_at: now, end_at: now + restSeconds * 1000, total_s: restSeconds, rest_s: restSeconds };
}

export function extendTimer(t: RestTimer, seconds: number): RestTimer {
  return { ...t, end_at: t.end_at + seconds * 1000, total_s: t.total_s + seconds };
}

export function remainingSeconds(t: RestTimer, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((t.end_at - now) / 1000));
}
