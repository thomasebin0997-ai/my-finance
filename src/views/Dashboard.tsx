import { useEffect, useState } from "react";
import { balances, compact, groupBy, idxOf, money, monthDiff, monthLabel, monthTxns, addMonths, ordinal, reminders, schedItems, status, sumAmt } from "../../shared/finance";
import type { Ledger } from "../../shared/types";
import { AccDot, BellIcon, CatDot, Empty, StateChip, TxnRow, accName } from "../components/ui";
import { useApp, useLedger } from "../state";
import { PayForm } from "../forms/LoanForms";
import { TxnForm } from "../forms/TxnForm";
import { EmiForm, ChitForm } from "../forms/LoanForms";
import { NoAccounts } from "./shared";

export function Dashboard() {
  const l = useLedger();
  const { month: M, today, open, go, setFilter } = useApp();
  if (!l.accounts.length) return <NoAccounts />;

  const TM = today.slice(0, 7);
  const mt = monthTxns(l, M);
  const incRows = mt.filter((t) => t.type === "income");
  const expRows = mt.filter((t) => t.type === "expense");
  const inc = sumAmt(incRows);
  const exp = sumAmt(expRows);
  const bal = balances(l);
  const total = Object.values(bal).reduce((a, b) => a + b, 0);
  const rem = reminders(l, today);
  const dues = schedItems(l)
    .map((it) => ({ it, st: status(l, it, M, today) }))
    .filter((x): x is { it: (typeof x)["it"]; st: NonNullable<(typeof x)["st"]> } => !!x.st)
    .sort((a, b) => a.st.due.localeCompare(b.st.due));
  const pending = dues.filter((x) => x.st.state !== "paid").reduce((s, x) => s + x.it.amount, 0);
  const cats = groupBy(expRows, "category");
  const cmax = cats[0]?.[1] || 1;
  const recent = [...l.txns].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 6);

  return (
    <>
      {rem.length > 0 && (
        <div className="alert warn">
          <div className="alert-h"><BellIcon />Payment reminder · due within {l.settings.reminderDays} days</div>
          {rem.map((r) => (
            <div className="row" key={r.it.kind + r.it.id + r.m}>
              <div>
                <b>{r.it.name}</b>{" "}
                <span className="muted">{r.it.kind === "emi" ? "EMI" : "Chitty"} · {monthLabel(r.m, true)} · {money(r.it.amount)} from {accName(l, r.it.accountId)}</span>
              </div>
              <div className="actions">
                <StateChip st={r.st} />
                <button className="btn small primary" type="button" onClick={() => open(<PayForm kind={r.it.kind} id={r.it.id} period={r.m} />)}>Mark paid</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="kpis">
        <div className="kpi hero"><span className="label">Balance in all accounts</span><span className="v">{money(total)}</span><span className="s">{l.accounts.length} accounts · as of today</span></div>
        <div className="kpi"><span className="label">Income · {monthLabel(M, true)}</span><span className="v pos">{money(inc)}</span><span className="s">{plural(incRows.length, "entry", "entries")}</span></div>
        <div className="kpi"><span className="label">Spent · {monthLabel(M, true)}</span><span className="v neg">{money(exp)}</span><span className="s">{plural(expRows.length, "entry", "entries")}, incl. EMI & chitty</span></div>
        <div className="kpi"><span className="label">Saved this month</span><span className="v">{money(inc - exp)}</span><span className="s">{inc > 0 ? `${Math.round(((inc - exp) / inc) * 100)}% of income` : "No income recorded"}</span></div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-h"><h2>EMIs & chitty · {monthLabel(M, true)}</h2><span className="muted">{money(pending)} still to pay</span></div>
          {!dues.length ? (
            <Empty>
              <span>No EMIs or chitty installments fall in this month.</span>
              <div className="actions">
                <button className="btn small" type="button" onClick={() => open(<EmiForm />)}>Add EMI</button>
                <button className="btn small" type="button" onClick={() => open(<ChitForm />)}>Add chitty</button>
              </div>
            </Empty>
          ) : (
            <>
              <div className="list">
                {dues.map(({ it, st }) => (
                  <div className="li" key={it.kind + it.id}>
                    <CatDot cat={it.kind === "emi" ? "EMI" : "Chitty"} />
                    <div className="grow">
                      <div className="t">{it.name}</div>
                      <div className="sub">{ordinal(it.dueDay)} · {accName(l, it.accountId)} · installment {idxOf(it, M)} of {it.total}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span className="amt">{money(it.amount)}</span>
                      {st.state === "paid" ? <StateChip st={st} /> : (
                        <button className="btn small" type="button" onClick={() => open(<PayForm kind={it.kind} id={it.id} period={M} />)}><StateChip st={st} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {monthDiff(TM, M) >= 0 && (
                <div className="calc" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span>Balance after paying the remaining dues</span>
                  <b className={total - pending < 0 ? "neg" : ""}>{money(total - pending)}</b>
                </div>
              )}
            </>
          )}
        </div>

        <div className="card">
          <div className="card-h"><h2>Where the money went</h2><button className="btn small ghost" type="button" onClick={() => go("reports")}>All categories</button></div>
          {cats.length ? (
            <div className="bars">
              {cats.slice(0, 7).map(([c, v]) => (
                <div className="bar-row" key={c}>
                  <span className="n">{c}</span>
                  <b>{money(v)} <span className="faint" style={{ fontWeight: 400 }}>{Math.round((v / exp) * 100)}%</span></b>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${((v / cmax) * 100).toFixed(1)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <Empty><span>No spending recorded for {monthLabel(M)}.</span></Empty>}
        </div>
      </div>

      <div className="grid">
        <TrendChart l={l} M={M} />
        <div className="card">
          <div className="card-h"><h2>Bank-wise</h2><button className="btn small ghost" type="button" onClick={() => go("accounts")}>Manage</button></div>
          <div className="list">
            {l.accounts.map((a) => {
              const ai = sumAmt(mt.filter((t) => (t.type === "income" && t.accountId === a.id) || (t.type === "transfer" && t.toAccountId === a.id)));
              const ao = sumAmt(mt.filter((t) => (t.type === "expense" || t.type === "transfer") && t.accountId === a.id));
              return (
                <div className="li click" key={a.id} role="button" tabIndex={0} onClick={() => { setFilter({ account: a.id }); go("transactions"); }}>
                  <AccDot a={a} />
                  <div className="grow">
                    <div className="t">{a.name}</div>
                    <div className="sub"><span className="pos">+{money(ai)}</span> · <span className="neg">−{money(ao)}</span> this month</div>
                  </div>
                  <div className={`amt ${bal[a.id] < 0 ? "neg" : ""}`}>{money(bal[a.id])}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Latest entries</h2><button className="btn small ghost" type="button" onClick={() => go("transactions")}>See all</button></div>
        {recent.length ? (
          <div className="list">{recent.map((t) => <TxnRow key={t.id} t={t} l={l} onClick={() => open(<TxnForm t={t} />)} />)}</div>
        ) : (
          <Empty title="No entries yet">
            <span>Add your salary, a grocery bill or a transfer to start.</span>
            <button className="btn primary" type="button" onClick={() => open(<TxnForm />)}>Add entry</button>
          </Empty>
        )}
      </div>
    </>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function useNarrow(query = "(max-width: 520px)") {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function TrendChart({ l, M }: { l: Ledger; M: string }) {
  const months = [5, 4, 3, 2, 1, 0].map((i) => addMonths(M, -i));
  const data = months.map((m) => {
    const t = monthTxns(l, m);
    return { m, inc: sumAmt(t.filter((x) => x.type === "income")), exp: sumAmt(t.filter((x) => x.type === "expense")) };
  });
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.inc, d.exp))));
  const narrow = useNarrow();
  const W = narrow ? 340 : 560, H = narrow ? 200 : 210, L = 44, R = 6, T = 10, B = 26;
  const cw = (W - L - R) / 6;
  const bw = Math.min(18, cw * 0.28);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return (
    <div className="card">
      <div className="card-h">
        <h2>Last 6 months</h2>
        <div className="legend"><span><i style={{ background: "var(--pos)" }} />Income</span><span><i style={{ background: "var(--neg)" }} />Spent</span></div>
      </div>
      <div className="tbl-wrap">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label="Income and spending, last six months">
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (max * i) / 4, yy = y(v);
            return (
              <g key={i}>
                <line className="grid-l" x1={L} x2={W - R} y1={yy} y2={yy} />
                <text x={L - 8} y={yy + 4} textAnchor="end">{compact(v)}</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const cx = L + cw * i + cw / 2;
            return (
              <g key={d.m}>
                <rect x={cx - bw - 2} y={y(d.inc)} width={bw} height={Math.max(0, y(0) - y(d.inc))} rx={3} fill="var(--pos)"><title>Income {money(d.inc)}</title></rect>
                <rect x={cx + 2} y={y(d.exp)} width={bw} height={Math.max(0, y(0) - y(d.exp))} rx={3} fill="var(--neg)" opacity={0.85}><title>Spent {money(d.exp)}</title></rect>
                <text x={cx} y={H - 8} textAnchor="middle" style={d.m === M ? { fill: "var(--ink)", fontWeight: 600 } : undefined}>{monthLabel(d.m, true).split(" ")[0]}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
