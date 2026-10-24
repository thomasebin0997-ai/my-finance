import { useRef, useState } from "react";
import type { Chit, Emi, Sip } from "../../shared/types";
import { dueDateFor, fmtDate, idxOf, monthDiff, monthLabel, money, schedItems, unpaidPeriods, type SchedKind } from "../../shared/finance";
import { AccountOptions, Field } from "../components/ui";
import { useActions, useApp, useLedger } from "../state";
import { ConfirmDelete, Foot, NeedAccount, Notice, useSubmit } from "./common";

const isMonth = (s: string) => /^\d{4}-\d{2}$/.test(s);

/** For a new loan/chitty: suggest "already paid" = months before this one, until the user edits it. */
function usePaidBeforeSuggestion(today: string, enabled: boolean, initial: number) {
  const touched = useRef(false);
  const [value, setValue] = useState<string>(String(initial));
  const suggest = (start: string, total: number) => {
    if (!enabled || touched.current || !isMonth(start)) return;
    setValue(String(Math.max(0, Math.min(total || 0, monthDiff(start, today.slice(0, 7))))));
  };
  return {
    value,
    suggest,
    onInput: (v: string) => {
      touched.current = true;
      setValue(v);
    },
  };
}

export function EmiForm({ e }: { e?: Emi }) {
  const l = useLedger();
  const { today, open, toast } = useApp();
  const act = useActions();
  const pb = usePaidBeforeSuggestion(today, !e, e?.paidBefore ?? 0);
  const startRef = useRef<HTMLInputElement>(null);
  const tenRef = useRef<HTMLInputElement>(null);
  const { busy, onSubmit } = useSubmit((f) => {
    if (!isMonth(f.startDate)) return toast("Enter the first EMI month as YYYY-MM."), false;
    return act.save(
      "emis",
      {
        id: e?.id,
        name: f.name.trim(),
        lender: (f.lender || "").trim(),
        emi: Number(f.emi),
        dueDay: Number(f.dueDay),
        startDate: f.startDate,
        tenure: Number(f.tenure),
        paidBefore: Number(f.paidBefore) || 0,
        loanAmount: Number(f.loanAmount) || 0,
        accountId: f.accountId || null,
        closed: f.closed === "on",
        sample: e?.sample ?? false,
      },
      e ? "EMI updated" : "EMI added",
    );
  });
  if (!l.accounts.length) return <NeedAccount what="EMIs" />;
  const refresh = () => pb.suggest(startRef.current?.value ?? "", Number(tenRef.current?.value));

  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{e ? "Edit EMI" : "New EMI"}</h2>
      <div className="f-row">
        <Field label="Loan name"><input id="e-name" name="name" required maxLength={60} placeholder="e.g. Car loan" defaultValue={e?.name} autoFocus /></Field>
        <Field label="Lender"><input id="e-lender" name="lender" maxLength={60} placeholder="e.g. SBI, Bajaj Finance" defaultValue={e?.lender} /></Field>
      </div>
      <div className="f-row">
        <Field label="Monthly EMI (₹)"><input id="e-emi" name="emi" type="number" step="0.01" min="1" required defaultValue={e?.emi} /></Field>
        <Field label="Due day of month"><input id="e-day" name="dueDay" type="number" min="1" max="31" required defaultValue={e?.dueDay ?? 5} /></Field>
      </div>
      <div className="f-row">
        <Field label="First EMI month">
          <input id="e-start" ref={startRef} name="startDate" type="month" required pattern="\d{4}-\d{2}" placeholder="YYYY-MM" defaultValue={e?.startDate ?? today.slice(0, 7)} onChange={refresh} />
        </Field>
        <Field label="Tenure (months)"><input id="e-ten" ref={tenRef} name="tenure" type="number" min="1" max="600" required defaultValue={e?.tenure ?? 12} onChange={refresh} /></Field>
      </div>
      <div className="f-row">
        <Field label="EMIs already paid" hint="Paid before you started tracking here.">
          <input id="e-pb" name="paidBefore" type="number" min="0" value={pb.value} onChange={(ev) => pb.onInput(ev.target.value)} />
        </Field>
        <Field label="Loan amount (₹)"><input id="e-loan" name="loanAmount" type="number" step="1" min="0" placeholder="Optional" defaultValue={e?.loanAmount || ""} /></Field>
      </div>
      <Field label="Paid from">
        <select id="e-acc" name="accountId" defaultValue={e?.accountId ?? undefined}><AccountOptions l={l} /></select>
      </Field>
      {e && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input id="e-closed" type="checkbox" name="closed" defaultChecked={e.closed} /> Loan closed (hide from reminders)
        </label>
      )}
      <Foot busy={busy} onDelete={e ? () => open(<ConfirmDelete col="emis" id={e.id} />) : undefined} />
    </form>
  );
}

