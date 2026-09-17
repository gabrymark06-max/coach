// Una funzione per rotta del contratto. Nessuna rotta inventata: tutte stanno in /openapi.json.
import { request, requestRaw } from "./client";
import type {
  ChatMessage,
  ChatQuota,
  ChatTexts,
  CheckoutIn,
  CloseIn,
  CloseOut,
  Consistency,
  EventIn,
  ExportOut,
  Founders,
  KnowledgeExercise,
  Me,
  Note,
  OnboardingIn,
  OnboardingOut,
  OnboardingSchema,
  Plan,
  PortalIn,
  Prices,
  ProgressExercise,
  ProgressHistory,
  Proposal,
  ProposalPatch,
  ReadinessIn,
  ReadinessOut,
  Session,
  SessionExercise,
  SetOut,
  SetPatchIn,
  Summary,
  SyncOp,
  SyncOut,
  Today,
  TokenPair,
  User,
  WithdrawOut,
} from "./types";

type ClientOp = { client_op_id: string; client_updated_at: string };

export const api = {
  auth: {
    register: (body: { email: string; password: string; accept_terms: boolean }) =>
      request<TokenPair>("/auth/register", { method: "POST", body, auth: false }),
    login: (body: { email: string; password: string }) =>
      request<TokenPair>("/auth/login", { method: "POST", body, auth: false }),
    logout: (refresh_token: string) => request<void>("/auth/logout", { method: "POST", body: { refresh_token } }),
    verifyResend: () => request<{ accepted: boolean; detail: string }>("/auth/verify/resend", { method: "POST" }),
    verify: (token: string) => request<User>("/auth/verify", { method: "POST", body: { token }, auth: false }),
    forgot: (email: string) =>
      request<{ accepted: boolean; detail: string }>("/auth/password/forgot", { method: "POST", body: { email }, auth: false }),
    reset: (token: string, password: string) =>
      request<unknown>("/auth/password/reset", { method: "POST", body: { token, password }, auth: false }),
  },
  me: {
    get: () => request<Me>("/me"),
    delete: () => request<void>("/me", { method: "DELETE" }),
    export: () => request<ExportOut>("/me/export", { method: "POST" }),
    exportFile: (token: string) => requestRaw(`/me/export/${encodeURIComponent(token)}`),
  },
  onboarding: {
    schema: () => request<OnboardingSchema>("/onboarding/schema", { auth: false }),
    submit: (body: OnboardingIn) => request<OnboardingOut>("/onboarding", { method: "POST", body }),
    consent: (given: boolean) =>
      request<{ given: boolean; given_at: string | null; detail: string }>("/consents/health", { method: "POST", body: { given } }),
  },
  today: () => request<Today>("/today"),
  plans: {
    current: () => request<Plan>("/plans/current"),
    maintenance: () => request<Plan>("/plans/maintenance", { method: "POST" }),
    newMesocycle: () =>
      request<{ mesocycle: unknown; first_session_id: string; coach_comment_message_id: string | null }>("/plans/mesocycles", {
        method: "POST",
      }),
    summary: (n: number) => request<Summary>(`/mesocycles/${n}/summary`),
    propose: (patch: ProposalPatch) => request<Proposal>("/plans/proposals", { method: "POST", body: { patch } }),
    proposal: (id: string) => request<Proposal>(`/plans/proposals/${id}`),
    apply: (id: string) => request<Proposal>(`/plans/proposals/${id}/apply`, { method: "POST" }),
    reject: (id: string) => request<Proposal>(`/plans/proposals/${id}/reject`, { method: "POST" }),
  },
  sessions: {
    get: (id: string) => request<Session>(`/sessions/${id}`),
    readiness: (id: string, body: ReadinessIn) => request<ReadinessOut>(`/sessions/${id}/readiness`, { method: "POST", body }),
    /** v1.1 — versione corta dall'anteprima di Oggi, senza le tre domande; 409 `already_short` · `session_closed`. */
    short: (id: string) => request<ReadinessOut>(`/sessions/${id}/short`, { method: "POST" }),
    restore: (id: string, exerciseSlug: string) =>
      request<Session>(`/sessions/${id}/readiness/restore/${encodeURIComponent(exerciseSlug)}`, { method: "POST" }),
    patchSet: (id: string, setId: string, body: SetPatchIn) =>
      request<SetOut>(`/sessions/${id}/sets/${setId}`, { method: "PATCH", body }),
    addSet: (id: string, body: ClientOp & { exercise_id: string }) =>
      request<SetOut>(`/sessions/${id}/sets`, { method: "POST", body }),
    deleteSet: (id: string, setId: string, clientOpId: string) =>
      request<void>(`/sessions/${id}/sets/${setId}?client_op_id=${encodeURIComponent(clientOpId)}`, { method: "DELETE" }),
    substitute: (id: string, exId: string, body: ClientOp & { exercise_id: string }) =>
      request<SessionExercise>(`/sessions/${id}/exercises/${exId}/substitute`, { method: "POST", body }),
    skipExercise: (id: string, exId: string, body: ClientOp) =>
      request<SessionExercise>(`/sessions/${id}/exercises/${exId}/skip`, { method: "POST", body }),
    restoreExercise: (id: string, exId: string, body: ClientOp) =>
      request<SessionExercise>(`/sessions/${id}/exercises/${exId}/restore`, { method: "POST", body }),
    close: (id: string, body: CloseIn) => request<CloseOut>(`/sessions/${id}/close`, { method: "POST", body }),
    sync: (id: string, ops: SyncOp[]) => request<SyncOut>(`/sessions/${id}/sync`, { method: "POST", body: { ops } }),
  },
  progress: {
    consistency: (weeks = 4) => request<Consistency>(`/progress/consistency?weeks=${weeks}`),
    exercises: () => request<ProgressExercise[]>("/progress/exercises"),
    history: (slug: string, since?: string) =>
      request<ProgressHistory>(`/progress/exercises/${encodeURIComponent(slug)}${since ? `?since=${since}` : ""}`),
  },
  chat: {
    messages: (params?: { before?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.before) q.set("before", params.before);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return request<ChatMessage[]>(`/chat/messages${qs ? `?${qs}` : ""}`);
    },
    send: (text: string, client_op_id: string, signal?: AbortSignal) =>
      requestRaw("/chat/messages", { method: "POST", body: { text, client_op_id }, headers: { accept: "text/event-stream" }, signal }),
    option: (optionId: string, message_id: string) =>
      request<ChatMessage>(`/chat/options/${encodeURIComponent(optionId)}`, { method: "POST", body: { message_id } }),
    quota: () => request<ChatQuota>("/chat/quota"),
    texts: () => request<ChatTexts>("/chat/texts", { auth: false }),
  },
  billing: {
    checkout: (body: CheckoutIn) => request<{ url: string }>("/billing/checkout", { method: "POST", body }),
    portal: (body: PortalIn) => request<{ url: string }>("/billing/portal", { method: "POST", body }),
    withdraw: () => request<WithdrawOut>("/billing/withdraw", { method: "POST" }),
    founders: () => request<Founders>("/billing/founders", { auth: false }),
    /** v1.1.3 — listino: la sola fonte dei prezzi Pro (§9). Pubblica; `key` è il `price` di POST /billing/checkout. */
    prices: () => request<Prices>("/billing/prices", { auth: false }),
  },
  events: (body: EventIn) => request<unknown>("/events", { method: "POST", body }),
  knowledge: {
    rules: () => request<Note[]>("/knowledge/rules", { auth: false }),
    exercises: () => request<KnowledgeExercise[]>("/knowledge/exercises", { auth: false }),
  },
};
