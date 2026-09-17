"use client";

// Hook di lettura con SWR (dedup, revalidate). Ogni hook espone i tre stati: isLoading, error, data (vuoto compreso).
import useSWR, { type SWRConfiguration } from "swr";
import { api } from "@/lib/api/endpoints";
import { isApiError, request } from "@/lib/api/client";
import type { Me } from "@/lib/api/types";

const base: SWRConfiguration = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
  dedupingInterval: 5000,
};

export function useMe(config?: SWRConfiguration<Me>) {
  return useSWR<Me>("/me", () => api.me.get(), { ...base, ...config });
}

export function useToday() {
  return useSWR("/today", () => api.today(), base);
}

export function usePlan() {
  return useSWR("/plans/current", () => api.plans.current(), base);
}

export function useSession(id: string | null) {
  return useSWR(id ? `/sessions/${id}` : null, () => api.sessions.get(id!), base);
}

export function useChatMessages() {
  return useSWR("/chat/messages", () => api.chat.messages(), base);
}

export function useChatQuota() {
  return useSWR("/chat/quota", () => api.chat.quota(), base);
}

export function useChatTexts() {
  return useSWR("/chat/texts", () => api.chat.texts(), { ...base, dedupingInterval: 600_000 });
}

export function useConsistency(weeks = 4) {
  return useSWR(`/progress/consistency?weeks=${weeks}`, () => api.progress.consistency(weeks), base);
}

export function useProgressExercises() {
  return useSWR("/progress/exercises", () => api.progress.exercises(), base);
}

export function useProgressHistory(slug: string | null) {
  return useSWR(slug ? `/progress/exercises/${slug}` : null, () => api.progress.history(slug!), base);
}

export function useSummary(n: number | null) {
  return useSWR(n ? `/mesocycles/${n}/summary` : null, () => api.plans.summary(n!), base);
}

export function useOnboardingSchema() {
  return useSWR("/onboarding/schema", () => api.onboarding.schema(), { ...base, dedupingInterval: 600_000 });
}

/** Listino Pro (contratto §9, v1.1.3): cache 60 s come consigliato; `fallbackData` per chi lo ha già preso lato server. */
export function usePrices(fallbackData?: import("@/lib/api/types").Prices | null) {
  return useSWR("/billing/prices", () => api.billing.prices(), { ...base, dedupingInterval: 60_000, fallbackData: fallbackData ?? undefined });
}

export function isNoPlan(error: unknown): boolean {
  return isApiError(error) && error.status === 404 && error.code === "no_plan";
}

export function useRule(ruleId: string | null) {
  return useSWR(ruleId ? `/knowledge/rules/${ruleId}` : null, () => request<import("@/lib/api/types").Note>(`/knowledge/rules/${encodeURIComponent(ruleId!)}`, { auth: false }), {
    ...base,
    dedupingInterval: 600_000,
  });
}
