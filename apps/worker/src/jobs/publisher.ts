// Publisher (cron 1/min) — pega publicações agendadas cujo horário chegou e
// publica na rede. Idempotente por status: só processa 'scheduled' vencidos.
import type PgBoss from "pg-boss";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { hostBuffer } from "../assets.ts";
import { publishReel } from "@influa/core/social/instagram";
import fs from "node:fs";

export async function registerPublisher(boss: PgBoss) {
  await boss.createQueue("publisher");
  await boss.schedule("publisher", "* * * * *");

  await boss.work("publisher", { batchSize: 1 }, async () => {
    const pool = getPool();
    // trava otimista: marca como 'publishing' os vencidos antes de trabalhar
    const { rows: due } = await pool.query(
      `update scheduled_posts sp set status = 'publishing', attempts = attempts + 1
       where sp.id in (
         select id from scheduled_posts
         where status = 'scheduled' and scheduled_at <= now()
         order by scheduled_at limit 5
       )
       returning sp.id, sp.brand_id, sp.video_id, sp.caption`
    );

    for (const post of due) {
      try {
        const { rows: b } = await pool.query("select instagram from brands where id = $1", [post.brand_id]);
        const conn = b[0]?.instagram;
        const simulate = process.env.SIMULATE_PUBLISH === "1";
        if (!conn && !simulate) {
          await pool.query(
            "update scheduled_posts set status = 'failed', error = $2 where id = $1",
            [post.id, "Instagram não conectado (aprovação Meta pendente)"]
          );
          continue;
        }

        const { rows: v } = await pool.query("select final_storage_key, status from videos where id = $1", [post.video_id]);
        if (v[0]?.status !== "ready" || !v[0]?.final_storage_key) {
          await pool.query("update scheduled_posts set status = 'failed', error = $2 where id = $1", [post.id, "Vídeo não está pronto"]);
          continue;
        }

        // URL pública que a Meta consegue baixar (R2 presigned)
        const buf = fs.readFileSync(getStorage().getPath(v[0].final_storage_key));
        const videoUrl = await hostBuffer(`publish/${post.video_id}/reel.mp4`, buf, "video/mp4");

        const { mediaId } = await publishReel({
          conn: conn ?? { ig_user_id: "sim", access_token: "sim" },
          videoUrl,
          caption: post.caption,
        });
        await pool.query(
          "update scheduled_posts set status = 'published', external_id = $2, error = null where id = $1",
          [post.id, mediaId]
        );
        console.log(`[publisher] ✔ post ${post.id} publicado (${mediaId})`);
      } catch (err) {
        await pool.query(
          "update scheduled_posts set status = 'failed', error = $2 where id = $1",
          [post.id, String((err as Error).message).slice(0, 300)]
        );
        console.warn(`[publisher] ✗ post ${post.id}: ${(err as Error).message}`);
      }
    }
  });
}
