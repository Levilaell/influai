// Reconciler (cron 1/min) — rede de segurança para janelas não-transacionais:
//  1. vídeos 'queued' órfãos (crash entre COMMIT do hold e boss.send) => reenvia
//  2. vídeos não-terminais travados >60min => failed + devolve créditos
//  3. personas *_generating travadas >60min => failed + devolve holds pendentes
import type PgBoss from "pg-boss";
import { getPool } from "@influa/core/db/client";
import { releaseVideoHold, releaseRefHold } from "@influa/core/credits/ledger";
import { setVideoFailed, setPersonaStatus } from "../progress.ts";

export async function registerReconciler(boss: PgBoss) {
  await boss.createQueue("reconciler");
  await boss.schedule("reconciler", "* * * * *");

  await boss.work("reconciler", { batchSize: 1 }, async () => {
    const pool = getPool();

    // 1. queued órfãos (>2min sem avançar) — singletonKey deduplica reenvios
    const { rows: orphans } = await pool.query(
      `select id from videos where status = 'queued' and updated_at < now() - interval '2 minutes'`
    );
    for (const { id } of orphans) {
      await boss.send("video-pipeline", { videoId: id }, { singletonKey: id });
      console.log(`[reconciler] reenviado vídeo queued órfão ${id}`);
    }

    // 2. vídeos travados em estado não-terminal
    const { rows: stuckVideos } = await pool.query(
      `select id from videos
       where status not in ('draft','estimated','ready','failed','canceled')
         and updated_at < now() - interval '60 minutes'`
    );
    for (const { id } of stuckVideos) {
      await releaseVideoHold(id, "expirado pelo reconciler");
      await setVideoFailed(id, "Geração expirou. Créditos devolvidos — tente novamente.");
      console.log(`[reconciler] vídeo travado ${id} => failed + release`);
    }

    // 3. personas travadas
    const { rows: stuckPersonas } = await pool.query(
      `select id from personas
       where status in ('candidates_generating','sheet_generating')
         and updated_at < now() - interval '60 minutes'`
    );
    for (const { id } of stuckPersonas) {
      const { rows: holds } = await pool.query(
        `select l.ref from credit_ledger l
         where l.persona_id = $1 and l.entry_type = 'hold'
           and not exists (
             select 1 from credit_ledger r where r.ref = l.ref and r.entry_type = 'hold_release'
           )`,
        [id]
      );
      for (const { ref } of holds) await releaseRefHold(ref, "expirado pelo reconciler");
      await setPersonaStatus(id, "failed", "Geração expirou. Créditos devolvidos.");
      console.log(`[reconciler] persona travada ${id} => failed + release`);
    }
  });

  console.log("[worker] reconciler agendado (1/min)");
}
