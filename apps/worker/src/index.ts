// Worker: fila pg-boss no próprio Postgres. Filas registradas por fase:
//   ping (health)  ·  persona-candidates  ·  persona-sheet  ·  video-pipeline  ·  reconciler (cron)
import "@influa/core/env";
import PgBoss from "pg-boss";
import { env } from "@influa/core/env";

// pg-boss usa a pool de SESSÃO dedicada (5432) com poucas conexões por réplica;
// o app (getPool) usa a transaction pool (6543). Evita esgotar os 15 slots de sessão.
const boss = new PgBoss({
  connectionString: process.env.PGBOSS_DATABASE_URL ?? env("DATABASE_URL"),
  schema: "pgboss",
  max: 4, // pool session (5432) do pg-boss. 2 réplicas × 4 = 8 < limite 15 do pooler.
});
boss.on("error", (err) => console.error("[pg-boss]", err));

await boss.start();
console.log("[worker] pg-boss iniciado");

// Áudio e imagens de referência sobem para o storage do próprio Atlas via
// uploadMedia (packages/core/providers) — o Atlas busca do storage dele mesmo.
// Não depende mais de túnel/PUBLIC_BASE_URL público.
console.log("[worker] mídia p/ Atlas via uploadMedia (sem dependência de túnel)");

// ── Fila de health (fase 0) ──────────────────────────────────────────
await boss.createQueue("ping");
await boss.work("ping", async (jobs) => {
  for (const job of jobs) console.log(`[worker] pong ← ping enviado em ${(job.data as any)?.at}`);
});

// ── Jobs de produto (registrados nas fases 4-5) ──────────────────────
const { registerPersonaJobs } = await import("./jobs/persona.ts").catch(() => ({ registerPersonaJobs: null }));
if (registerPersonaJobs) await registerPersonaJobs(boss);

const { registerVideoJobs } = await import("./jobs/video-pipeline.ts").catch(() => ({ registerVideoJobs: null }));
if (registerVideoJobs) await registerVideoJobs(boss);

const { registerReconciler } = await import("./jobs/reconciler.ts").catch(() => ({ registerReconciler: null }));
if (registerReconciler) await registerReconciler(boss);

const { registerPublisher } = await import("./jobs/publisher.ts").catch(() => ({ registerPublisher: null }));
if (registerPublisher) await registerPublisher(boss);

const { registerLeadVideoJobs } = await import("./jobs/lead-video.ts").catch((e) => {
  console.error("[worker] lead-video falhou ao carregar:", e?.message);
  return { registerLeadVideoJobs: null };
});
if (registerLeadVideoJobs) await registerLeadVideoJobs(boss);

const { registerContentBatch } = await import("./jobs/content-batch.ts").catch(() => ({ registerContentBatch: null }));
if (registerContentBatch) await registerContentBatch(boss);

const { registerFirstVideoJobs } = await import("./jobs/first-video.ts").catch((e) => {
  console.error("[worker] first-video falhou ao carregar:", e?.message);
  return { registerFirstVideoJobs: null };
});
if (registerFirstVideoJobs) await registerFirstVideoJobs(boss);

// Auto-teste de boot: manda um ping pra provar que a fila funciona
await boss.send("ping", { at: new Date().toISOString() });
console.log("[worker] pronto — aguardando jobs");
