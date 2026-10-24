/**
 * Pure calculations shared by the React app and the server (reminders).
 * Nothing here touches the network or the clock: callers pass `today`.
 */
import type { Chit, Emi, Ledger, Txn } from "./types";

/* ---------- dates ---------- */
export const pad = (n: number) => String(n).padStart(2, "0");

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Today's date (YYYY-MM-DD) in an IANA time zone, e.g. Asia/Kolkata. */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addMonths(m: string, n: number): string {
  let [y, mo] = m.split("-").map(Number);
  mo += n;
  y += Math.floor((mo - 1) / 12);
  mo = (((mo - 1) % 12) + 12) % 12 + 1;
  return `${y}-${pad(mo)}`;
}
/** b − a in months, for YYYY-MM strings. */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}
/** b − a in days, for YYYY-MM-DD strings. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 864e5);
}
/** The due date in month m; day 31 becomes the last day of short months. */
export function dueDateFor(m: string, day: number): string {
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(y, mo, 0).getDate();
  return `${m}-${pad(Math.min(Math.max(1, day || 1), last))}`;
}
export function monthLabel(m: string, short = false): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-IN", { month: short ? "short" : "long", year: "numeric" });
}
export function fmtDate(s: string | null | undefined, opts: { weekday?: boolean; thisYear?: string } = {}): string {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  const showYear = opts.thisYear ? String(y) !== opts.thisYear : false;
  return new Date(y, m - 1, d).toLocaleDateString(
    "en-IN",
    opts.weekday ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) },
  );
}
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------- money ---------- */
export function money(n: number | null | undefined): string {
  const v = Number(n) || 0;
  const frac = Math.abs(v % 1) > 0.004;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: frac ? 2 : 0,
    maximumFractionDigits: frac ? 2 : 0,
  }).format(v);
}
/** ₹1.2L, ₹45K, ₹2Cr — for chart axes. */
export function compact(n: number): string {
  const a = Math.abs(n);
  const trim = (s: string) => s.replace(/\.0$/, "");
  if (a >= 1e7) return "₹" + trim((n / 1e7).toFixed(a >= 1e8 ? 0 : 1)) + "Cr";
  if (a >= 1e5) return "₹" + trim((n / 1e5).toFixed(1)) + "L";
  if (a >= 1e3) return "₹" + trim((n / 1e3).toFixed(a >= 1e4 ? 0 : 1)) + "K";
  return "₹" + Math.round(n);
}
export const sumAmt = (rows: { amount: number }[]) => rows.reduce((s, t) => s + (Number(t.amount) || 0), 0);
export function groupBy(rows: Txn[], key: "category"): [string, number][] {
  const g: Record<string, number> = {};
  rows.forEach((r) => {
    const k = r[key] || "Other";
    g[k] = (g[k] || 0) + (Number(r.amount) || 0);
  });
  return Object.entries(g).sort((a, b) => b[1] - a[1]);
}

/* ---------- balances ---------- */
export function balances(l: Ledger): Record<string, number> {
  const b: Record<string, number> = {};
  l.accounts.forEach((a) => (b[a.id] = Number(a.opening) || 0));
  for (const t of l.txns) {
    const v = Number(t.amount) || 0;
    if (t.type === "income") { if (t.accountId && t.accountId in b) b[t.accountId] += v; }
    else if (t.type === "expense") { if (t.accountId && t.accountId in b) b[t.accountId] -= v; }
    else if (t.type === "transfer") {
      if (t.accountId && t.accountId in b) b[t.accountId] -= v;
      if (t.toAccountId && t.toAccountId in b) b[t.toAccountId] += v;
    }
  }
  return b;
}
export const monthTxns = (l: Ledger, m: string) => l.txns.filter((t) => t.date?.slice(0, 7) === m);

/* ---------- EMI & chitty schedules ---------- */
export interface SchedItem {
  kind: "emi" | "chit";
  id: string;
  name: string;
  sub: string;
  amount: number;
  dueDay: number;
  start: string;
  total: number;
  paidBefore: number;
  accountId: string | null;
  emi?: Emi;
  chit?: Chit;
}
export type DueState = "paid" | "overdue" | "soon" | "upcoming";
export interface DueStatus {
  state: DueState;
  due: string;
  days: number;
  txn?: Txn;
}

const isMonth = (s: string | undefined) => /^\d{4}-\d{2}$/.test(s || "");