export function ChitForm({ c }: { c?: Chit }) {
  const l = useLedger();
  const { today, open, toast } = useApp();
  const act = useActions();
  const pb = usePaidBeforeSuggestion(today, !c, c?.paidBefore ?? 0);
  const startRef = useRef<HTMLInputElement>(null);
  const monRef = useRef<HTMLInputElement>(null);
  const { busy, onSubmit } = useSubmit((f) => {
    if (!isMonth(f.startDate)) return toast("Enter the first installment month as YYYY-MM."), false;
    return act.save(
      "chits",
      {
        id: c?.id,
        name: f.name.trim(),
        company: (f.company || "").trim(),
        chitValue: Number(f.chitValue),
        installment: Number(f.installment),
        months: Number(f.months),
        dueDay: Number(f.dueDay),
        startDate: f.startDate,
        accountId: f.accountId || null,
        paidBefore: Number(f.paidBefore) || 0,
        paidBeforeAmount: f.paidBeforeAmount === "" ? null : Number(f.paidBeforeAmount),
        sample: c?.sample ?? false,
      },
      c ? "Chitty updated" : "Chitty added",
    );
  });
  if (!l.accounts.length) return <NeedAccount what="Chitty installments" />;
  const refresh = () => pb.suggest(startRef.current?.value ?? "", Number(monRef.current?.value));

  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{c ? "Edit chitty" : "New chitty"}</h2>
      <div className="f-row">
        <Field label="Name"><input id="c-name" name="name" required maxLength={60} placeholder="e.g. KSFE 5 lakh chitty" defaultValue={c?.name} autoFocus /></Field>
        <Field label="Company / foreman"><input id="c-co" name="company" maxLength={60} placeholder="e.g. KSFE Kakkanad" defaultValue={c?.company} /></Field>
      </div>
      <div className="f-row">
        <Field label="Sala / chit value (₹)"><input id="c-val" name="chitValue" type="number" min="1" required defaultValue={c?.chitValue} /></Field>
        <Field label="Monthly installment (₹)" hint="Full installment before dividend."><input id="c-inst" name="installment" type="number" step="0.01" min="1" required defaultValue={c?.installment} /></Field>
      </div>
      <div className="f-row">
        <Field label="Number of months"><input id="c-mon" ref={monRef} name="months" type="number" min="1" max="300" required defaultValue={c?.months ?? 40} onChange={refresh} /></Field>
        <Field label="Due day of month"><input id="c-day" name="dueDay" type="number" min="1" max="31" required defaultValue={c?.dueDay ?? 10} /></Field>
      </div>
      <div className="f-row">
        <Field label="First installment month">
          <input id="c-start" ref={startRef} name="startDate" type="month" required pattern="\d{4}-\d{2}" placeholder="YYYY-MM" defaultValue={c?.startDate ?? today.slice(0, 7)} onChange={refresh} />
        </Field>
        <Field label="Paid from"><select id="c-acc" name="accountId" defaultValue={c?.accountId ?? undefined}><AccountOptions l={l} /></select></Field>
      </div>
      <div className="f-row">
        <Field label="Installments already paid">
          <input id="c-pb" name="paidBefore" type="number" min="0" value={pb.value} onChange={(ev) => pb.onInput(ev.target.value)} />
        </Field>
        <Field label="Amount paid for those (₹)" hint="After dividends. Leave blank to assume full installments.">
          <input id="c-pba" name="paidBeforeAmount" type="number" step="0.01" min="0" placeholder="Optional" defaultValue={c?.paidBeforeAmount ?? ""} />
        </Field>
      </div>
      <Foot busy={busy} onDelete={c ? () => open(<ConfirmDelete col="chits" id={c.id} />) : undefined} />
    </form>
  );
}

const PAY_TITLE: Record<SchedKind, string> = { emi: "Record EMI payment", chit: "Pay chitty installment", sip: "Record SIP installment", card: "Pay credit card bill" };
const PAY_CAT: Record<SchedKind, string> = { emi: "EMI", chit: "Chitty", sip: "SIP", card: "Transfer" };

