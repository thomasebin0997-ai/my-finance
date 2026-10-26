import { useState } from "react";
import type { Debt, Txn } from "../../shared/types";
import { debtStats, money } from "../../shared/finance";
import { AccountOptions, Field } from "../components/ui";
import { useActions, useApp, useLedger } from "../state";
import { api } from "../api";
import { ConfirmDelete, Foot, NeedAccount, Notice, useSubmit } from "./common";

type Dir = Debt["direction"];
const CATEGORY: Record<Dir, string> = { lent: "Lending", borrowed: "Borrowing" };

/** A lending/borrowing entry: moves money in or out of a bank, never counted as income or spending. */
function debtTxn(d: Pick<Debt, "id" | "person" | "direction">, moneyIn: boolean, f: Record<string, string>, note: string): Omit<Txn, "id" | "createdAt"> {
  return {
    type: moneyIn ? "income" : "expense",
    amount: Number(f.amount),
    date: f.date,
    accountId: f.accountId,
    toAccountId: null,
    category: CATEGORY[d.direction],
    note: (f.note || "").trim() || note,
    kind: "debt",
    emiId: null,
    chitId: null,
    sipId: null,
    debtId: d.id,
    period: null,
    chitDue: null,
    sample: false,
  };
}

/** New: who, which way, how much and from/into which account. Edit: name, note, due date, closed. */
export function DebtForm({ d, direction = "lent" }: { d?: Debt; direction?: Dir }) {
  const l = useLedger();
  const { today, open, toast } = useApp();
  const act = useActions();
  const [dir, setDir] = useState<Dir>(d?.direction ?? direction);
  const { busy, onSubmit } = useSubmit((f) => {
    const row = { person: f.person.trim(), direction: dir, note: (f.note || "").trim(), dueDate: f.dueDate || null, closed: f.closed === "on", sample: d?.sample ?? false };
    if (d) return act.save("debts", { ...row, id: d.id }, "Updated");
    if (!(Number(f.amount) > 0)) return toast("Enter an amount above zero."), false;
    // Create the person, then the first entry; undo the person if the entry fails.
    return act.save("debts", row).then(async (created) => {
      try {
        await act.save("txns", debtTxn(created, dir === "borrowed", f, dir === "lent" ? `Lent to ${row.person}` : `Borrowed from ${row.person}`), dir === "lent" ? `Lent ${money(Number(f.amount))} to ${row.person}` : `Borrowed ${money(Number(f.amount))} from ${row.person}`);
      } catch (e) {
        await api.remove("debts", created.id).catch(() => {});
        throw e;
      }
    });
  });
  if (!l.accounts.length) return <NeedAccount what="Lending and borrowing" />;

  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{d ? `Edit · ${d.person}` : dir === "lent" ? "Lend money" : "Borrow money"}</h2>
      {!d && (
        <div className="seg" role="radiogroup" aria-label="Direction">
          {(["lent", "borrowed"] as Dir[]).map((x) => (
            <label key={x}>
              <input type="radio" name="dir" value={x} checked={dir === x} onChange={() => setDir(x)} />
              <span>{x === "lent" ? "I lent" : "I borrowed"}</span>
            </label>
          ))}
        </div>
      )}
      <Field label={dir === "lent" ? "Lent to" : "Borrowed from"}>
        <input id="d-person" name="person" required maxLength={60} placeholder="e.g. Arun" defaultValue={d?.person} autoFocus />
      </Field>
      {!d && (
        <>
          <div className="f-row">
            <Field label="Amount (₹)"><input id="d-amt" name="amount" type="number" step="0.01" min="0.01" required /></Field>
            <Field label="Date"><input id="d-date" name="date" type="date" required defaultValue={today} /></Field>
          </div>
          <Field label={dir === "lent" ? "Paid from" : "Received into"}>
            <select id="d-acc" name="accountId"><AccountOptions l={l} /></select>
          </Field>
        </>
      )}
      <div className="f-row">
        <Field label={dir === "lent" ? "Expected back by" : "Repay by"} hint="Optional. You'll get a reminder before this date.">
          <input id="d-due" name="dueDate" type="date" defaultValue={d?.dueDate ?? ""} />
        </Field>
        <Field label="Note"><input id="d-note" name="note" maxLength={200} placeholder="e.g. For hospital bill" defaultValue={d?.note} /></Field>
      </div>
      {d && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input id="d-closed" type="checkbox" name="closed" defaultChecked={d.closed} /> Mark as settled (also for amounts written off)
        </label>
      )}
      <Foot busy={busy} onDelete={d ? () => open(<ConfirmDelete col="debts" id={d.id} />) : undefined} />
    </form>
  );
}

/** Money coming back (repay) or more money going the same way (more). */
export function RepayForm({ id, more = false }: { id: string; more?: boolean }) {
  const l = useLedger();
  const { today, toast } = useApp();
  const act = useActions();
  const d = l.debts.find((x) => x.id === id);
  const s = d ? debtStats(l, d) : null;
  const { busy, onSubmit } = useSubmit((f) => {
    if (!d) return false;
    if (!(Number(f.amount) > 0)) return toast("Enter an amount above zero."), false;
    // Lent: repayment comes in, more goes out. Borrowed: the reverse.
    const moneyIn = (d.direction === "lent") !== more;
    const note = more ? (d.direction === "lent" ? `Lent more to ${d.person}` : `Borrowed more from ${d.person}`) : d.direction === "lent" ? `Repaid by ${d.person}` : `Repaid to ${d.person}`;
    return act.save("txns", debtTxn(d, moneyIn, f, note), `${note}: ${money(Number(f.amount))}`);
  });
  if (!d || !s) return <Notice title="Not found">This record no longer exists.</Notice>;
  const title = more ? (d.direction === "lent" ? "Lend more" : "Borrow more") : d.direction === "lent" ? "Money received back" : "Repay";
  const accLabel = (d.direction === "lent") !== more ? "Received into" : "Paid from";
  const last = s.pays[0]?.accountId ?? undefined;

  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <div className="muted">{d.person} · {d.direction === "lent" ? "owes you" : "you owe"} {money(s.outstanding)}</div>
      <div className="f-row">
        <Field label="Amount (₹)"><input id="r-amt" name="amount" type="number" step="0.01" min="0.01" required defaultValue={more ? "" : s.outstanding || ""} autoFocus /></Field>
        <Field label="Date"><input id="r-date" name="date" type="date" required defaultValue={today} /></Field>
      </div>
      <div className="f-row">
        <Field label={accLabel}><select id="r-acc" name="accountId" defaultValue={last}><AccountOptions l={l} /></select></Field>
        <Field label="Note"><input id="r-note" name="note" maxLength={200} placeholder="Optional" /></Field>
      </div>
      <Foot busy={busy} label="Save" />
    </form>
  );
}
