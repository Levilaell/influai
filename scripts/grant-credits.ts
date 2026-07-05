#!/usr/bin/env tsx
// CLI de admin: concede créditos a um usuário.
// Uso: pnpm grant -- --email fulano@x.com --amount 1000 [--note "beta tester"]
import "@influa/core/env";
import { getPool } from "@influa/core/db/client";
import { grantCredits, getBalance } from "@influa/core/credits/ledger";

const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[i + 1];
}

const email = args.email?.toLowerCase().trim();
const amount = parseInt(args.amount ?? "", 10);
if (!email || !Number.isFinite(amount) || amount <= 0) {
  console.error('Uso: pnpm grant -- --email <email> --amount <n> [--note "..."]');
  process.exit(1);
}

const { rows } = await getPool().query("select id, display_name from users where email = $1", [email]);
if (!rows[0]) {
  console.error(`Usuário não encontrado: ${email}`);
  process.exit(1);
}

await grantCredits({ userId: rows[0].id, amount, note: args.note ?? "grant de admin (beta)" });
const balance = await getBalance(rows[0].id);
console.log(`✓ +${amount} créditos para ${rows[0].display_name ?? email}`);
console.log(`  Saldo atual: ${balance}`);
await getPool().end();
