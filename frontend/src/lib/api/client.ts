// Client HTTP: un solo posto per base URL, Bearer, refresh su 401 e forma dell'errore { code, detail, ...extra }.
import type { TokenPair } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const STORAGE_KEY = "fitcoach.auth.v1";

export type StoredAuth = {
  v: 1;
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  email: string;
};

export type ApiErrorMeta = {
  /** `X-Request-Id` della risposta: da citare al supporto su un 500 (contratto v1.1.2 §17.2). */
  requestId?: string | null;
  /** `Retry-After` in secondi su un 429 (contratto v1.1.2 §17.5); null se assente o non numerico. */
  retryAfter?: number | null;
};

export class ApiError extends Error {
  status: number;
  code: string;
  detail: string;
  extra: Record<string, unknown>;
  requestId: string | null;
  retryAfter: number | null;
  constructor(status: number, body: Record<string, unknown> | null, meta: ApiErrorMeta = {}) {
    const code = typeof body?.code === "string" ? body.code : status === 0 ? "network" : "http_error";
    let detail = typeof body?.detail === "string" ? body.detail : defaultDetail(status);
    const retryAfter = meta.retryAfter ?? null;
    if (status === 429 && retryAfter !== null) {
      detail = `${detail.replace(/\s*Aspetta un attimo e riprova\.$/i, "")} Riprova tra ${formatRetryAfter(retryAfter)}.`;
    }
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.requestId = meta.requestId ?? null;
    this.retryAfter = retryAfter;
    const rest: Record<string, unknown> = { ...(body ?? {}) };
    delete rest.code;
    delete rest.detail;
    this.extra = rest;
  }
  /** Un errore del server (5xx) è del server, non della rete: si mostra `detail`, mai "senza rete". */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "o" : "i"}`;
  const m = Math.ceil(seconds / 60);
  return `${m} minut${m === 1 ? "o" : "i"}`;
}

/** `Retry-After` semplice (secondi interi); la forma data HTTP non si interpreta. */
export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const t = value.trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  return Number(t);
}

export function errorMeta(res: Response): ApiErrorMeta {
  return { requestId: res.headers.get("x-request-id"), retryAfter: parseRetryAfter(res.headers.get("retry-after")) };
}

export function defaultDetail(status: number): string {
  if (status === 0) return "Senza rete. Quello che vedi è l'ultima versione che ho.";
  if (status === 401) return "La sessione è scaduta. Entra di nuovo.";
  if (status === 429) return "Troppe richieste in poco tempo. Aspetta un attimo e riprova.";
  if (status >= 500) return "Errore dalla nostra parte, non tua. Riprova tra un minuto.";
  return "Errore. Riprova.";
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

// ---- storage ----
let cached: StoredAuth | null | undefined;

export function readAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredAuth) : null;
    cached = parsed && parsed.v === 1 ? parsed : null;
  } catch {
    cached = null;
  }
  return cached;
}

const listeners = new Set<() => void>();

export function subscribeAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function writeAuth(pair: TokenPair | null): void {
  if (typeof window === "undefined") return;
  if (!pair) {
    cached = null;
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    cached = {
      v: 1,
      access_token: pair.access_token,
      refresh_token: pair.refresh_token,
      expires_at: Date.now() + pair.expires_in * 1000,
      email: pair.user.email,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  }
  listeners.forEach((l) => l());
}

export function isLoggedIn(): boolean {
  return readAuth() !== null;
}

// ---- refresh (una sola in volo) ----
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const auth = readAuth();
  if (!auth) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refresh_token: auth.refresh_token }),
        });
        if (!res.ok) {
          if (res.status === 401) writeAuth(null);
          return false;
        }
        writeAuth((await res.json()) as TokenPair);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

async function doFetch(path: string, opts: RequestOptions, retry: boolean): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json", ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.auth !== false) {
    const auth = readAuth();
    if (auth) {
      if (auth.expires_at - Date.now() < 30_000 && retry) await refreshTokens();
      const fresh = readAuth();
      if (fresh) headers.authorization = `Bearer ${fresh.access_token}`;
    }
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, null);
  }
  if (res.status === 401 && opts.auth !== false && retry && readAuth()) {
    const ok = await refreshTokens();
    if (ok) return doFetch(path, opts, false);
  }
  return res;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await doFetch(path, opts, true);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new ApiError(res.status, body, errorMeta(res));
  return body as T;
}

export async function requestRaw(path: string, opts: RequestOptions = {}): Promise<Response> {
  return doFetch(path, opts, true);
}

export function newOpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
