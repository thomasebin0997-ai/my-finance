import { randomUUID } from "node:crypto";
import type pg from "pg";
import { z } from "zod";
import { pool, tx } from "./db";
import { ACCOUNT_TYPES, DEFAULT_SETTINGS, type Ledger, type Settings } from "../shared/types";

const month = z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const amount = z.coerce.number().finite().positive().max(1e11);
const text = (max: number) => z.string().trim().max(max);
const optId = z.string().min(1).max(100).nullable().optional().transform((v) => v ?? null);

export const schemas = {
  accounts: z.object({
    name: text(60).min(1),
    type: z.enum(Object.keys(ACCOUNT_TYPES) as [keyof typeof ACCOUNT_TYPES]),
    opening: z.coerce.number().finite().min(-1e11).max(1e11).default(0),
    dueDay: z.coerce.number().int().min(1).max(31).nullable().default(null),
    payFromId: optId,
    sample: z.boolean().default(false),
  }),
  emis: z.object({
    name: text(60).min(1),
    lender: text(60).default(""),
    emi: amount,
    dueDay: z.coerce.number().int().min(1).max(31),
    startDate: month,
    tenure: z.coerce.number().int().min(1).max(600),
    paidBefore: z.coerce.number().int().min(0).default(0),
    loanAmount: z.coerce.number().finite().min(0).default(0),
    accountId: optId,
    closed: z.boolean().default(false),
    sample: z.boolean().default(false),
  }),
  chits: z.object({
    name: text(60).min(1),
    company: text(60).default(""),
    chitValue: amount,
    installment: amount,
    months: z.coerce.number().int().min(1).max(300),
    dueDay: z.coerce.number().int().min(1).max(31),
    startDate: month,
    accountId: optId,
    paidBefore: z.coerce.number().int().min(0).default(0),
    paidBeforeAmount: z.coerce.number().finite().min(0).nullable().default(null),
    sample: z.boolean().default(false),
  }),
  sips: z.object({
    name: text(60).min(1),
    platform: text(60).default(""),
    amount,
    dueDay: z.coerce.number().int().min(1).max(31),
    startDate: month,
    months: z.coerce.number().int().min(0).max(600).default(0),
    paidBefore: z.coerce.number().int().min(0).default(0),
    investedBefore: z.coerce.number().finite().min(0).nullable().default(null),
    accountId: optId,
    stopped: z.boolean().default(false),
    sample: z.boolean().default(false),
  }),
  debts: z.object({
    person: text(60).min(1),
    direction: z.enum(["lent", "borrowed"]),
    note: text(200).default(""),
    dueDate: day.nullable().default(null),
    closed: z.boolean().default(false),
    sample: z.boolean().default(false),
  }),
  txns: z
    .object({
      type: z.enum(["income", "expense", "transfer"]),
      amount,
      date: day,
      accountId: z.string().min(1).max(100),
      toAccountId: optId,
      category: text(60).default("Other"),
      note: text(200).default(""),
      kind: z.enum(["emi", "chit", "chitprize", "sip", "card", "debt"]).nullable().default(null),
      emiId: optId,
      chitId: optId,
      sipId: optId,
      debtId: optId,
      period: month.nullable().default(null),
      chitDue: z.coerce.number().finite().min(0).nullable().default(null),
      sample: z.boolean().default(false),
    })
    .superRefine((t, ctx) => {
      if (t.type === "transfer" && (!t.toAccountId || t.toAccountId === t.accountId))
        ctx.addIssue({ code: "custom", message: "A transfer needs two different accounts." });
      if (t.kind === "emi" && (!t.emiId || !t.period)) ctx.addIssue({ code: "custom", message: "EMI payment needs the loan and month." });
      if (t.kind === "chit" && (!t.chitId || !t.period)) ctx.addIssue({ code: "custom", message: "Chitty payment needs the chitty and month." });
      if (t.kind === "chitprize" && !t.chitId) ctx.addIssue({ code: "custom", message: "Prize needs the chitty." });
      if (t.kind === "sip" && (!t.sipId || !t.period)) ctx.addIssue({ code: "custom", message: "SIP installment needs the SIP and month." });
      if (t.kind === "debt" && (!t.debtId || t.type === "transfer")) ctx.addIssue({ code: "custom", message: "Lending or borrowing entry needs the person." });
      if (t.kind === "card" && (t.type !== "transfer" || !t.period)) ctx.addIssue({ code: "custom", message: "Card bill payment needs the card and month." });
    }),
} as const;

export const settingsSchema = z.object({
  expenseCats: z.array(text(40).min(1)).max(150),
  incomeCats: z.array(text(40).min(1)).max(150),
  reminderDays: z.coerce.number().int().min(0).max(15),
});

export type Collection = keyof typeof schemas;
export const COLLECTIONS = Object.keys(schemas) as Collection[];

