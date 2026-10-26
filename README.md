# Kanakku Ledger

A personal money tracker: income and expenses, bank-wise and category-wise reports, EMIs, chitty, SIPs, credit card bills, and money lent or borrowed, with reminders before each due date.

## Stack

| Layer | What | Where |
|---|---|---|
| Frontend | React 18 + TypeScript, Vite, TanStack Query | `src/` |
| API | Node.js + Express 5 (TypeScript, run with `tsx`), Zod validation | `server/` |
| Database | PostgreSQL: Neon free tier in production, any Postgres locally (`pg` driver, plain SQL migrations) | `server/db.ts` |
| Shared logic | Balances, EMI, chitty, SIP and card bill schedules, reminder rules | `shared/finance.ts` |
| Hosting | One Render web service serves both the API and the built React app | `render.yaml` |
| Reminders | Daily call to `/api/cron/reminders` → Telegram and/or email | `.github/workflows/reminders.yml` |

The same `shared/finance.ts` runs in the browser (dashboard) and on the server (reminder messages), so both always agree on what is due.

### Data model

- `accounts`: banks, credit cards, cash, UPI wallets, each with an opening balance. Credit cards can also have a bill due day and the bank the bill is paid from.
- `txns`: every money movement (`income`, `expense`, `transfer`). EMI, chitty and SIP payments are ordinary expenses tagged with `kind`, `emi_id`/`chit_id`/`sip_id` and `period` (`YYYY-MM`). Unique indexes stop the same month being paid twice. SIP installments count as spending (category "SIP"). A card bill payment is a transfer from the bank to the card (`kind = 'card'`), because the purchases were already counted as expenses.
- `debts`: money lent to or borrowed from a person, with an optional date to be repaid by. The money itself is in `txns` (`kind = 'debt'`, `debt_id`), so it moves bank balances but isn't counted as income or spending.
- `emis`, `chits`, `sips`: the schedules (first month, tenure, due day, amount, installments already paid before you started tracking).
- `settings`: your categories and how many days ahead to remind.

Balances, remaining EMIs, dividends and due status are calculated from these rows, never stored, so they can't drift out of sync.

## Run locally

Requires Node 20.12+ and PostgreSQL.

```bash
createdb kanakku
cp .env.example .env        # set APP_PASSWORD (DATABASE_URL defaults to local Postgres)
npm install
npm run dev                 # API on :3000, app on http://localhost:5173
```

Tables are created automatically on first start. To see the app with data, click **Try with example data** on the empty dashboard (or run `npm run seed:examples`), then **Remove examples** when you're ready for your own.

## Deploy (free): Render + Neon

The app runs on Render's free web service and stores data in Neon's free PostgreSQL.

**1. Create the database on Neon**
1. Sign up at neon.com and create a project (pick the region closest to you, e.g. Singapore).
2. On the project dashboard click **Connect** and copy the connection string. It looks like
   `postgresql://user:password@ep-xxxx.aws.neon.tech/neondb?sslmode=require`.

**2. Deploy the app on Render**
1. Push this folder to a GitHub repository.
2. In Render: **New → Blueprint**, pick the repo. `render.yaml` creates the `kanakku` web service.
3. When asked, paste the Neon string into `DATABASE_URL` and choose your sign-in password for `APP_PASSWORD`. `SESSION_SECRET` and `CRON_SECRET` are generated for you. The Telegram and email fields can stay blank for now.
4. Open the service URL and sign in. Tables are created automatically on first start.

**Free-plan behaviour:**
- Render's free web service sleeps after 15 minutes without traffic. The next visit takes about a minute to wake it.
- Neon's free compute suspends after 5 minutes idle and resumes on the next query, usually within a second.
- Neon's free plan includes 1 GB of storage and a short restore window, so download the JSON backup from **Accounts & setup → Your data** now and then.
- Free Render services can't send email over SMTP. That's why email goes through Resend's HTTP API.

**Using the Neon CLI (optional).** The project is already linked to your Neon project (`neon.ts` and `.neon`). On your Mac:
```bash
npm i -g neon@latest
neon login        # browser sign-in
neon deploy       # provisions Postgres and writes DATABASE_URL to .env (or .env.local)
npm run dev       # the app picks up DATABASE_URL from either file
```
Use the same `DATABASE_URL` value on Render.

**Prefer Render's own database?** `render.yaml` has a commented `databases:` block. Render's free databases are deleted 30 days after creation, so use a paid plan there for real data.

## Reminders (Telegram or email)

The dashboard always shows dues within your reminder window. To also get a message on your phone:

**1. Pick a channel** (either or both):

- **Telegram (free):** message `@BotFather`, send `/newbot`, and copy the token into `TELEGRAM_BOT_TOKEN`. Then send any message to your new bot and open `https://api.telegram.org/bot<TOKEN>/getUpdates`. Copy `message.chat.id` into `TELEGRAM_CHAT_ID`.
- **Email:** create a key at resend.com and set `RESEND_API_KEY`, `REMINDER_EMAIL_FROM` (a sender on a domain you've verified with Resend) and `REMINDER_EMAIL_TO`.

In the app, open **Accounts & setup → Send a test reminder now** to check the channel works.

**2. Schedule the daily check** (pick one):

- **GitHub Actions (free, included):** in your GitHub repo add two secrets, `KANAKKU_URL` (your Render URL) and `KANAKKU_CRON_SECRET` (the `CRON_SECRET` value from Render). The workflow runs at 08:00 IST. It retries while a sleeping free instance wakes up.
- **cron-job.org or similar:** call `GET https://<your-app>/api/cron/reminders` daily with the header `Authorization: Bearer <CRON_SECRET>`.
- **Render Cron Job (paid):** uncomment the cron service in `render.yaml`; it runs `npm run remind`.

The endpoint sends at most one message per day, so calling it more often is harmless. Add `?dry=1` to see what would be sent without sending.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | API + Vite dev server with hot reload |
| `npm run build` | Build the React app into `dist/` |
| `npm start` | Production server (API + `dist/`) |
| `npm run migrate` | Apply database migrations (also runs on start) |
| `npm run remind` | Send today's reminder now (`-- --force` ignores the once-a-day limit) |
| `npm run seed:examples` | Load example data |
| `npm run import -- file.json` | Import a JSON backup; safe to run twice |
| `npm run typecheck` | TypeScript check |

## Backups and moving data

**Accounts & setup → Your data** downloads a CSV of transactions or a full JSON backup. `npm run import -- backup.json` loads a JSON backup into any Kanakku database. It also accepts data exported from the earlier claude.ai version of Kanakku.

## Security

- One password protects the whole app. The session is an HMAC-signed, httpOnly cookie that lasts 30 days.
- Sign-in is limited to 10 attempts per 15 minutes per IP address.
- All queries are parameterised and every write is validated with Zod.
- Use a long `APP_PASSWORD`. Never commit `.env`.
