// Teste E2E da Fase 5: Fábrica de vídeo pela fila real.
//  (a) vídeo completo -> ready + arquivo final + ledger fechado
//  (b) duplo clique -> um único hold (idempotência transacional)
//  (c) falha terminal (persona sem sheet) -> failed + SUM(video)=0
// Uso: npx tsx scripts/test-video-flow.ts  (requer worker rodando)
import "@influa/core/env";
import PgBoss from "pg-boss";
import { getPool } from "@influa/core/db/client";
import { holdAndQueueVideo, getBalance } from "@influa/core/credits/ledger";
import { estimateVideoCredits } from "@influa/core/config";
import { getStorage } from "@influa/core/storage/index";
import { env } from "@influa/core/env";

const pool = getPool();
const boss = new PgBoss({ connectionString: env("DATABASE_URL"), schema: "pgboss" });
await boss.start();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SCRIPT = {
  title: "O truque do Pix que ninguém te contou",
  hook: "Você sabia que dá pra agendar Pix recorrente?",
  narration: "Você sabia que dá pra agendar Pix recorrente e nunca mais esquecer uma conta? Abre o app do banco e configura em segundos.",
  shots: [
    {
      visual_prompt:
        "cozy home office with plants, young woman talking to camera holding phone, warm afternoon light",
      dialogue: "Você sabia que dá pra agendar Pix recorrente e nunca mais esquecer uma conta?",
      camera: "selfie angle",
    },
    {
      visual_prompt:
        "same cozy home office, same outfit, woman smiling pointing at camera, warm light",
      dialogue: "Abre o app do seu banco, busca Pix agendado, e pronto. Me segue pra mais dicas!",
      camera: "medium shot",
    },
  ],
  hashtags: ["pix", "financas", "dicas"],
};

async function pollVideo(videoId: string, wantAny: string[], timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pool.query("select status, error, progress from videos where id = $1", [videoId]);
    const { status, progress } = rows[0];
    if (wantAny.includes(status)) return status;
    process.stdout.write(`\r  status=${status} ${progress?.message ?? ""}          `);
    await sleep(4000);
  }
  throw new Error(`timeout esperando ${wantAny}`);
}

const { rows: users } = await pool.query("select id from users where email = 'levi@influa.app'");
const userId = users[0].id;
const { rows: personas } = await pool.query(
  "select id from personas where slug = 'bia-teste' and status = 'ready'"
);
const personaId = personas[0].id;
console.log(`saldo inicial: ${await getBalance(userId)}`);

// ── (a+b) Vídeo completo com teste de duplo clique ─────────────────
const chars = SCRIPT.shots.reduce((s, x) => s + x.dialogue.length, 0);
const estimate = estimateVideoCredits(chars);
const { rows: v } = await pool.query(
  `insert into videos (user_id, persona_id, topic, script, status)
   values ($1, $2, 'teste pix', $3, 'draft') returning id`,
  [userId, personaId, JSON.stringify(SCRIPT)]
);
const videoId = v[0].id;
console.log(`✓ vídeo draft ${videoId} (estimativa ${estimate} créditos p/ ${chars} chars)`);

const first = await holdAndQueueVideo({ userId, videoId, estimate });
const second = await holdAndQueueVideo({ userId, videoId, estimate }); // "duplo clique"
if (!first || second) throw new Error(`duplo clique falhou: first=${first} second=${second}`);
const { rows: holds } = await pool.query(
  "select count(*)::int as n from credit_ledger where video_id = $1 and entry_type = 'hold'",
  [videoId]
);
if (holds[0].n !== 1) throw new Error(`esperava 1 hold, achei ${holds[0].n}`);
console.log("✓ duplo clique => um único hold");

await boss.send("video-pipeline", { videoId }, { singletonKey: videoId });
await boss.send("video-pipeline", { videoId }, { singletonKey: videoId }); // dedupe
console.log("▶ pipeline rodando...");
const status = await pollVideo(videoId, ["ready", "failed"], 900000);
console.log("");
if (status !== "ready") {
  const { rows } = await pool.query("select error from videos where id = $1", [videoId]);
  throw new Error(`vídeo falhou: ${rows[0].error}`);
}

const { rows: vf } = await pool.query(
  "select final_storage_key, actual_cost_usd from videos where id = $1",
  [videoId]
);
if (!getStorage().exists(vf[0].final_storage_key)) throw new Error("final.mp4 não está no storage!");
console.log(`✓ vídeo pronto: ${vf[0].final_storage_key} (custo real $${vf[0].actual_cost_usd})`);

const { rows: vledger } = await pool.query(
  "select entry_type, amount from credit_ledger where video_id = $1 order by created_at",
  [videoId]
);
console.table(vledger);

// ── (c) Falha terminal: persona 'ready' SEM character sheet ────────
console.log("▶ teste de falha terminal (persona sem sheet)...");
const { rows: pv } = await pool.query(
  `insert into personas (user_id, name, slug, description, voice_id, status, moderation)
   values ($1, 'Persona Vazia', 'persona-vazia', 'test empty persona', 'matilda', 'ready', '{}')
   on conflict (user_id, slug) do update set status = 'ready' returning id`,
  [userId]
);
const { rows: v2 } = await pool.query(
  `insert into videos (user_id, persona_id, topic, script, status)
   values ($1, $2, 'teste falha', $3, 'draft') returning id`,
  [userId, pv[0].id, JSON.stringify(SCRIPT)]
);
const failId = v2[0].id;
await holdAndQueueVideo({ userId, videoId: failId, estimate });
await boss.send("video-pipeline", { videoId: failId }, { singletonKey: failId });
const failStatus = await pollVideo(failId, ["failed", "ready"], 600000);
console.log("");
if (failStatus !== "failed") throw new Error("esperava failed!");
const { rows: sum } = await pool.query(
  "select coalesce(sum(amount),0)::int as s from credit_ledger where video_id = $1",
  [failId]
);
if (sum[0].s !== 0) throw new Error(`INVARIANTE VIOLADO: SUM=${sum[0].s} para vídeo failed`);
console.log("✓ falha terminal: créditos 100% devolvidos (SUM=0)");

console.log(`saldo final: ${await getBalance(userId)}`);
console.log("✔ VIDEO_FLOW_OK");
process.exit(0);