/** camelCase field -> snake_case column, per table. */
const COLUMNS: Record<Collection, Record<string, string>> = {
  accounts: { name: "name", type: "type", opening: "opening", dueDay: "due_day", payFromId: "pay_from_id", sample: "sample" },
  emis: {
    name: "name", lender: "lender", emi: "emi", dueDay: "due_day", startDate: "start_month", tenure: "tenure",
    paidBefore: "paid_before", loanAmount: "loan_amount", accountId: "account_id", closed: "closed", sample: "sample",
  },
  chits: {
    name: "name", company: "company", chitValue: "chit_value", installment: "installment", months: "months", dueDay: "due_day",
    startDate: "start_month", accountId: "account_id", paidBefore: "paid_before", paidBeforeAmount: "paid_before_amount", sample: "sample",
  },
  sips: {
    name: "name", platform: "platform", amount: "amount", dueDay: "due_day", startDate: "start_month", months: "months",
    paidBefore: "paid_before", investedBefore: "invested_before", accountId: "account_id", stopped: "stopped", sample: "sample",
  },
  debts: { person: "person", direction: "direction", note: "note", dueDate: "due_date", closed: "closed", sample: "sample" },
  txns: {
    type: "type", amount: "amount", date: "date", accountId: "account_id", toAccountId: "to_account_id", category: "category",
    note: "note", kind: "kind", emiId: "emi_id", chitId: "chit_id", sipId: "sip_id", debtId: "debt_id", period: "period", chitDue: "chit_due", sample: "sample",
  },
};
const ORDER: Record<Collection, string> = {
  accounts: "created_at, name",
  emis: "created_at",
  chits: "created_at",
  sips: "created_at",
  debts: "created_at",
  txns: "date DESC, created_at DESC",
};

const selectList = (col: Collection) =>
  ["id", ...Object.entries(COLUMNS[col]).map(([camel, snake]) => `${snake} AS "${camel}"`), `(extract(epoch FROM created_at) * 1000)::bigint::float8 AS "createdAt"`].join(", ");

type Q = Pick<pg.Pool, "query"> | pg.PoolClient;

export async function list(col: Collection, q: Q = pool) {
  const { rows } = await q.query(`SELECT ${selectList(col)} FROM ${col} ORDER BY ${ORDER[col]}`);
  return rows;
}

export async function insert(col: Collection, input: unknown, q: Q = pool, id?: string) {
  const data = schemas[col].parse(input) as Record<string, unknown>;
  const map = COLUMNS[col];
  const fields = Object.keys(map);
  const cols = ["id", ...fields.map((f) => map[f])];
  const vals = [id || randomUUID(), ...fields.map((f) => data[f] ?? null)];
  const ph = vals.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await q.query(`INSERT INTO ${col} (${cols.join(", ")}) VALUES (${ph}) RETURNING ${selectList(col)}`, vals);
  return rows[0];
}

/** Insert or replace by id (used by the importer). */
export async function upsert(col: Collection, id: string, input: unknown, q: Q = pool) {
  const data = schemas[col].parse(input) as Record<string, unknown>;
  const map = COLUMNS[col];
  const fields = Object.keys(map);
  const vals = [id, ...fields.map((f) => data[f] ?? null)];
  const ph = vals.map((_, i) => `$${i + 1}`).join(", ");
  const sets = fields.map((f) => `${map[f]} = EXCLUDED.${map[f]}`).join(", ");
  await q.query(`INSERT INTO ${col} (id, ${fields.map((f) => map[f]).join(", ")}) VALUES (${ph}) ON CONFLICT (id) DO UPDATE SET ${sets}`, vals);
}

export async function update(col: Collection, id: string, input: unknown, q: Q = pool) {
  const data = schemas[col].parse(input) as Record<string, unknown>;
  const map = COLUMNS[col];
  const fields = Object.keys(map);
  const sets = fields.map((f, i) => `${map[f]} = $${i + 2}`);
  if (col === "txns") sets.push("updated_at = now()");
  const { rows } = await q.query(
    `UPDATE ${col} SET ${sets.join(", ")} WHERE id = $1 RETURNING ${selectList(col)}`,
    [id, ...fields.map((f) => data[f] ?? null)],
  );
  return rows[0] ?? null;
}

export async function remove(col: Collection, id: string, q: Q = pool) {
  const r = await q.query(`DELETE FROM ${col} WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

export async function getSettings(q: Q = pool): Promise<Settings> {
  const { rows } = await q.query<{ data: Partial<Settings> }>("SELECT data FROM settings WHERE id = 1");
  return { ...DEFAULT_SETTINGS, ...(rows[0]?.data ?? {}) };
}
export async function saveSettings(input: unknown, q: Q = pool): Promise<Settings> {
  const s = settingsSchema.parse(input);
  await q.query("INSERT INTO settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data", [JSON.stringify(s)]);
  return s;
}

export async function ledger(): Promise<Ledger> {
  const [accounts, txns, emis, chits, sips, debts, settings] = await Promise.all([
    list("accounts"), list("txns"), list("emis"), list("chits"), list("sips"), list("debts"), getSettings(),
  ]);
  return { accounts, txns, emis, chits, sips, debts, settings } as Ledger;
}

export async function removeSamples(): Promise<number> {
  return tx(async (c) => {
    let n = 0;
    for (const t of ["txns", "emis", "chits", "sips", "debts", "accounts"]) {
      const r = await c.query(`DELETE FROM ${t} WHERE sample`);
      n += r.rowCount ?? 0;
    }
    return n;
  });
}
