import type { ReactNode } from "react";
import { ACCOUNT_TYPES, type Account, type Ledger, type Txn } from "../../shared/types";
import { fmtDate, money, type DueStatus } from "../../shared/finance";
import { useApp } from "../state";

export function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
export const PlusIcon = () => <Icon size={18}><path d="M12 5v14M5 12h14" strokeWidth={2.2} /></Icon>;
export const BellIcon = () => (
  <Icon><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 003.4 0" /></Icon>
);

export function StateChip({ st }: { st: DueStatus | null }) {
  if (!st) return null;
  if (st.state === "paid") return <span className="chip paid">Paid</span>;
  if (st.state === "overdue") return <span className="chip overdue">Overdue {-st.days}d</span>;
  if (st.state === "soon")
    return <span className="chip soon">{st.days === 0 ? "Due today" : st.days === 1 ? "Due tomorrow" : `Due in ${st.days} days`}</span>;
  return <span className="chip upcoming">Due {fmtDate(st.due)}</span>;
}

function hue(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
export function CatDot({ cat, type }: { cat: string; type?: Txn["type"] }) {
  if (type === "transfer") return <div className="dot" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>⇄</div>;
  if (cat === "EMI") return <div className="dot" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>E</div>;
  if (cat === "Chitty" || cat === "Chitty prize") return <div className="dot" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>C</div>;
  if (cat === "SIP") return <div className="dot" style={{ background: "var(--pos-soft)", color: "var(--pos)" }}>S</div>;
  if (cat === "Card") return <div className="dot" style={{ background: "var(--surface-2)", color: "var(--ink-2)", fontSize: ".7rem" }}>CC</div>;
  const h = hue(cat || "?");
  return <div className="dot" style={{ background: `hsl(${h} 45% 50% / .16)`, color: `hsl(${h} 40% 42%)` }}>{(cat || "?").slice(0, 1).toUpperCase()}</div>;
}
export function AccDot({ a }: { a: Account }) {
  const t = a.type === "card" ? "CC" : a.type === "cash" ? "₹" : a.type === "wallet" ? "UPI" : (a.name || "?").slice(0, 2).toUpperCase();
  return <div className="dot" style={{ background: "var(--surface-2)", color: "var(--ink-2)", fontSize: ".7rem" }}>{t}</div>;
}
export const accTypeLabel = (a: Account) => ACCOUNT_TYPES[a.type] ?? "Account";
export const accName = (l: Ledger, id: string | null) => l.accounts.find((a) => a.id === id)?.name ?? "Deleted account";

export function ExampleChip({ show }: { show?: boolean }) {
  return show ? <> <span className="chip example">example</span></> : null;
}

export function TxnRow({ t, l, onClick }: { t: Txn; l: Ledger; onClick: () => void }) {
  const { today } = useApp();
  const sign = t.type === "income" ? "+" : t.type === "expense" ? "−" : "";
  const cls = t.type === "income" ? "pos" : t.type === "transfer" ? "faint" : "";
  const title = t.type === "transfer" ? `Transfer to ${accName(l, t.toAccountId)}` : t.category || "Uncategorised";
  const sub = [fmtDate(t.date, { thisYear: today.slice(0, 4) }), accName(l, t.accountId), t.note].filter(Boolean).join(" · ");
  return (
    <div className="li click" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}>
      <CatDot cat={t.category} type={t.type} />
      <div className="grow">
        <div className="t">{title}<ExampleChip show={t.sample} /></div>
        <div className="sub">{sub}</div>
      </div>
      <div className={`amt ${cls}`}>{sign}{money(t.amount)}</div>
    </div>
  );
}

export function Empty({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {title && <b>{title}</b>}
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="fld">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function AccountOptions({ l, exclude }: { l: Ledger; exclude?: string }) {
  return <>{l.accounts.filter((a) => a.id !== exclude).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</>;
}
