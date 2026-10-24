import { env } from "./env";

export interface Message {
  subject: string;
  text: string; // plain text (Telegram, email fallback)
  html: string; // email body
}

export function channels(): string[] {
  const c: string[] = [];
  if (env.telegramToken && env.telegramChatId) c.push("telegram");
  if (env.resendKey && env.emailFrom && env.emailTo) c.push("email");
  return c;
}

async function telegram(m: Message) {
  const r = await fetch(`https://api.telegram.org/bot${env.telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.telegramChatId, text: `${m.subject}\n\n${m.text}`, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
}

async function email(m: Message) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.resendKey}` },
    body: JSON.stringify({ from: env.emailFrom, to: env.emailTo.split(",").map((s) => s.trim()), subject: m.subject, text: m.text, html: m.html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

/** Sends to every configured channel; returns the ones that succeeded. */
export async function send(m: Message): Promise<{ ok: string[]; failed: { channel: string; error: string }[] }> {
  const ok: string[] = [];
  const failed: { channel: string; error: string }[] = [];
  for (const ch of channels()) {
    try {
      await (ch === "telegram" ? telegram(m) : email(m));
      ok.push(ch);
    } catch (e) {
      failed.push({ channel: ch, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok, failed };
}
