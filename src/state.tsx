import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Col, type Draft } from "./api";
import type { Ledger, Settings } from "../shared/types";

export type View = "home" | "transactions" | "reports" | "emis" | "chitty" | "accounts";
export interface TxnFilter { type: string; account: string; category: string; q: string }
export interface ReportState { period: "month" | "year"; account: string }

export interface AppState {
  today: string;
  month: string;
  setMonth: (m: string) => void;
  view: View;
  go: (v: View) => void;
  filter: TxnFilter;
  setFilter: (f: Partial<TxnFilter>) => void;
  report: ReportState;
  setReport: (r: Partial<ReportState>) => void;
  open: (node: ReactNode) => void;
  close: () => void;
  toast: (msg: string) => void;
}

export const AppCtx = createContext<AppState | null>(null);
export function useApp(): AppState {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export const LEDGER_KEY = ["ledger"];
export function useLedgerQuery() {
  return useQuery({ queryKey: LEDGER_KEY, queryFn: api.ledger });
}
/** The loaded ledger. Only used below <Shell>, which renders after it loads. */
export function useLedger(): Ledger {
  const { data } = useLedgerQuery();
  if (!data) throw new Error("Ledger not loaded");
  return data;
}

/** Writes: call the API, refresh the ledger, toast the result. Rejects on failure so forms can stay open. */
export function useActions() {
  const qc = useQueryClient();
  const { toast } = useApp();
  const run = useCallback(
    async <T,>(p: Promise<T>, ok?: string): Promise<T> => {
      try {
        const r = await p;
        await qc.invalidateQueries({ queryKey: LEDGER_KEY });
        if (ok) toast(ok);
        return r;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Couldn't save.");
        throw e;
      }
    },
    [qc, toast],
  );
  return {
    save: <C extends Col>(col: C, row: Draft<C>, ok?: string) => run(api.save(col, row), ok),
    remove: (col: Col, id: string, ok = "Deleted") => run(api.remove(col, id), ok),
    settings: (s: Settings) => run(api.settings(s)),
    loadSamples: () => run(api.loadSamples(), "Example data loaded"),
    removeSamples: () => run(api.removeSamples(), "Examples removed. Start by adding your accounts."),
  };
}
