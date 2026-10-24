import { useState } from "react";
import { ACCOUNT_TYPES, type Account, type AccountType } from "../../shared/types";
import { AccountOptions, Field } from "../components/ui";
import { useActions, useApp, useLedger } from "../state";
import { ConfirmDelete, Foot, useSubmit } from "./common";

export function AccountForm({ a }: { a?: Account }) {
  const l = useLedger();
  const act = useActions();
  const { open } = useApp();
  const [type, setType] = useState<AccountType>(a?.type ?? "savings");
  const card = type === "card";
  const { busy, onSubmit } = useSubmit((f) =>
    act.save(
      "accounts",
      {
        id: a?.id,
        name: f.name.trim(),
        type,
        opening: Number(f.opening) || 0,
        dueDay: card && f.dueDay ? Number(f.dueDay) : null,
        payFromId: card ? f.payFromId || null : null,
        sample: a?.sample ?? false,
      },
      a ? "Account updated" : "Account added",
    ),
  );
  return (
    <form className="f" onSubmit={onSubmit}>
      <h2>{a ? "Edit account" : "New account"}</h2>
      <Field label="Name">
        <input id="a-name" name="name" required maxLength={60} placeholder="e.g. Federal Bank savings" defaultValue={a?.name} autoFocus />
      </Field>
      <div className="f-row">
        <Field label="Type">
          <select id="a-type" name="type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Opening balance (₹)" hint="Balance on the day you start tracking. For a credit card, enter what you owe as a negative number.">
          <input id="a-open" name="opening" type="number" step="0.01" inputMode="decimal" placeholder="0" defaultValue={a?.opening ?? ""} />
        </Field>
      </div>
      {card && (
        <div className="f-row">
          <Field label="Bill due day" hint="Day of the month the card bill is due. Leave blank for no reminder.">
            <input id="a-due" name="dueDay" type="number" min="1" max="31" placeholder="e.g. 5" defaultValue={a?.dueDay ?? ""} />
          </Field>
          <Field label="Bill paid from">
            <select id="a-payfrom" name="payFromId" defaultValue={a?.payFromId ?? ""}>
              <option value="">Not set</option>
              <AccountOptions l={{ ...l, accounts: l.accounts.filter((x) => x.type !== "card") }} exclude={a?.id} />
            </select>
          </Field>
        </div>
      )}
      <Foot busy={busy} onDelete={a ? () => open(<ConfirmDelete col="accounts" id={a.id} />) : undefined} />
    </form>
  );
}
