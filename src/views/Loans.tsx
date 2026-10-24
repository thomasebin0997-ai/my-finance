import { useState } from "react";
import { chitStats, fmtDate, isActive, itemStats, money, monthLabel, ordinal, schedItems, sipStats } from "../../shared/finance";
import { CatDot, Empty, ExampleChip, StateChip, accName } from "../components/ui";
import { useApp, useLedger } from "../state";
import { ChitForm, EmiForm, PayForm, PrizeForm, SipForm } from "../forms/LoanForms";
import { AccountCheck, PaymentHistory } from "./shared";

export function Emis() {
  const l = useLedger();
  const { today, open } = useApp();
  const [hist, setHist] = useState<Record<string, boolean>>({});
  const tm = today.slice(0, 7);
  const items = schedItems(l).filter((i) => i.kind === "emi");
  const closed = l.emis.filter((e) => e.closed);
  const monthly = items.filter((it) => isActive(it, tm)).reduce((s, it) => s + it.amount, 0);
  const outstanding = items.reduce((s, it) => s + itemStats(l, it, today).remainingAmt, 0);

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="label">Monthly EMI outflow</span><span className="v">{money(monthly)}</span><span className="s">{items.length} active loans</span></div>
        <div className="kpi"><span className="label">EMIs still to pay</span><span className="v neg">{money(outstanding)}</span><span className="s">sum of remaining installments</span></div>
        <div className="kpi" style={{ justifyContent: "center" }}><button className="btn primary" type="button" onClick={() => open(<EmiForm />)}>Add EMI</button></div>
      </div>
      {!items.length && (
        <div className="card">
          <Empty title="No EMIs yet">
            <span>Add a home, car, personal or phone loan. You'll get a reminder {l.settings.reminderDays} days before each due date.</span>
            <button className="btn primary" type="button" onClick={() => open(<EmiForm />)}>Add EMI</button>
          </Empty>
        </div>
      )}
      <div className="grid">
        {items.map((it) => {
          const s = itemStats(l, it, today);
          const e = it.emi!;
          const pct = it.total ? Math.min(100, (s.paid / it.total) * 100) : 0;
          return (
            <div className="card loan" key={it.id}>
              <div className="loan-top">
                <div>
                  <h2>{e.name}<ExampleChip show={e.sample} /></h2>
                  <div className="muted">{e.lender ? `${e.lender} · ` : ""}due on the {ordinal(it.dueDay)}</div>
                </div>
                {s.next ? <StateChip st={s.nextStatus} /> : <span className="chip paid">All paid</span>}
              </div>
              <div className="facts">
                <div><span className="label">EMI</span><b>{money(it.amount)}</b></div>
                <div><span className="label">Paid</span><b>{s.paid} / {it.total}</b></div>
                <div><span className="label">Remaining</span><b>{s.remaining} EMIs</b></div>
                <div><span className="label">Balance to pay</span><b>{money(s.remainingAmt)}</b></div>
                {e.loanAmount > 0 && <div><span className="label">Loan amount</span><b>{money(e.loanAmount)}</b></div>}
                <div><span className="label">Last EMI</span><b>{monthLabel(s.end!, true)}</b></div>
              </div>
              <div className="progress"><i style={{ width: `${pct.toFixed(1)}%` }} /></div>
              <AccountCheck l={l} it={it} today={today} />
              <div className="actions">
                {s.next && <button className="btn small primary" type="button" onClick={() => open(<PayForm kind="emi" id={e.id} period={s.next!} />)}>Mark {monthLabel(s.next, true)} paid</button>}
                <button className="btn small" type="button" onClick={() => open(<EmiForm e={e} />)}>Edit</button>
                <button className="btn small ghost" type="button" onClick={() => setHist((h) => ({ ...h, [e.id]: !h[e.id] }))}>{hist[e.id] ? "Hide" : "Show"} payments ({s.pays.length})</button>
              </div>
              {hist[e.id] && <PaymentHistory l={l} it={it} pays={s.pays} />}
            </div>
          );
        })}
      </div>
      {closed.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Closed loans</h2></div>
          <div className="list">
            {closed.map((e) => (
              <div className="li click" key={e.id} role="button" tabIndex={0} onClick={() => open(<EmiForm e={e} />)}>
                <CatDot cat="EMI" />
                <div className="grow"><div className="t">{e.name}</div><div className="sub">{e.lender}</div></div>
                <span className="chip paid">Closed</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function Chitty() {
  const l = useLedger();
  const { today, open } = useApp();
  const [hist, setHist] = useState<Record<string, boolean>>({});
  const tm = today.slice(0, 7);
  const items = schedItems(l).filter((i) => i.kind === "chit");
  const stats = items.map((it) => chitStats(l, it, today));
  const monthly = items.filter((it) => isActive(it, tm)).reduce((s, it) => s + it.amount, 0);
  const totalPaid = stats.reduce((s, x) => s + x.totalPaid, 0);
  const div = stats.reduce((s, x) => s + x.dividend, 0);

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="label">Monthly installments</span><span className="v">{money(monthly)}</span><span className="s">{items.length} chitty</span></div>
        <div className="kpi"><span className="label">Paid in so far</span><span className="v">{money(totalPaid)}</span><span className="s">dividend earned {money(div)}</span></div>
        <div className="kpi" style={{ justifyContent: "center" }}><button className="btn primary" type="button" onClick={() => open(<ChitForm />)}>Add chitty</button></div>
      </div>
      {!items.length && (
        <div className="card">
          <Empty title="No chitty yet">
            <span>Add a KSFE or private chitty with its sala (chit value), monthly installment and number of months.</span>
            <button className="btn primary" type="button" onClick={() => open(<ChitForm />)}>Add chitty</button>
          </Empty>
        </div>
      )}
      <div className="grid">
        {items.map((it, i) => {
          const s = stats[i];
          const c = it.chit!;
          const pct = it.total ? Math.min(100, (s.paid / it.total) * 100) : 0;
          return (
            <div className="card loan" key={it.id}>
              <div className="loan-top">
                <div>
                  <h2>{c.name}<ExampleChip show={c.sample} /></h2>
                  <div className="muted">{c.company ? `${c.company} · ` : ""}due on the {ordinal(it.dueDay)}</div>
                </div>
                <div className="actions">
                  {s.prize ? <span className="chip gold">Prized</span> : <span className="chip upcoming">Non-prized</span>}
                  {s.next ? <StateChip st={s.nextStatus} /> : <span className="chip paid">Completed</span>}
                </div>
              </div>
              <div className="facts">
                <div><span className="label">Sala (chit value)</span><b>{money(c.chitValue)}</b></div>
                <div><span className="label">Installment</span><b>{money(it.amount)}</b></div>
                <div><span className="label">Paid</span><b>{s.paid} / {it.total}</b></div>
                <div><span className="label">Total paid</span><b>{money(s.totalPaid)}</b></div>
                <div><span className="label">Dividend earned</span><b className="pos">{money(s.dividend)}</b></div>
                <div><span className="label">Still to pay</span><b>{money(s.remainingAmt)}</b></div>
              </div>
              <div className="progress gold"><i style={{ width: `${pct.toFixed(1)}%` }} /></div>
              {s.prize ? (
                <div className="check">
                  Prize of <b>{money(s.prize.amount)}</b> received {fmtDate(s.prize.date)} in {accName(l, s.prize.accountId)}. Net so far:{" "}
                  <b className={s.prize.amount - s.totalPaid < 0 ? "neg" : "pos"}>{money(s.prize.amount - s.totalPaid)}</b>
                </div>
              ) : (
                <div className="check">If you take the prize (auction) you receive the sala minus the bid discount. Record it when the money arrives.</div>
              )}
              <AccountCheck l={l} it={it} today={today} />
              <div className="actions">
                {s.next && <button className="btn small primary" type="button" onClick={() => open(<PayForm kind="chit" id={c.id} period={s.next!} />)}>Pay {monthLabel(s.next, true)}</button>}
                {!s.prize && <button className="btn small" type="button" onClick={() => open(<PrizeForm id={c.id} />)}>Record prize</button>}
                <button className="btn small" type="button" onClick={() => open(<ChitForm c={c} />)}>Edit</button>
                <button className="btn small ghost" type="button" onClick={() => setHist((h) => ({ ...h, [c.id]: !h[c.id] }))}>{hist[c.id] ? "Hide" : "Show"} payments ({s.pays.length})</button>
              </div>
              {hist[c.id] && <PaymentHistory l={l} it={it} pays={s.pays} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Sips() {
  const l = useLedger();
  const { today, open } = useApp();
  const [hist, setHist] = useState<Record<string, boolean>>({});
  const tm = today.slice(0, 7);
  const items = schedItems(l).filter((i) => i.kind === "sip");
  const stats = items.map((it) => sipStats(l, it, today));
  const stopped = l.sips.filter((s) => s.stopped);
  const monthly = items.filter((it) => isActive(it, tm)).reduce((s, it) => s + it.amount, 0);
  const invested = stats.reduce((s, x) => s + x.invested, 0);

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="label">Monthly SIPs</span><span className="v">{money(monthly)}</span><span className="s">{items.length} active</span></div>
        <div className="kpi"><span className="label">Invested so far</span><span className="v pos">{money(invested)}</span><span className="s">amount put in, not current value</span></div>
        <div className="kpi" style={{ justifyContent: "center" }}><button className="btn primary" type="button" onClick={() => open(<SipForm />)}>Add SIP</button></div>
      </div>
      {!items.length && (
        <div className="card">
          <Empty title="No SIPs yet">
            <span>Add each mutual fund SIP with its amount and debit date. You'll get a reminder {l.settings.reminderDays} days before so the bank has enough balance.</span>
            <button className="btn primary" type="button" onClick={() => open(<SipForm />)}>Add SIP</button>
          </Empty>
        </div>
      )}
      <div className="grid">
        {items.map((it, i) => {
          const s = stats[i];
          const p = it.sip!;
          const pct = it.total ? Math.min(100, (s.paid / it.total) * 100) : 0;
          return (
            <div className="card loan" key={it.id}>
              <div className="loan-top">
                <div>
                  <h2>{p.name}<ExampleChip show={p.sample} /></h2>
                  <div className="muted">{p.platform ? `${p.platform} · ` : ""}debited on the {ordinal(it.dueDay)}</div>
                </div>
                {s.next ? <StateChip st={s.nextStatus} /> : <span className="chip paid">{it.total ? "Completed" : "Up to date"}</span>}
              </div>
              <div className="facts">
                <div><span className="label">Monthly</span><b>{money(it.amount)}</b></div>
                <div><span className="label">Installments</span><b>{it.total ? `${s.paid} / ${it.total}` : s.paid}</b></div>
                <div><span className="label">Invested</span><b className="pos">{money(s.invested)}</b></div>
                <div><span className="label">Started</span><b>{monthLabel(it.start, true)}</b></div>
                <div><span className="label">Ends</span><b>{s.end ? monthLabel(s.end, true) : "No end date"}</b></div>
              </div>
              {it.total > 0 && <div className="progress"><i style={{ width: `${pct.toFixed(1)}%` }} /></div>}
              <AccountCheck l={l} it={it} today={today} />
              <div className="actions">
                {s.next && <button className="btn small primary" type="button" onClick={() => open(<PayForm kind="sip" id={p.id} period={s.next!} />)}>Mark {monthLabel(s.next, true)} done</button>}
                <button className="btn small" type="button" onClick={() => open(<SipForm s={p} />)}>Edit</button>
                <button className="btn small ghost" type="button" onClick={() => setHist((h) => ({ ...h, [p.id]: !h[p.id] }))}>{hist[p.id] ? "Hide" : "Show"} installments ({s.pays.length})</button>
              </div>
              {hist[p.id] && <PaymentHistory l={l} it={it} pays={s.pays} />}
            </div>
          );
        })}
      </div>
      {stopped.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Stopped SIPs</h2></div>
          <div className="list">
            {stopped.map((p) => (
              <div className="li click" key={p.id} role="button" tabIndex={0} onClick={() => open(<SipForm s={p} />)}>
                <CatDot cat="SIP" />
                <div className="grow"><div className="t">{p.name}</div><div className="sub">{p.platform}</div></div>
                <span className="chip paid">Stopped</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