export function PayForm({ kind, id, period }: { kind: SchedKind; id: string; period?: string }) {
  const l = useLedger();
  const { today, toast } = useApp();
  const act = useActions();
  const it = schedItems(l).find((x) => x.kind === kind && x.id === id);
  const [amt, setAmt] = useState(String(it?.amount || ""));
  const { busy, onSubmit } = useSubmit((f) => {
    if (!it) return false;
    const amount = Number(f.amount);
    if (!(amount > 0)) return toast("Enter an amount above zero."), false;
    if (kind === "card" && f.accountId === id) return toast("Pick the bank account you paid the bill from."), false;
    return act.save(
      "txns",
      {
        // A card bill moves money from the bank to the card; the purchases were already counted as expenses.
        type: kind === "card" ? "transfer" : "expense",
        amount,
        date: f.date,
        accountId: f.accountId,
        toAccountId: kind === "card" ? id : null,
        category: PAY_CAT[kind],
        note: kind === "card" ? `${it.name} bill · ${monthLabel(f.period, true)}` : `${it.name} · ${monthLabel(f.period, true)}`,
        kind,
        emiId: kind === "emi" ? id : null,
        chitId: kind === "chit" ? id : null,
        sipId: kind === "sip" ? id : null,
        period: f.period,
        chitDue: kind === "chit" ? it.amount : null,
        sample: false,
      },
      kind === "card" ? `${it.name} bill payment saved` : `${it.name} marked paid for ${monthLabel(f.period, true)}`,
    );
  });
  if (!it) return <Notice title="Not found">This item no longer exists.</Notice>;
  const periods = unpaidPeriods(l, it, today);
  if (period && !periods.includes(period)) periods.unshift(period);
  if (!periods.length) return <Notice title="Nothing due">{kind === "card" ? `Nothing is owed on ${it.name} right now.` : `All installments for ${it.name} are recorded.`}</Notice>;
  const dividend = Math.max(0, it.amount - (Number(amt) || 0));

  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{PAY_TITLE[kind]}</h2>
      <div className="muted">{it.name}{it.sub ? ` · ${it.sub}` : ""}</div>
      <div className="f-row">
        <Field label={kind === "card" ? "Bill due" : "For month"}>
          <select id="p-period" name="period" defaultValue={period ?? periods[0]}>
            {periods.map((m) => <option key={m} value={m}>{kind === "card" ? fmtDate(dueDateFor(m, it.dueDay)) : `${monthLabel(m)} · #${idxOf(it, m)}`}</option>)}
          </select>
        </Field>
        <Field label="Paid on"><input id="p-date" name="date" type="date" required defaultValue={today} /></Field>
      </div>
      <div className="f-row">
        <Field label={kind === "chit" ? "Amount actually paid (₹)" : "Amount (₹)"} hint={kind === "card" ? `Outstanding ${money(it.amount)}. Enter the minimum due or what you actually paid.` : undefined}>
          <input id="p-amt" name="amount" type="number" step="0.01" min="0.01" required value={amt} onChange={(e) => setAmt(e.target.value)} />
        </Field>
        <Field label="Paid from"><select id="p-acc" name="accountId" defaultValue={it.accountId ?? undefined}><AccountOptions l={l} exclude={kind === "card" ? id : undefined} /></select></Field>
      </div>
      {kind === "chit" && <div className="calc">Installment {money(it.amount)} · dividend {money(dividend)}</div>}
      <Foot busy={busy} label="Mark paid" />
    </form>
  );
}

export function PrizeForm({ id }: { id: string }) {
  const l = useLedger();
  const { today } = useApp();
  const act = useActions();
  const c = l.chits.find((x) => x.id === id);
  const { busy, onSubmit } = useSubmit((f) =>
    act.save(
      "txns",
      {
        type: "income",
        amount: Number(f.amount),
        date: f.date,
        accountId: f.accountId,
        toAccountId: null,
        category: "Chitty prize",
        note: `${c?.name ?? "Chitty"} prize`,
        kind: "chitprize",
        emiId: null,
        chitId: id,
        sipId: null,
        period: null,
        chitDue: null,
        sample: false,
      },
      "Prize recorded",
    ),
  );
  if (!c) return <Notice title="Not found">This chitty no longer exists.</Notice>;
  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>Record chitty prize</h2>
      <div className="muted">{c.name} · sala {money(c.chitValue)}</div>
      <div className="f-row">
        <Field label="Amount received (₹)" hint="Sala minus the auction discount and foreman's commission.">
          <input id="z-amt" name="amount" type="number" step="0.01" min="1" required defaultValue={c.chitValue} autoFocus />
        </Field>
        <Field label="Received on"><input id="z-date" name="date" type="date" required defaultValue={today} /></Field>
      </div>
      <Field label="Into account"><select id="z-acc" name="accountId" defaultValue={c.accountId ?? undefined}><AccountOptions l={l} /></select></Field>
      <Foot busy={busy} label="Save prize" />
    </form>
  );
}

