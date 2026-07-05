// Runner de migrations: aplica src/db/migrations/*.sql em ordem, uma vez cada.
import "../env.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./client.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "migrations");

const pool = getPool();
await pool.query(`create table if not exists _migrations (
  name text primary key, applied_at timestamptz not null default now()
)`);

const applied = new Set(
  (await pool.query("select name from _migrations")).rows.map((r) => r.name)
);

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  if (applied.has(file)) {
    console.log(`↺ ${file} (já aplicada)`);
    continue;
  }
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("insert into _migrations (name) values ($1)", [file]);
    await client.query("COMMIT");
    console.log(`✓ ${file}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`✗ ${file}: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    client.release();
  }
}

console.log("Migrations OK");
await pool.end();
