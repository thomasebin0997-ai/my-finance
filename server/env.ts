// Local development: load .env.local (written by `neon deploy` / `neon env pull`)
// and .env. Values already set win, so .env.local overrides .env and real
// environment variables (Render) override both.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* file not present: fine */
  }
}

const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;

function required(name: string, devFallback?: string): string {
  const v = process.env[name];
  if (v) return v;
  if (!isProd && devFallback !== undefined) {
    console.warn(`[env] ${name} is not set; using a development default.`);
    return devFallback;
  }
  throw new Error(`Missing environment variable ${name}. See .env.example.`);
}

export const env = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required("DATABASE_URL", "postgres://localhost:5432/kanakku"),
  /** Force TLS for the DB connection; automatic for any non-local host. */
  databaseSsl: process.env.DATABASE_SSL === "true",
  // Only the web server needs these; read lazily so CLI jobs (cron, import) don't.
  get appPassword() {
    return required("APP_PASSWORD", "kanakku");
  },
  get sessionSecret() {
    return required("SESSION_SECRET", "dev-only-secret-change-me");
  },
  cronSecret: process.env.CRON_SECRET || "",
  timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata",
  appUrl: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "",
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  resendKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.REMINDER_EMAIL_FROM || "",
  emailTo: process.env.REMINDER_EMAIL_TO || "",
};
