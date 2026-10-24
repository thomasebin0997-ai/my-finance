import { useState, type FormEvent, type ReactNode } from "react";
import { useActions, useApp, useLedger } from "../state";
import type { Col } from "../api";
import { AccountForm } from "./AccountForm";

/** Wraps a form: prevents default, tracks busy state, closes on success. */
export function useSubmit(fn: (f: Record<string, string>) => Promise<unknown> | false) {
  const { close } = useApp();
  const [busy, setBusy] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const p = fn(f);
    if (p === false) return;
    setBusy(true);
    try {
      await p;
      close();
    } catch {
      /* toast already shown; keep the form open */
    } finally {
      setBusy(false);
    }
  };
  return { busy, onSubmit };
}

export function Foot({ busy, label = "Save", onDelete }: { busy: boolean; label?: string; onDelete?: () => void }) {
  const { close } = useApp();
  return (
    <div className="f-foot">
      {onDelete && <button className="btn danger left" type="button" onClick={onDelete}>Delete</button>}
      <button className="btn" type="button" onClick={close}>Cancel</button>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : label}</button>
    </div>
  );
}

export function NeedAccount({ what }: { what: string }) {
  const { open, close } = useApp();
  return (
    <div className="empty">
      <b>Add an account first</b>
      <span>{what} are recorded against a bank account, card or cash.</span>
      <div className="actions">
        <button className="btn" type="button" onClick={close}>Cancel</button>
        <button className="btn primary" type="button" onClick={() => open(<AccountForm />)}>Add account</button>
      </div>
    </div>
  );
}

export function Notice({ title, children }: { title: string; children: ReactNode }) {
  const { close } = useApp();
  return (
    <div className="empty">
      <b>{title}</b>
      <span>{children}</span>
      <button className="btn" type="button" onClick={close}>Close</button>
    </div>
  );
}

export function ConfirmDelete({ col, id }: { col: Col; id: string }) {
  const l = useLedger();
  const { close } = useApp();
  const act = useActions();
  const [busy, setBusy] = useState(false);
  const names: Record<Col, string> = { txns: "this entry", accounts: "this account", emis: "this EMI", chits: "this chitty" };
  let extra = "This can't be undone.";
  if (col === "accounts") {
    const n = l.txns.filter((t) => t.accountId === id || t.toAccountId === id).length;
    if (n) extra = `${n} entries use this account. They stay in your history but will show as “Deleted account” and stop counting toward any balance.`;
  }
  if (col === "emis" || col === "chits") {
    const n = l.txns.filter((t) => t.emiId === id || t.chitId === id).length;
    if (n) extra = `The ${n} payment entries already recorded stay in your transactions.`;
  }
  if (col === "txns") {
    const t = l.txns.find((x) => x.id === id);
    if (t?.kind === "emi" || t?.kind === "chit") extra = "That month will show as unpaid again.";
    if (t?.kind === "chitprize") extra = "The chitty will show as non-prized again.";
  }
  return (
    <div className="f">
      <h2>Delete {names[col]}?</h2>
      <p className="muted" style={{ margin: 0 }}>{extra}</p>
      <div className="f-foot">
        <button className="btn" type="button" onClick={close}>Keep it</button>
        <button
          className="btn danger"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await act.remove(col, id);
              close();
            } catch {
              setBusy(false);
            }
          }}
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