export function schedItems(l: Ledger): SchedItem[] {
  const emis: SchedItem[] = l.emis
    .filter((e) => !e.closed && isMonth(e.startDate))
    .map((e) => ({ kind: "emi", id: e.id, name: e.name, sub: e.lender, amount: Number(e.emi) || 0, dueDay: Number(e.dueDay) || 1, start: e.startDate, total: Number(e.tenure) || 0, paidBefore: Number(e.paidBefore) || 0, accountId: e.accountId, emi: e }));
  const chits: SchedItem[] = l.chits
    .filter((c) => isMonth(c.startDate))
    .map((c) => ({ kind: "chit", id: c.id, name: c.name, sub: c.company, amount: Number(c.installment) || 0, dueDay: Number(c.dueDay) || 1, start: c.startDate, total: Number(c.months) || 0, paidBefore: Number(c.paidBefore) || 0, accountId: c.accountId, chit: c }));
  return emis.concat(chits);
}
export function payments(l: Ledger, it: SchedItem): Txn[] {
  return l.txns.filter((t) => (it.kind === "emi" ? t.kind === "emi" && t.emiId === it.id : t.kind === "chit" && t.chitId === it.id));
}
export const idxOf = (it: SchedItem, m: string) => monthDiff(it.start, m) + 1;
export function isActive(it: SchedItem, m: string) {
  const i = idxOf(it, m);
  return i >= 1 && i <= it.total;
}
function paidIn(it: SchedItem, m: string, pays: Txn[]) {
  return idxOf(it, m) <= it.paidBefore || pays.some((p) => p.period === m);
}
export function status(l: Ledger, it: SchedItem, m: string, today: string, pays = payments(l, it)): DueStatus | null {
  if (!isActive(it, m)) return null;
  const due = dueDateFor(m, it.dueDay);
  const days = daysBetween(today, due);
  if (paidIn(it, m, pays)) return { state: "paid", due, days, txn: pays.find((p) => p.period === m) };
  const rd = Number(l.settings.reminderDays);
  return { state: days < 0 ? "overdue" : days <= (isNaN(rd) ? 2 : rd) ? "soon" : "upcoming", due, days };
}
export interface Reminder { it: SchedItem; m: string; st: DueStatus }
/** Unpaid installments that are overdue or due within the reminder window. */
export function reminders(l: Ledger, today: string): Reminder[] {
  const tm = today.slice(0, 7);
  const out: Reminder[] = [];
  for (const it of schedItems(l)) {
    const pays = payments(l, it);
    for (const m of [addMonths(tm, -1), tm, addMonths(tm, 1)]) {
      const st = status(l, it, m, today, pays);
      if (st && (st.state === "overdue" || st.state === "soon")) out.push({ it, m, st });
    }
  }
  return out.sort((a, b) => a.st.due.localeCompare(b.st.due));
}
/** Unpaid months from the first untracked installment up to two months ahead. */
export function unpaidPeriods(l: Ledger, it: SchedItem, today: string): string[] {
  const tm = today.slice(0, 7);
  const pays = payments(l, it);
  const out: string[] = [];
  const to = addMonths(it.start, it.total - 1);
  for (let m = addMonths(it.start, it.paidBefore); monthDiff(m, to) >= 0 && monthDiff(tm, m) <= 2; m = addMonths(m, 1)) {
    if (!paidIn(it, m, pays)) out.push(m);
  }
  return out;
}
export function itemStats(l: Ledger, it: SchedItem, today: string) {
  const pays = payments(l, it);
  const paid = it.paidBefore + pays.length;
  const remaining = Math.max(0, it.total - paid);
  const next = unpaidPeriods(l, it, today)[0] ?? null;
  return {
    pays,
    paid,
    remaining,
    remainingAmt: remaining * it.amount,
    end: addMonths(it.start, it.total - 1),
    next,
    nextStatus: next ? status(l, it, next, today, pays) : null,
  };
}
export function chitStats(l: Ledger, it: SchedItem, today: string) {
  const s = itemStats(l, it, today);
  const c = it.chit!;
  const pbAmt = c.paidBeforeAmount != null ? Number(c.paidBeforeAmount) : it.paidBefore * it.amount;
  const totalPaid = pbAmt + sumAmt(s.pays);
  const dividend =
    it.paidBefore * it.amount - pbAmt +
    s.pays.reduce((a, p) => a + Math.max(0, (Number(p.chitDue) || it.amount) - (Number(p.amount) || 0)), 0);
  const prize = l.txns.find((t) => t.kind === "chitprize" && t.chitId === c.id) ?? null;
  return { ...s, totalPaid, dividend, prize };
}
