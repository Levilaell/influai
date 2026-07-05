// Refaz o vídeo da Marina que falhou (agora com uploadMedia, sem túnel).
// Cria um novo draft com o mesmo roteiro e roda o pipeline pela fila real.
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

// Pega o roteiro do vídeo que falhou da Marina
const { rows: failed } = await pool.query(
  `select v.user_id, v.persona_id, v.topic, v.script from videos v
   join personas p on p.id = v.persona_id
   where p.name = 'Marina' and v.status = 'failed' order by v.created_at desc limit 1`
);
if (!failed[0]) { console.log("nenhum vídeo failed da Marina"); process.exit(1); }
const { user_id, persona_id, topic, script } = failed[0];
console.log(`saldo inicial: ${await getBalance(user_id)}`);

const { rows: v } = await pool.query(
  `insert into videos (user_id, persona_id, topic, script, status)
   values ($1,$2,$3,$4,'draft') returning id`,
  [user_id, persona_id, topic, JSON.stringify(script)]
);
const videoId = v[0].id;
const chars = script.shots.reduce((s: number, x: any) => s + x.dialogue.length, 0);
const estimate = estimateVideoCredits(chars);
await holdAndQueueVideo({ userId: user_id, videoId, estimate });
await boss.send("video-pipeline", { videoId }, { singletonKey: videoId });
console.log(`▶ novo vídeo ${videoId} (${estimate} créditos) rodando...`);

const deadline = Date.now() + 900000;
while (Date.now() < deadline) {
  await sleep(4000);
  const { rows } = await pool.query("select status, error, progress from videos where id=$1", [videoId]);
  const { status, progress, error } = rows[0];
  process.stdout.write(`\r  ${status} — ${progress?.message ?? ""}                    `);
  if (status === "ready") {
    const { rows: vf } = await pool.query("select final_storage_key, actual_cost_usd from videos where id=$1", [videoId]);
    const ok = getStorage().exists(vf[0].final_storage_key);
    console.log(`\n✔ PRONTO — arquivo existe: ${ok} · custo real $${vf[0].actual_cost_usd}`);
    console.log(`  ${vf[0].final_storage_key}`);
    process.exit(0);
  }
  if (status === "failed") { console.log(`\n✗ FALHOU: ${error}`); process.exit(1); }
}
console.log("\ntimeout"); process.exit(1);
