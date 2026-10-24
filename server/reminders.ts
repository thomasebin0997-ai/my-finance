import { pool } from "./db";
import { env } from "./env";
import { channels, send } from "./notify";
import { ledger } from "./repo";
import { KIND_LABEL, balances, fmtDate, money, reminders, todayIn, type Reminder } from "../shared/finance";
import type { Ledger } from "../shared/types";

function when(r: Reminder) {
  const d = r.st.days;
  const date = fmtDate(r.st.due);
  if (d < 0) return `was due ${date} (${-d} day${d === -1 ? "" : "s"} overdue)`;
  return `due ${date} (${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`})`;
}

export function buildMessage(l: Ledger, items: Reminder[]) {
  const bal = balances(l);
  const acc = (id: string | null) => l.accounts.find((a) => a.id === id)?.name ?? "no account";
  const lines = items.map((r) => {
    const kind = KIND_LABEL[r.it.kind];
    const amt = r.it.kind === "card" ? `${money(r.it.amount)} outstanding` : money(r.it.amount);
    const b = r.it.accountId != null && r.it.accountId in bal ? `, balance ${money(bal[r.it.accountId])}` : "";
    return `• ${r.it.name} · ${kind} ${amt} · ${when(r)} · from ${acc(r.it.accountId)}${b}`;
  });
  const total = items.reduce((s, r) => s + r.it.amount, 0);
  const subject = `Kanakku: ${items.length} payment${items.length > 1 ? "s" : ""} due · ${money(total)}`;
  const link = env.appUrl ? `\n\nOpen Kanakku: ${env.appUrl}` : "";
  const text = lines.join("\n") + link;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const html =
    `<p>These payments need attention:</p><ul>${lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join("")}</ul>` +
    `<p><b>Total: ${esc(money(total))}</b></p>` +
    (env.appUrl ? `<p><a href="${esc(env.appUrl)}">Open Kanakku</a></p>` : "");
  return { subject, text, html };
}

export interface RunResult {
  today: string;
  due: number;
  sent: boolean;
  skipped?: string;
  channels?: string[];
  failed?: { channel: string; error: string }[];
}

/** Checks dues and sends at most one message per day. Safe to call hourly. */
export async function runReminders(opts: { force?: boolean; dryRun?: boolean } = {}): Promise<RunResult> {
  const today = todayIn(env.timeZone);
  const l = await ledger();
  const items = reminders(l, today);
  if (!items.length) return { today, due: 0, sent: false, skipped: "nothing due" };
  if (opts.dryRun) return { today, due: items.length, sent: false, skipped: "dry run" };
  if (!channels().length) return { today, due: items.length, sent: false, skipped: "no channel configured (set Telegram or Resend env vars)" };
  if (!opts.force) {
    const { rowCount } = await pool.query("SELECT 1 FROM reminder_runs WHERE day = $1", [today]);
    if (rowCount) return { today, due: items.length, sent: false, skipped: "already sent today" };
  }
  const res = await send(buildMessage(l, items));
  if (res.ok.length) {
    await pool.query(
      "INSERT INTO reminder_runs (day, items, channels) VALUES ($1, $2, $3) ON CONFLICT (day) DO UPDATE SET sent_at = now(), items = EXCLUDED.items, channels = EXCLUDED.channels",
      [today, items.length, res.ok.join(",")],
    );
  }
  return { today, due: items.length, sent: res.ok.length > 0, channels: res.ok, failed: res.failed };
}
