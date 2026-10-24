/**
 * npm run migrate              apply database migrations
 * npm run remind               send today's reminder (for a Render Cron Job)
 * npm run seed:examples        load example data into an empty database
 * npm run import -- file.json  import a JSON export (from this app or the claude.ai version)
 */
import "./env";
import fs from "node:fs";
import { migrate, pool, tx } from "./db";
import { runReminders } from "./reminders";
import { seedExamples } from "./samples";
import { saveSettings, upsert, type Collection } from "./repo";

const [cmd, arg] = process.argv.slice(2);

async function importFile(file: string) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const counts: Record<string, number> = {};
  await tx(async (c) => {
    // Parents before children so foreign keys resolve.
    for (const col of ["accounts", "emis", "chits", "sips", "txns"] as Collection[]) {
      const rows: Record<string, unknown>[] = raw[col] || [];
      // Cards point at the bank they're paid from, so insert those banks first.
      if (col === "accounts") rows.sort((a, b) => Number(!!a.payFromId) - Number(!!b.payFromId));
      for (const r of rows) {
        const { id, ...rest } = r;
        if (typeof id !== "string") continue;
        if (col === "txns" && rest.toAccountId === undefined) rest.toAccountId = null;
        await upsert(col, id, rest, c);
      }
      counts[col] = rows.length;
    }
    if (raw.settings) await saveSettings(raw.settings, c);
  });
  console.log("Imported", counts);
}

try {
  await migrate();
  if (cmd === "migrate") console.log("Database is up to date.");
  else if (cmd === "remind") console.log(JSON.stringify(await runReminders({ force: arg === "--force" }), null, 2));
  else if (cmd === "seed") console.log(`Inserted ${await seedExamples()} example records.`);
  else if (cmd === "import") {
    if (!arg) throw new Error("Usage: npm run import -- path/to/export.json");
    await importFile(arg);
  } else {
    console.log("Commands: migrate | remind [--force] | seed | import <file>");
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
