"use server";
import { revalidatePath } from "next/cache";
import { getPool } from "@influa/core/db/client";
import { requireUserId } from "@/lib/auth";

export type ScheduledPost = {
  id: string;
  videoId: string;
  videoTitle: string | null;
  scheduledAt: string;
  caption: string;
  status: string;
  error: string | null;
};

export async function schedulePostAction(
  videoId: string,
  scheduledAtISO: string,
  caption: string
): Promise<{ error?: string } | undefined> {
  const userId = await requireUserId();
  const when = new Date(scheduledAtISO);
  if (isNaN(when.getTime())) return { error: "Data inválida" };
  if (when.getTime() < Date.now() - 60_000) return { error: "Escolha um horário no futuro" };

  const pool = getPool();
  const { rows } = await pool.query(
    "select id, brand_id, status from videos where id = $1 and user_id = $2",
    [videoId, userId]
  );
  if (!rows[0]) return { error: "Vídeo não encontrado" };
  if (rows[0].status !== "ready") return { error: "Só dá pra agendar vídeos prontos" };

  await pool.query(
    `insert into scheduled_posts (user_id, brand_id, video_id, caption, scheduled_at)
     values ($1, $2, $3, $4, $5)`,
    [userId, rows[0].brand_id, videoId, caption.slice(0, 2200), when.toISOString()]
  );
  revalidatePath(`/videos/${videoId}`);
  revalidatePath(`/brands/${rows[0].brand_id}`);
}

export async function cancelScheduledPostAction(id: string): Promise<void> {
  const userId = await requireUserId();
  const { rows } = await getPool().query(
    "update scheduled_posts set status = 'canceled' where id = $1 and user_id = $2 and status in ('scheduled','failed') returning brand_id",
    [id, userId]
  );
  if (rows[0]) revalidatePath(`/brands/${rows[0].brand_id}`);
}

export async function disconnectInstagramAction(brandId: string): Promise<void> {
  const userId = await requireUserId();
  await getPool().query("update brands set instagram = null where id = $1 and user_id = $2", [brandId, userId]);
  revalidatePath(`/brands/${brandId}`);
}

export async function listScheduledPosts(brandId: string): Promise<ScheduledPost[]> {
  const { rows } = await getPool().query(
    `select sp.id, sp.video_id, sp.scheduled_at, sp.caption, sp.status, sp.error,
            v.script->>'title' as title
     from scheduled_posts sp join videos v on v.id = sp.video_id
     where sp.brand_id = $1 order by sp.scheduled_at desc`,
    [brandId]
  );
  return rows.map((r: any) => ({
    id: r.id, videoId: r.video_id, videoTitle: r.title,
    scheduledAt: r.scheduled_at, caption: r.caption, status: r.status, error: r.error,
  }));
}
