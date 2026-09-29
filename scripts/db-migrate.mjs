// Apply supabase/migrations/*.sql in order and store ALLOWED_EMAIL_DOMAIN in app_config.
// Usage: npm run db:migrate   (reads DATABASE_URL and ALLOWED_EMAIL_DOMAIN from .env.local)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(path.resolve(".env.local"));

const { DATABASE_URL, ALLOWED_EMAIL_DOMAIN } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(ALLOWED_EMAIL_DOMAIN || "")) throw new Error("ALLOWED_EMAIL_DOMAIN must be a domain like psgtech.ac.in");

const dir = path.resolve("supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const file of files) {
    await client.query("begin");
    await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    await client.query("commit");
    console.log(`applied ${file}`);
  }
  await client.query(
    "insert into public.app_config (key, value) values ('allowed_email_domain', lower($1)) on conflict (key) do update set value = excluded.value",
    [ALLOWED_EMAIL_DOMAIN],
  );
  console.log(`allowed email domain: ${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error(`migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