export function SipForm({ s }: { s?: Sip }) {
  const l = useLedger();
  const { today, open, toast } = useApp();
  const act = useActions();
  const pb = usePaidBeforeSuggestion(today, !s, s?.paidBefore ?? 0);
  const startRef = useRef<HTMLInputElement>(null);
  const monRef = useRef<HTMLInputElement>(null);
  const { busy, onSubmit } = useSubmit((f) => {
    if (!isMonth(f.startDate)) return toast("Enter the first installment month as YYYY-MM."), false;
    return act.save(
      "sips",
      {
        id: s?.id,
        name: f.name.trim(),
        platform: (f.platform || "").trim(),
        amount: Number(f.amount),
        dueDay: Number(f.dueDay),
        startDate: f.startDate,
        months: Number(f.months) || 0,
        paidBefore: Number(f.paidBefore) || 0,
        investedBefore: f.investedBefore === "" ? null : Number(f.investedBefore),
        accountId: f.accountId || null,
        stopped: f.stopped === "on",
        sample: s?.sample ?? false,
      },
      s ? "SIP updated" : "SIP added",
    );
  });
  if (!l.accounts.length) return <NeedAccount what="SIP installments" />;
  // Without an end date, suggest up to this month.
  const refresh = () => pb.suggest(startRef.current?.value ?? "", Number(monRef.current?.value) || 600);

  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{s ? "Edit SIP" : "New SIP"}</h2>
      <div className="f-row">
        <Field label="Fund / scheme"><input id="s-name" name="name" required maxLength={60} placeholder="e.g. Parag Parikh Flexi Cap" defaultValue={s?.name} autoFocus /></Field>
        <Field label="Platform"><input id="s-plat" name="platform" maxLength={60} placeholder="e.g. Zerodha Coin, Groww" defaultValue={s?.platform} /></Field>
      </div>
      <div className="f-row">
        <Field label="Monthly amount (₹)" hint="For a step-up SIP, edit this when the amount goes up."><input id="s-amt" name="amount" type="number" step="0.01" min="1" required defaultValue={s?.amount} /></Field>
        <Field label="Debit day of month"><input id="s-day" name="dueDay" type="number" min="1" max="31" required defaultValue={s?.dueDay ?? 5} /></Field>
      </div>
      <div className="f-row">
        <Field label="First installment month">
          <input id="s-start" ref={startRef} name="startDate" type="month" required pattern="\d{4}-\d{2}" placeholder="YYYY-MM" defaultValue={s?.startDate ?? today.slice(0, 7)} onChange={refresh} />
        </Field>
        <Field label="Number of months" hint="Leave blank if it has no end date.">
          <input id="s-mon" ref={monRef} name="months" type="number" min="0" max="600" placeholder="No end date" defaultValue={s?.months || ""} onChange={refresh} />
        </Field>
      </div>
      <div className="f-row">
        <Field label="Installments already done" hint="Before you started tracking here.">
          <input id="s-pb" name="paidBefore" type="number" min="0" value={pb.value} onChange={(ev) => pb.onInput(ev.target.value)} />
        </Field>
        <Field label="Amount invested in those (₹)" hint="Leave blank to assume the current amount each month.">
          <input id="s-ib" name="investedBefore" type="number" step="0.01" min="0" placeholder="Optional" defaultValue={s?.investedBefore ?? ""} />
        </Field>
      </div>
      <Field label="Debited from"><select id="s-acc" name="accountId" defaultValue={s?.accountId ?? undefined}><AccountOptions l={l} /></select></Field>
      {s && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input id="s-stopped" type="checkbox" name="stopped" defaultChecked={s.stopped} /> SIP stopped (hide from reminders)
        </label>
      )}
      <Foot busy={busy} onDelete={s ? () => open(<ConfirmDelete col="sips" id={s.id} />) : undefined} />
    </form>
  );
}
