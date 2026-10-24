import { ACCOUNT_TYPES, type Account, type AccountType } from "../../shared/types";
import { Field } from "../components/ui";
import { useActions, useApp } from "../state";
import { ConfirmDelete, Foot, useSubmit } from "./common";

export function AccountForm({ a }: { a?: Account }) {
  const act = useActions();
  const { open } = useApp();
  const { busy, onSubmit } = useSubmit((f) =>
    act.save("accounts", { id: a?.id, name: f.name.trim(), type: f.type as AccountType, opening: Number(f.opening) || 0, sample: a?.sample ?? false }, a ? "Account updated" : "Account added"),
  );
  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{a ? "Edit account" : "New account"}</h2>
      <Field label="Name">
        <input id="a-name" name="name" required maxLength={60} placeholder="e.g. Federal Bank savings" defaultValue={a?.name} autoFocus />
      </Field>
      <div className="f-row">
        <Field label="Type">
          <select id="a-type" name="type" defaultValue={a?.type ?? "savings"}>
            {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Opening balance (₹)" hint="Balance on the day you start tracking. For a credit card, enter what you owe as a negative number.">
          <input id="a-open" name="opening" type="number" step="0.01" inputMode="decimal" placeholder="0" defaultValue={a?.opening ?? ""} />
        </Field>
      </div>
      <Foot busy={busy} onDelete={a ? () => open(<ConfirmDelete col="accounts" id={a.id} />) : undefined} />
    </form>
  );
}
