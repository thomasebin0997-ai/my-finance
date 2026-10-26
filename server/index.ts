import "./env";
import path from "node:path";
import fs from "node:fs";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { env } from "./env";
import { migrate, pool } from "./db";
import { authRouter, requireAuth } from "./auth";
import { api, cronAuthorized } from "./routes";
import { runReminders } from "./reminders";

// Fail fast if the web server's secrets are missing.
void env.appPassword;
void env.sessionSecret;

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);

// Called by a scheduler (cron-job.org, GitHub Actions or a Render Cron Job).
app.all("/api/cron/reminders", async (req, res) => {
  if (!cronAuthorized(req)) return res.status(401).json({ error: "Bad or missing cron key." });
  res.json(await runReminders({ dryRun: req.query.dry === "1" }));
});

app.use("/api", requireAuth, api);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// Serve the built React app.
const dist = path.resolve(process.cwd(), "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(dist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => res.send("API running. Start the frontend with `npm run dev` and open http://localhost:5173"));
}

// Errors -> readable JSON.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ") });
  }
  const code = (err as { code?: string })?.code;
  if (code === "23505") return res.status(409).json({ error: "That installment is already marked paid for this month." });
  if (code === "23503") return res.status(400).json({ error: "The linked account, loan, chitty, SIP or person no longer exists." });
  if (code === "23514") return res.status(400).json({ error: "One of the values is out of range." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

await migrate();
app.listen(env.port, () => console.log(`Kanakku listening on :${env.port}`));
