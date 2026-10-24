import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, localToday, monthLabel } from "../shared/finance";
import { api } from "./api";
import { AppCtx, useActions, useLedgerQuery, type AppState, type ReportState, type TxnFilter, type View } from "./state";
import { Icon, PlusIcon } from "./components/ui";
import { TxnForm } from "./forms/TxnForm";
import { Dashboard } from "./views/Dashboard";
import { Transactions } from "./views/Transactions";
import { Reports } from "./views/Reports";
import { Emis, Chitty, Sips } from "./views/Loans";
import { Accounts } from "./views/Accounts";

const VIEWS: { id: View; label: string; short: string; icon: ReactNode }[] = [
  { id: "home", label: "Dashboard", short: "Home", icon: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></> },
  { id: "transactions", label: "Transactions", short: "Entries", icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { id: "reports", label: "Category & bank", short: "Reports", icon: <path d="M5 20V10M12 20V4M19 20v-7" /> },
  { id: "emis", label: "EMIs", short: "EMIs", icon: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { id: "chitty", label: "Chitty", short: "Chitty", icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4v8l5 3" /></> },
  { id: "sips", label: "SIPs", short: "SIPs", icon: <path d="M4 18l5-5 4 3 7-8M15 8h5v5" /> },
  { id: "accounts", label: "Accounts & setup", short: "Accounts", icon: <><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></> },
];
const viewFromHash = (): View => {
  const h = window.location.hash.slice(1) as View;
  return VIEWS.some((v) => v.id === h) ? h : "home";
};

export default function App() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: 1 });
  if (me.isLoading) return <div className="spinner">Opening Kanakku…</div>;
  if (me.isError) return <div className="spinner">{(me.error as Error).message}</div>;
  if (!me.data?.authed) return <Login />;
  return <Shell />;
}

function Login() {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.login(String(new FormData(e.currentTarget).get("password") || ""));
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand"><div className="brand-mark">₹</div><div><b>Kanakku</b><span>Money ledger</span></div></div>
        <label className="fld">
          <span>Password</span>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        <p className="err" role="alert">{err}</p>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}

function Shell() {
  const [today, setToday] = useState(localToday);
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const [view, setView] = useState<View>(viewFromHash);
  const [filter, setFilterState] = useState<TxnFilter>({ type: "all", account: "all", category: "all", q: "" });
  const [report, setReportState] = useState<ReportState>({ period: "month", account: "all" });
  const [modal, setModal] = useState<ReactNode>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<number>();
  const ledger = useLedgerQuery();

  // Roll "today" over at midnight if the tab stays open.
  useEffect(() => {
    const id = window.setInterval(() => setToday((t) => (t === localToday() ? t : localToday())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModal(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 3200);
  }, []);
  const go = useCallback((v: View) => {
    setView(v);
    setModal(null);
    history.replaceState(null, "", `#${v}`);
    window.scrollTo(0, 0);
  }, []);

  const ctx: AppState = useMemo(
    () => ({
      today, month, setMonth, view, go, filter,
      setFilter: (f) => setFilterState((s) => ({ ...s, ...f })),
      report,
      setReport: (r) => setReportState((s) => ({ ...s, ...r })),
      open: (node) => setModal(node),
      close: () => setModal(null),
      toast,
    }),
    [today, month, view, go, filter, report, toast],
  );
  const current = VIEWS.find((v) => v.id === view)!;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <aside className="rail">
          <div className="brand"><div className="brand-mark">₹</div><div><b>Kanakku</b><span>Money ledger</span></div></div>
          <nav className="nav">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className={v.id === view ? "on" : ""} onClick={() => go(v.id)}>
                <Icon>{v.icon}</Icon><span>{v.label}</span>
              </button>
            ))}
          </nav>
          <div className="rail-foot">Saved to your Kanakku database</div>
        </aside>
        <div style={{ minWidth: 0 }}>
          <header className="top">
            <div className="top-in">
              <div className="top-title">{current.label}</div>
              <div className="monthsw" aria-label="Month">
                <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><Icon size={16}><path d="M15 6l-6 6 6 6" /></Icon></button>
                <span>{monthLabel(month, true)}</span>
                <button type="button" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><Icon size={16}><path d="M9 6l6 6-6 6" /></Icon></button>
              </div>
              <button className="btn primary hide-sm" type="button" onClick={() => setModal(<TxnForm />)}><PlusIcon />Add entry</button>
            </div>
          </header>
          <main>
            {ledger.isLoading ? (
              <div className="card empty"><b>Opening your ledger…</b><span>Loading accounts, entries, EMIs, chitty and SIPs.</span></div>
            ) : ledger.isError ? (
              <div className="card empty">
                <b>Couldn't load your ledger</b>
                <span>{(ledger.error as Error).message}</span>
                <button className="btn" type="button" onClick={() => ledger.refetch()}>Try again</button>
              </div>
            ) : (
              <>
                <SampleBanner />
                {view === "home" && <Dashboard />}
                {view === "transactions" && <Transactions />}
                {view === "reports" && <Reports />}
                {view === "emis" && <Emis />}
                {view === "chitty" && <Chitty />}
                {view === "sips" && <Sips />}
                {view === "accounts" && <Accounts />}
              </>
            )}
          </main>
        </div>
      </div>
      <nav className="tabbar">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={v.id === view ? "on" : ""} onClick={() => go(v.id)}>
            <Icon>{v.icon}</Icon><span>{v.short}</span>
          </button>
        ))}
      </nav>
      <button className="fab" type="button" aria-label="Add entry" onClick={() => setModal(<TxnForm />)}><Icon size={24}><path d="M12 5v14M5 12h14" strokeWidth={2.2} /></Icon></button>
      {modal && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="sheet" role="dialog" aria-modal="true">{modal}</div>
        </div>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}

function SampleBanner() {
  const { data } = useLedgerQuery();
  const act = useActions();
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const n = [data.accounts, data.txns, data.emis, data.chits, data.sips].reduce((s, rows) => s + rows.filter((r) => r.sample).length, 0);
  if (!n) return null;
  return (
    <div className="alert info">
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div><b>You are looking at example entries.</b> <span className="muted">They show how the tracker works. Remove them before adding your own.</span></div>
        <button className="btn small" type="button" disabled={busy} onClick={async () => { setBusy(true); try { await act.removeSamples(); } finally { setBusy(false); } }}>
          {busy ? "Removing…" : `Remove ${n} examples`}
        </button>
      </div>
    </div>
  );
}
