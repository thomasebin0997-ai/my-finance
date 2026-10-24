import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { balances, money, monthLabel, monthTxns, sumAmt } from "../../shared/finance";
import { SYS_EXP, SYS_INC } from "../../shared/types";
import { AccDot, Empty, ExampleChip, accTypeLabel } from "../components/ui";
import { useActions, useApp, useLedger } from "../state";
import { AccountForm } from "../forms/AccountForm";
import { api } from "../api";

export function Accounts() {
  const l = useLedger();
  const { month: M, open, toast } = useApp();
  const act = useActions();
  const qc = useQueryClient();
  const bal = balances(l);
  const mt = monthTxns(l, M);
  const [testing, setTesting] = useState(false);

  const addCat = (kind: "expense" | "income") => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) return;
    const list = kind === "expense" ? l.settings.expenseCats : l.settings.incomeCats;
    if ([...list, ...SYS_EXP, ...SYS_INC].some((x) => x.toLowerCase() === name.toLowerCase())) return toast("That category already exists.");
    await act.settings({ ...l.settings, [kind === "expense" ? "expenseCats" : "incomeCats"]: [...list, name] });
    form.reset();
  };
  const delCat = (kind: "expense" | "income", name: string) => {
    const key = kind === "expense" ? "expenseCats" : "incomeCats";
    act.settings({ ...l.settings, [key]: l.settings[key].filter((c) => c !== name) }).catch(() => {});
  };

  const testReminder = async () => {
    setTesting(true);
    try {
      const r = await api.testReminder();
      if (r.sent) toast(`Reminder sent via ${r.channels?.join(" and ")} (${r.due} due).`);
      else if (r.failed?.length) toast(`Sending failed: ${r.failed.map((f) => f.channel + " — " + f.error).join("; ")}`);
      else toast(r.skipped === "nothing due" ? "Nothing is due right now, so no message was sent." : `Not sent: ${r.skipped}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't run the reminder.");
    } finally {
      setTesting(false);
    }
  };

  const catBlock = (kind: "expense" | "income") => {
    const list = kind === "expense" ? l.settings.expenseCats : l.settings.incomeCats;
    const sys = kind === "expense" ? SYS_EXP : SYS_INC;
    return (
      <div className="card">
        <div className="card-h"><h2>{kind === "expense" ? "Expense" : "Income"} categories</h2></div>
        <div className="cats">
          {list.map((c) => (
            <span className="cat" key={c}>{c}<button type="button" aria-label={`Remove ${c}`} onClick={() => delCat(kind, c)}>×</button></span>
          ))}
          {sys.map((c) => <span className="cat sys" key={c} title="Used automatically">{c}</span>)}
        </div>
        <form className="filters" style={{ marginTop: 12 }} onSubmit={addCat(kind)}>
          <input id={`cat-${kind}`} name="name" placeholder="New category" required maxLength={40} />
          <button className="btn small" type="submit">Add</button>
        </form>
      </div>
    );
  };

  return (
    <>
      <div className="card">
        <div className="card-h"><h2>Accounts</h2><button className="btn small primary" type="button" onClick={() => open(<AccountForm />)}>Add account</button></div>
        {l.accounts.length ? (
          <div className="list">
            {l.accounts.map((a) => {
              const n = l.txns.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length;
              const o = sumAmt(mt.filter((t) => (t.type === "expense" || t.type === "transfer") && t.accountId === a.id));
              return (
                <div className="li" key={a.id}>
                  <AccDot a={a} />
                  <div className="grow">
                    <div className="t">{a.name}<ExampleChip show={a.sample} /></div>
                    <div className="sub">{accTypeLabel(a)} · opening {money(a.opening)} · {n} entries · spent {money(o)} in {monthLabel(M, true)}</div>
                  </div>
                  <div className={`amt ${bal[a.id] < 0 ? "neg" : ""}`}>{money(bal[a.id])}</div>
                  <button className="btn small" type="button" onClick={() => open(<AccountForm a={a} />)}>Edit</button>
                </div>
              );
            })}
          </div>
        ) : <Empty><span>Add each bank account, credit card and your cash in hand.</span></Empty>}
      </div>

      <div className="grid">{catBlock("expense")}{catBlock("income")}</div>

      <div className="grid">
        <div className="card">
          <div className="card-h"><h2>Reminders</h2></div>
          <label className="fld" style={{ maxWidth: 340 }}>
            <span>Remind me this many days before an EMI or chitty is due</span>
            <input
              id="rdays"
              type="number"
              min={0}
              max={15}
              defaultValue={l.settings.reminderDays}
              onBlur={(e) => {
                const n = Math.max(0, Math.min(15, Math.round(Number(e.target.value) || 0)));
                if (n !== l.settings.reminderDays) act.settings({ ...l.settings, reminderDays: n }).then(() => toast(`Reminder set to ${n} days before`), () => {});
              }}
            />
          </label>
          <p className="faint" style={{ margin: "10px 0 12px", fontSize: ".82rem" }}>
            The dashboard shows reminders whenever you open it. Telegram or email reminders are sent by the daily scheduled job described in the README.
          </p>
          <button className="btn small" type="button" disabled={testing} onClick={testReminder}>{testing ? "Sending…" : "Send a test reminder now"}</button>
        </div>
        <div className="card">
          <div className="card-h"><h2>Your data</h2></div>
          <p className="muted" style={{ margin: "0 0 12px" }}>Download a copy for your records or to move to another server.</p>
          <div className="actions">
            <a className="btn small" href="/api/export.csv" download>Transactions (CSV)</a>
            <a className="btn small" href="/api/export.json" download>Full backup (JSON)</a>
          </div>
          <div className="actions" style={{ marginTop: 16 }}>
            <button
              className="btn small ghost"
              type="button"
              onClick={async () => {
                await api.logout().catch(() => {});
                qc.setQueryData(["me"], { authed: false });
                qc.removeQueries({ queryKey: ["ledger"] });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
