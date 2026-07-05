// Teste E2E da Fase 4: moderação + candidatos + idempotência + sheet via fila real.
// Uso: npx tsx scripts/test-persona-flow.ts  (requer worker rodando: pnpm dev)
import "@influa/core/env";
import PgBoss from "pg-boss";
import { getPool } from "@influa/core/db/client";
import { moderate } from "@influa/core/moderation/gate";
import { holdByRef, getBalance } from "@influa/core/credits/ledger";
import { estimateCandidatesCredits, estimateSheetCredits } from "@influa/core/config";
import { env } from "@influa/core/env";

const pool = getPool();
const boss = new PgBoss({ connectionString: env("DATABASE_URL"), schema: "pgboss" });
await boss.start();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function pollStatus(personaId: string, want: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pool.query("select status, error from personas where id = $1", [personaId]);
    if (rows[0].status === want) return;
    if (rows[0].status === "failed") throw new Error(`persona failed: ${rows[0].error}`);
    await sleep(3000);
  }
  throw new Error(`timeout esperando status=${want}`);
}

// 0. Usuário de teste
const { rows: users } = await pool.query("select id from users where email = 'levi@influa.app'");
const userId = users[0].id;
console.log(`saldo inicial: ${await getBalance(userId)}`);

// 1. Moderação deve BLOQUEAR celebridade
const blocked = await moderate("crie a persona idêntica à atriz Bruna Marquezine", "persona");
if (blocked.allowed) throw new Error("FALHA: moderação deixou passar celebridade!");
console.log(`✓ moderação bloqueou celebridade (${blocked.category})`);

// 2. Persona de teste
const { rows: p } = await pool.query(
  `insert into personas (user_id, name, slug, description, niche, voice_id, moderation)
   values ($1, 'Bia Teste', 'bia-teste', 'young brazilian woman, early 20s, straight black hair, hazel eyes, friendly smile', 'finanças pessoais', 'matilda', '{"allowed":true}')
   on conflict (user_id, slug) do update set status='draft', error=null returning id`,
  [userId]
);
const personaId = p[0].id;
console.log(`✓ persona criada: ${personaId}`);

// Limpeza de execuções anteriores do teste (simula o re-roll da action)
await pool.query("delete from persona_assets where persona_id = $1", [personaId]);

// 3. Candidatos (hold + job) — batch = holds anteriores + 1 (igual à action)
const { rows: prior } = await pool.query(
  `select count(*)::int as n from credit_ledger
   where persona_id = $1 and entry_type = 'hold' and ref like $2`,
  [personaId, `persona:${personaId}:candidates:%`]
);
const batchN = prior[0].n + 1;
const refC = `persona:${personaId}:candidates:${batchN}`;
await holdByRef({ userId, personaId, ref: refC, amount: estimateCandidatesCredits(), note: "teste candidatos" });
await pool.query("update personas set status='candidates_generating' where id=$1", [personaId]);
await boss.send("persona-candidates", { personaId, batch: batchN }, { singletonKey: refC });
console.log(`▶ aguardando candidatos (batch ${batchN})...`);
await pollStatus(personaId, "candidates_ready", 300000);
const { rows: cand } = await pool.query(
  "select id from persona_assets where persona_id=$1 and kind='candidate' order by idx", [personaId]
);
console.log(`✓ ${cand.length} candidatos gerados`);
if (cand.length !== 4) throw new Error("esperava 4 candidatos");

// 4. IDEMPOTÊNCIA: re-envia o mesmo job; steps cacheados => nada regenera
await boss.send("persona-candidates", { personaId, batch: batchN }, { singletonKey: `${refC}:retry` });
await sleep(12000);
const { rows: cand2 } = await pool.query(
  "select count(*)::int as n from persona_assets where persona_id=$1 and kind='candidate'", [personaId]
);
if (cand2[0].n !== 4) throw new Error(`IDEMPOTÊNCIA FALHOU: ${cand2[0].n} candidatos (esperava 4)`);
console.log("✓ idempotência: re-execução não regenerou nem recobrou");

// 5. Sheet (escolhe o primeiro)
const refS = `persona:${personaId}:sheet`;
await holdByRef({ userId, personaId, ref: refS, amount: estimateSheetCredits(), note: "teste sheet" });
await pool.query("update personas set status='sheet_generating' where id=$1", [personaId]);
await boss.send("persona-sheet", { personaId, chosenAssetId: cand[0].id }, { singletonKey: refS });
console.log("▶ aguardando character sheet...");
await pollStatus(personaId, "ready", 300000);

const { rows: sheet } = await pool.query(
  "select kind from persona_assets where persona_id=$1 and kind != 'candidate' order by idx", [personaId]
);
console.log(`✓ sheet: ${sheet.map((s: any) => s.kind).join(", ")}`);

// 6. Invariantes do ledger
const { rows: ledger } = await pool.query(
  `select ref, entry_type, amount from credit_ledger where persona_id = $1 order by created_at`, [personaId]
);
console.table(ledger);
console.log(`saldo final: ${await getBalance(userId)}`);
console.log("✔ PERSONA_FLOW_OK");
process.exit(0);
