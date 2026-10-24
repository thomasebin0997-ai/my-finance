import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "./env";

const COOKIE = "kanakku_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // stay signed in for 30 days

const sign = (payload: string) => createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");

function makeToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function validToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}
function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
function safeEqual(a: string, b: string) {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isAuthed(req: Request) {
  return validToken(readCookie(req, COOKIE));
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: "Please sign in." });
}

/* Simple in-memory brute-force guard: 10 attempts per 15 minutes per IP. */
const attempts = new Map<string, { n: number; until: number }>();
function tooMany(ip: string) {
  const a = attempts.get(ip);
  if (!a || a.until < Date.now()) return false;
  return a.n >= 10;
}
function recordFail(ip: string) {
  const a = attempts.get(ip);
  if (!a || a.until < Date.now()) attempts.set(ip, { n: 1, until: Date.now() + 15 * 60 * 1000 });
  else a.n++;
}

export const authRouter = Router();

authRouter.get("/me", (req, res) => {
  res.json({ authed: isAuthed(req) });
});

authRouter.post("/login", (req, res) => {
  const ip = req.ip || "unknown";
  if (tooMany(ip)) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!safeEqual(password, env.appPassword)) {
    recordFail(ip);
    return res.status(401).json({ error: "That password is not right." });
  }
  attempts.delete(ip);
  res.cookie(COOKIE, makeToken(), { httpOnly: true, sameSite: "lax", secure: env.isProd, maxAge: MAX_AGE_MS, path: "/" });
  res.json({ authed: true });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ authed: false });
});
