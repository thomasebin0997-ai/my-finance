import { balances, groupBy, isEarn, isSpend, money, monthLabel, sumAmt } from "../../shared/finance";
import type { Txn } from "../../shared/types";
import { Empty, accTypeLabel } from "../components/ui";
import { useApp, useLedger } from "../state";
import { NoAccounts } from "./shared";

function CategoryBars({ list, total, cls, label }: { list: Txn[]; total: number; cls: string; label: string }) {
  const g = groupBy(list, "category");
  if (!g.length) return <Empty><span>Nothing recorded for {label}.</span></Empty>;
  const mx = g[0][1];
  return (
    <div className="bars">
      {g.map(([c, v]) => (
        <div className="bar-row" key={c}>
          <span className="n">{c} <span className="faint">· {list.filter((t) => (t.category || "Other") === c).length}</span></span>
          <b>{money(v)} <span className="faint" style={{ fontWeight: 400 }}>{Math.round((v / total) * 100)}%</span></b>
          <div className="bar-track"><div className={`bar-fill ${cls}`} style={{ width: `${((v / mx) * 100).toFixed(1)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Reports() {
  const l = useLedger();
  const { month: M, report: R, setReport } = useApp();
  if (!l.accounts.length) return <NoAccounts />;

  const inPeriod = (t: Txn) => (R.period === "year" ? t.date.slice(0, 4) === M.slice(0, 4) : t.date.slice(0, 7) === M);
  const rows = l.txns.filter((t) => inPeriod(t) && (R.account === "all" || t.accountId === R.account || t.toAccountId === R.account));
  const label = R.period === "year" ? M.slice(0, 4) : monthLabel(M);
  const mine = (t: Txn) => R.account === "all" || t.accountId === R.account;
  const ex = rows.filter((t) => isSpend(t) && mine(t));
  const inc = rows.filter((t) => isEarn(t) && mine(t));
  const exT = sumAmt(ex), inT = sumAmt(inc);
  const accs = R.account === "all" ? l.accounts : l.accounts.filter((a) => a.id === R.account);
  const g = groupBy(ex, "category");
  const bal = balances(l);

  return (
    <>
      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="seg">
          <button type="button" className={R.period === "month" ? "on" : ""} onClick={() => setReport({ period: "month" })}>Month</button>
          <button type="button" className={R.period === "year" ? "on" : ""} onClick={() => setReport({ period: "year" })}>Year {M.slice(0, 4)}</button>
        </div>
        <div className="filters">
          <select id="r-account" value={R.account} onChange={(e) => setReport({ account: e.target.value })} aria-label="Account">
            <option value="all">All accounts</option>
            {l.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="label">Income · {label}</span><span className="v pos">{money(inT)}</span></div>
        <div className="kpi"><span className="label">Spent · {label}</span><span className="v neg">{money(exT)}</span></div>
        <div className="kpi"><span className="label">Net</span><span className="v">{money(inT - exT)}</span></div>
      </div>

      <div className="grid">
        <div className="card"><div className="card-h"><h2>Spending by category</h2></div><CategoryBars list={ex} total={exT} cls="" label={label} /></div>
        <div className="card"><div className="card-h"><h2>Income by category</h2></div><CategoryBars list={inc} total={inT} cls="inc" label={label} /></div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Category by bank</h2><span className="muted">Spending · {label}</span></div>
        {!g.length ? <Empty><span>No spending for {label}.</span></Empty> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Category</th>{accs.map((a) => <th className="num" key={a.id}>{a.name}</th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {g.map(([c, v]) => (
                  <tr key={c}>
                    <td>{c}</td>
                    {accs.map((a) => {
                      const s = sumAmt(ex.filter((t) => (t.category || "Other") === c && t.accountId === a.id));
                      return <td key={a.id} className={`num${s ? "" : " faint"}`}>{s ? money(s) : "–"}</td>;
                    })}
                    <td className="num"><b>{money(v)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Total spent</td>{accs.map((a) => <td className="num" key={a.id}>{money(sumAmt(ex.filter((t) => t.accountId === a.id)))}</td>)}<td className="num">{money(exT)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h"><h2>Bank-wise money in & out</h2><span className="muted">{label}</span></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Account</th><th className="num">Money in</th><th className="num">Money out</th><th className="num">Net</th><th className="num">Balance today</th></tr></thead>
            <tbody>
              {accs.map((a) => {
                const i = sumAmt(rows.filter((t) => (t.type === "income" && t.accountId === a.id) || (t.type === "transfer" && t.toAccountId === a.id)));
                const o = sumAmt(rows.filter((t) => (t.type === "expense" || t.type === "transfer") && t.accountId === a.id));
                return (
                  <tr key={a.id}>
                    <td>{a.name} <span className="faint">· {accTypeLabel(a)}</span></td>
                    <td className="num pos">{money(i)}</td>
                    <td className="num neg">{money(o)}</td>
                    <td className="num">{money(i - o)}</td>
                    <td className="num"><b>{money(bal[a.id])}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
