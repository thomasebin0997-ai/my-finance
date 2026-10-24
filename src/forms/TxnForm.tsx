import { useState } from "react";
import { SYS_EXP, SYS_INC, type Txn, type TxnType } from "../../shared/types";
import { monthLabel } from "../../shared/finance";
import { AccountOptions, Field } from "../components/ui";
import { useActions, useApp, useLedger } from "../state";
import { ConfirmDelete, Foot, NeedAccount, useSubmit } from "./common";

export function TxnForm({ t }: { t?: Txn }) {
  const l = useLedger();
  const { today, filter, open, toast } = useApp();
  const act = useActions();
  const [type, setType] = useState<TxnType>(t?.type ?? "expense");
  const locked = !!t?.kind; // EMI / chitty payments keep their type

  const { busy, onSubmit } = useSubmit((f) => {
    const ty = locked ? t!.type : type;
    const amount = Number(f.amount);
    if (!(amount > 0)) return toast("Enter an amount above zero."), false;
    if (ty === "transfer" && f.accountId === f.toAccountId) return toast("Pick two different accounts for a transfer."), false;
    return act.save(
      "txns",
      {
        id: t?.id,
        type: ty,
        amount,
        date: f.date,
        accountId: f.accountId,
        toAccountId: ty === "transfer" ? f.toAccountId : null,
        category: ty === "transfer" ? "Transfer" : f.category || "Other",
        note: (f.note || "").trim(),
        kind: t?.kind ?? null,
        emiId: t?.emiId ?? null,
        chitId: t?.chitId ?? null,
        period: t?.period ?? null,
        chitDue: t?.chitDue ?? null,
        sample: t?.sample ?? false,
      },
      t ? "Entry updated" : "Entry added",
    );
  });

  if (!l.accounts.length) return <NeedAccount what="Entries" />;

  const cats = type === "income" ? [...l.settings.incomeCats, ...SYS_INC] : [...l.settings.expenseCats, ...SYS_EXP];
  if (t?.category && type === t.type && !cats.includes(t.category)) cats.push(t.category);
  const linked = t?.kind === "emi" ? l.emis.find((e) => e.id === t.emiId) : t?.kind ? l.chits.find((c) => c.id === t.chitId) : undefined;
  const defAcc = t?.accountId ?? (filter.account !== "all" ? filter.account : l.accounts[0].id);

  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{t ? "Edit entry" : "New entry"}</h2>
      {linked && (
        <div className="calc">
          Linked to <b>{linked.name}</b>{t?.period ? ` · ${monthLabel(t.period)}` : ""}.
        </div>
      )}
      <div className="seg" role="radiogroup" aria-label="Entry type">
        {(["expense", "income", "transfer"] as TxnType[]).map((x) => (
          <label key={x}>
            <input type="radio" name="type" value={x} checked={type === x} disabled={locked} onChange={() => setType(x)} />
            <span>{x[0].toUpperCase() + x.slice(1)}</span>
          </label>
        ))}
      </div>
      <div className="f-row">
        <Field label="Amount (₹)">
          <input id="t-amount" name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" required defaultValue={t?.amount ?? ""} autoFocus />
        </Field>
        <Field label="Date">
          <input id="t-date" name="date" type="date" required defaultValue={t?.date ?? today} />
        </Field>
      </div>
      <div className="f-row">
        <Field label={type === "income" ? "Into account" : "From account"}>
          <select id="t-acc" name="accountId" required defaultValue={defAcc ?? undefined}>
            <AccountOptions l={l} />
          </select>
        </Field>
        {type === "transfer" ? (
          <Field label="To account">
            <select id="t-to" name="toAccountId" defaultValue={t?.toAccountId ?? l.accounts.find((a) => a.id !== defAcc)?.id}>
              <AccountOptions l={l} />
            </select>
          </Field>
        ) : (
          <Field label="Category">
            <select id="t-cat" name="category" key={type} defaultValue={t?.type === type ? t.category : undefined}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label="Note">
        <input id="t-note" name="note" maxLength={200} placeholder="e.g. Lulu hypermarket, Swiggy, KSEB bill" defaultValue={t?.note ?? ""} />
      </Field>
      <Foot busy={busy} onDelete={t ? () => open(<ConfirmDelete col="txns" id={t.id} />) : undefined} />
    </form>
  );
}
