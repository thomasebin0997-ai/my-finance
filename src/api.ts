import type { Account, Chit, Debt, Emi, Ledger, Settings, Sip, Txn } from "../shared/types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection; on Render's free plan the first request after a break can take up to a minute.");
  }
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error || `Request failed (${r.status}).`);
  return data as T;
}

export type Col = "accounts" | "txns" | "emis" | "chits" | "sips" | "debts";
export type RowOf<C extends Col> = C extends "accounts" ? Account : C extends "txns" ? Txn : C extends "emis" ? Emi : C extends "sips" ? Sip : C extends "debts" ? Debt : Chit;
export type Draft<C extends Col> = Omit<RowOf<C>, "id" | "createdAt"> & { id?: string };

export const api = {
  me: () => req<{ authed: boolean }>("GET", "/api/auth/me"),
  login: (password: string) => req<{ authed: boolean }>("POST", "/api/auth/login", { password }),
  logout: () => req<{ authed: boolean }>("POST", "/api/auth/logout"),
  ledger: () => req<Ledger>("GET", "/api/ledger"),
  save: <C extends Col>(col: C, row: Draft<C>) => {
    const { id, ...body } = row;
    return id ? req<RowOf<C>>("PUT", `/api/${col}/${id}`, body) : req<RowOf<C>>("POST", `/api/${col}`, body);
  },
  remove: (col: Col, id: string) => req<void>("DELETE", `/api/${col}/${id}`),
  settings: (s: Settings) => req<Settings>("PUT", "/api/settings", s),
  loadSamples: () => req<{ inserted: number }>("POST", "/api/samples"),
  removeSamples: () => req<{ removed: number }>("DELETE", "/api/samples"),
  testReminder: () => req<{ due: number; sent: boolean; skipped?: string; channels?: string[]; failed?: { channel: string; error: string }[] }>("POST", "/api/reminders/test"),
};
