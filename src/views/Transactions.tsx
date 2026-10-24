import { fmtDate, money, monthTxns, sumAmt } from "../../shared/finance";
import { SYS_EXP, SYS_INC, type Txn } from "../../shared/types";
import { Empty, TxnRow, accName } from "../components/ui";
import { useApp, useLedger } from "../state";
import { TxnForm } from "../forms/TxnForm";
import { NoAccounts } from "./shared";

export function Transactions() {
  const l = useLedger();
  const { month, filter: f, setFilter, open } = useApp();
  if (!l.accounts.length) return <NoAccounts />;

  const q = f.q.trim().toLowerCase();
  const rows = monthTxns(l, month)
    .filter(
      (t) =>
        (f.type === "all" || t.type === f.type) &&
        (f.account === "all" || t.accountId === f.account || t.toAccountId === f.account) &&
        (f.category === "all" || t.category === f.category) &&
        (!q || [t.note, t.category, accName(l, t.accountId)].join(" ").toLowerCase().includes(q)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const cats = [...new Set([...l.settings.expenseCats, ...SYS_EXP, ...l.settings.incomeCats, ...SYS_INC, ...l.txns.map((t) => t.category)])].filter((c) => c && c !== "Transfer");
  const days: Record<string, Txn[]> = {};
  rows.forEach((t) => (days[t.date] ||= []).push(t));

  return (
    <div className="card">
      <div className="filters" style={{ marginBottom: 8 }}>
        <input id="q" type="search" placeholder="Search notes, category, bank" value={f.q} onChange={(e) => setFilter({ q: e.target.value })} aria-label="Search entries" />
        <select id="f-type" value={f.type} onChange={(e) => setFilter({ type: e.target.value })} aria-label="Type">
          <option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option><option value="transfer">Transfers</option>
        </select>
        <select id="f-account" value={f.account} onChange={(e) => setFilter({ account: e.target.value })} aria-label="Account">
          <option value="all">All accounts</option>
          {l.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select id="f-category" value={f.category} onChange={(e) => setFilter({ category: e.target.value })} aria-label="Category">
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {!rows.length ? (
        <Empty title="No entries match"><span>Try another month or clear the filters.</span></Empty>
      ) : (
        <>
          <div className="calc" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
            <span>{rows.length} entries</span>
            <span className="pos">In {money(sumAmt(rows.filter((t) => t.type === "income")))}</span>
            <span className="neg">Out {money(sumAmt(rows.filter((t) => t.type === "expense")))}</span>
          </div>
          {Object.entries(days).map(([d, list]) => {
            const out = sumAmt(list.filter((t) => t.type === "expense"));
            return (
              <div key={d}>
                <div className="daygrp"><span>{fmtDate(d, { weekday: true })}</span><span>{out ? `−${money(out)}` : ""}</span></div>
                <div className="list">{list.map((t) => <TxnRow key={t.id} t={t} l={l} onClick={() => open(<TxnForm t={t} />)} />)}</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
