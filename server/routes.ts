import { Router, type Request } from "express";
import { COLLECTIONS, insert, ledger, remove, removeSamples, saveSettings, update, type Collection } from "./repo";
import { seedExamples } from "./samples";
import { runReminders } from "./reminders";
import { pool } from "./db";
import { env } from "./env";

export const api = Router();

api.get("/ledger", async (_req, res) => {
  res.json(await ledger());
});

for (const col of COLLECTIONS) {
  api.post(`/${col}`, async (req, res) => {
    res.status(201).json(await insert(col as Collection, req.body));
  });
  api.put(`/${col}/:id`, async (req, res) => {
    const row = await update(col as Collection, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: "That record no longer exists." });
    res.json(row);
  });
  api.delete(`/${col}/:id`, async (req, res) => {
    const ok = await remove(col as Collection, req.params.id);
    if (!ok) return res.status(404).json({ error: "That record no longer exists." });
    res.status(204).end();
  });
}

api.put("/settings", async (req, res) => {
  res.json(await saveSettings(req.body));
});

api.post("/samples", async (_req, res) => {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM accounts");
  if (rows[0].n > 0) return res.status(409).json({ error: "Examples can only be loaded into an empty ledger." });
  res.status(201).json({ inserted: await seedExamples() });
});
api.delete("/samples", async (_req, res) => {
  res.json({ removed: await removeSamples() });
});

/* ---------- export ---------- */
api.get("/export.json", async (_req, res) => {
  const l = await ledger();
  res.setHeader("content-disposition", `attachment; filename="kanakku-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), ...l });
});
api.get("/export.csv", async (_req, res) => {
  const l = await ledger();
  const acc = (id: string | null) => l.accounts.find((a) => a.id === id)?.name ?? "";
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [["Date", "Type", "Amount", "Account", "To account", "Category", "Note", "For month"].join(",")];
  for (const t of l.txns) lines.push([t.date, t.type, t.amount, acc(t.accountId), acc(t.toAccountId), t.category, t.note, t.period].map(cell).join(","));
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="kanakku-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + lines.join("\n"));
});

/* ---------- reminders, triggered from the app (test button) ---------- */
api.post("/reminders/test", async (_req, res) => {
  res.json(await runReminders({ force: true }));
});

/* ---------- cron endpoint (no session; protected by CRON_SECRET) ---------- */
export function cronAuthorized(req: Request): boolean {
  if (!env.cronSecret) return false;
  const header = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const key = header || (typeof req.query.key === "string" ? req.query.key : "");
  return key === env.cronSecret;
}
