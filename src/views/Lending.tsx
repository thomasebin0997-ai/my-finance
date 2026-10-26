import { useState } from "react";
import { daysBetween, debtStats, fmtDate, money } from "../../shared/finance";
import type { Debt, Ledger } from "../../shared/types";
import { Empty, ExampleChip, TxnRow } from "../components/ui";
import { useApp, useLedger } from "../state";
import { DebtForm, RepayForm } from "../forms/DebtForms";
import { TxnForm } from "../forms/TxnForm";

export function Lending() {
  const l = useLedger();
  const { open } = useApp();
  const rows = l.debts.map((d) => ({ d, s: debtStats(l, d) }));
  const active = rows.filter((r) => !r.s.settled);
  const settled = rows.filter((r) => r.s.settled);
  const owedToMe = active.filter((r) => r.d.direction === "lent").reduce((a, r) => a + r.s.outstanding, 0);
  const iOwe = active.filter((r) => r.d.direction === "borrowed").reduce((a, r) => a + r.s.outstanding, 0);

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="label">Others owe you</span><span className="v pos">{money(owedToMe)}</span><span className="s">{active.filter((r) => r.d.direction === "lent").length} people</span></div>
        <div className="kpi"><span className="label">You owe others</span><span className="v neg">{money(iOwe)}</span><span className="s">{active.filter((r) => r.d.direction === "borrowed").length} people</span></div>
        <div className="kpi" style={{ justifyContent: "center", gap: 8 }}>
          <button className="btn primary" type="button" onClick={() => open(<DebtForm direction="lent" />)}>Lend money</button>
          <button className="btn" type="button" onClick={() => open(<DebtForm direction="borrowed" />)}>Borrow money</button>
        </div>
      </div>
      {!active.length && (
        <div className="card">
          <Empty title="Nothing lent or borrowed">
            <span>Record money you give to or take from friends and family. Repayments update the balance, and you can set a date to be reminded. None of this counts as income or spending.</span>
          </Empty>
        </div>
      )}
      <div className="grid">{active.map(({ d }) => <DebtCard key={d.id} l={l} d={d} />)}</div>
      {settled.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Settled</h2></div>
          <div className="list">
            {settled.map(({ d, s }) => (
              <div className="li click" key={d.id} role="button" tabIndex={0} onClick={() => open(<DebtForm d={d} />)}>
                <div className="grow">
                  <div className="t">{d.person}<ExampleChip show={d.sample} /></div>
                  <div className="sub">{d.direction === "lent" ? "Lent" : "Borrowed"} {money(s.principal)} · repaid {money(s.repaid)}{d.note ? ` · ${d.note}` : ""}</div>
                </div>
                <span className="chip paid">Settled</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function DueChip({ due, today, soon }: { due: string; today: string; soon: number }) {
  const days = daysBetween(today, due);
  if (days < 0) return <span className="chip overdue">Overdue {-days}d</span>;
  if (days === 0) return <span className="chip soon">Due today</span>;
  return <span className={`chip ${days <= soon ? "soon" : "upcoming"}`}>Due {fmtDate(due)}</span>;
}

function DebtCard({ l, d }: { l: Ledger; d: Debt }) {
  const { today, open } = useApp();
  const [hist, setHist] = useState(false);
  const s = debtStats(l, d);
  const lent = d.direction === "lent";
  const pct = s.principal ? Math.min(100, (s.repaid / s.principal) * 100) : 0;
  return (
    <div className="card loan">
      <div className="loan-top">
        <div>
          <h2>{d.person}<ExampleChip show={d.sample} /></h2>
          <div className="muted">{lent ? "Owes you" : "You owe"}{d.note ? ` · ${d.note}` : ""}</div>
        </div>
        {d.dueDate ? <DueChip due={d.dueDate} today={today} soon={l.settings.reminderDays} /> : <span className="chip upcoming">No due date</span>}
      </div>
      <div className="facts">
        <div><span className="label">{lent ? "Lent" : "Borrowed"}</span><b>{money(s.principal)}</b></div>
        <div><span className="label">Repaid</span><b>{money(s.repaid)}</b></div>
        <div><span className="label">Outstanding</span><b className={lent ? "pos" : "neg"}>{money(s.outstanding)}</b></div>
      </div>
      <div className="progress"><i style={{ width: `${pct.toFixed(1)}%` }} /></div>
      <div className="actions">
        <button className="btn small primary" type="button" onClick={() => open(<RepayForm id={d.id} />)}>{lent ? "Received money" : "Repay"}</button>
        <button className="btn small" type="button" onClick={() => open(<RepayForm id={d.id} more />)}>{lent ? "Lend more" : "Borrow more"}</button>
        <button className="btn small" type="button" onClick={() => open(<DebtForm d={d} />)}>Edit</button>
        <button className="btn small ghost" type="button" onClick={() => setHist((h) => !h)}>{hist ? "Hide" : "Show"} entries ({s.pays.length})</button>
      </div>
      {hist && <div className="list">{s.pays.map((t) => <TxnRow key={t.id} t={t} l={l} onClick={() => open(<TxnForm t={t} />)} />)}</div>}
    </div>
  );
}
