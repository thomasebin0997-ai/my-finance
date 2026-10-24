import { useState } from "react";
import { balances, fmtDate, money, monthLabel, status, schedItems, type SchedItem } from "../../shared/finance";
import type { Ledger, Txn } from "../../shared/types";
import { accName } from "../components/ui";
import { useActions, useApp } from "../state";
import { AccountForm } from "../forms/AccountForm";
import { TxnForm } from "../forms/TxnForm";

export function NoAccounts() {
  const { open } = useApp();
  const act = useActions();
  const [busy, setBusy] = useState(false);
  return (
    <div className="card empty">
      <b>Add your first bank account</b>
      <span>Every entry belongs to an account: a bank, a credit card or cash in hand.</span>
      <div className="actions">
        <button className="btn primary" type="button" onClick={() => open(<AccountForm />)}>Add account</button>
        <button className="btn" type="button" disabled={busy} onClick={async () => { setBusy(true); try { await act.loadSamples(); } finally { setBusy(false); } }}>
          {busy ? "Loading…" : "Try with example data"}
        </button>
      </div>
    </div>
  );
}

/** Whether the debit account can cover what's still due this month from it. */
export function AccountCheck({ l, it, today }: { l: Ledger; it: SchedItem; today: string }) {
  const bal = balances(l);
  if (!it.accountId || !(it.accountId in bal)) return <div className="check bad">The debit account was deleted. Edit this to pick another.</div>;
  const acc = l.accounts.find((a) => a.id === it.accountId)!;
  if (acc.type === "card") return <div className="check">Paid from credit card <b>{acc.name}</b>.</div>;
  const tm = today.slice(0, 7);
  const dueSameAcc = schedItems(l)
    .filter((x) => x.accountId === it.accountId)
    .reduce((s, x) => {
      const st = status(l, x, tm, today);
      return s + (st && st.state !== "paid" ? x.amount : 0);
    }, 0);
  const left = bal[it.accountId] - dueSameAcc;
  return (
    <div className={`check${left < 0 ? " bad" : ""}`}>
      {acc.name} balance <b>{money(bal[it.accountId])}</b>
      {dueSameAcc ? (
        <> · dues this month from it {money(dueSameAcc)} · {left < 0 ? <b>short by {money(-left)}</b> : <><b>{money(left)}</b> left after</>}</>
      ) : " · nothing pending this month"}
    </div>
  );
}

export function PaymentHistory({ l, it, pays }: { l: Ledger; it: SchedItem; pays: Txn[] }) {
  const { open } = useApp();
  if (!pays.length)
    return <div className="faint" style={{ fontSize: ".85rem" }}>No payments recorded here yet{it.paidBefore ? ` (${it.paidBefore} paid before you started tracking)` : ""}.</div>;
  return (
    <div className="list">
      {[...pays].sort((a, b) => (b.period || "").localeCompare(a.period || "")).map((p) => (
        <div className="li click" key={p.id} role="button" tabIndex={0} onClick={() => open(<TxnForm t={p} />)}>
          <div className="grow">
            <div className="t">{monthLabel(p.period || p.date.slice(0, 7))}</div>
            <div className="sub">
              Paid {fmtDate(p.date)} · {accName(l, p.accountId)}
              {it.kind === "chit" && Number(p.chitDue) > p.amount ? ` · dividend ${money(Number(p.chitDue) - p.amount)}` : ""}
            </div>
          </div>
          <div className="amt">{money(p.amount)}</div>
        </div>
      ))}
    </div>
  );
}
