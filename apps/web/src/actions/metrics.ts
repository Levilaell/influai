"use server";
import { revalidatePath } from "next/cache";
import { getPool } from "@influa/core/db/client";
import { analyzeBrandLearnings } from "@influa/core/brand/learn";
import { requireUserId } from "@/lib/auth";

export type LatestMetrics = { views: number; likes: number; comments: number; saves: number; recordedAt: string } | null;

export async function getLatestMetrics(videoId: string): Promise<LatestMetrics> {
  const { rows } = await getPool().query(
    "select views, likes, comments, saves, recorded_at from video_metrics where video_id = $1 order by recorded_at desc limit 1",
    [videoId]
  );
  const r = rows[0];
  return r ? { views: r.views, likes: r.likes, comments: r.comments, saves: r.saves, recordedAt: r.recorded_at } : null;
}

export async function recordVideoMetricsAction(
  videoId: string,
  m: { views: number; likes: number; comments: number; saves: number }
): Promise<{ error?: string } | undefined> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query("select id from videos where id = $1 and user_id = $2", [videoId, userId]);
  if (!rows[0]) return { error: "Vídeo não encontrado" };
  const clean = (n: number) => Math.max(0, Math.min(1_000_000_000, Math.floor(Number(n) || 0)));
  await pool.query(
    "insert into video_metrics (video_id, views, likes, comments, saves) values ($1, $2, $3, $4, $5)",
    [videoId, clean(m.views), clean(m.likes), clean(m.comments), clean(m.saves)]
  );
  revalidatePath(`/videos/${videoId}`);
}

const analyzeHits = new Map<string, number>();

export async function analyzeLearningsAction(brandId: string): Promise<{ error?: string; learnings?: string[]; sample?: number }> {
  const userId = await requireUserId();
  const { rows } = await getPool().query("select id from brands where id = $1 and user_id = $2", [brandId, userId]);
  if (!rows[0]) return { error: "Marca não encontrada" };

  const last = analyzeHits.get(userId) ?? 0;
  if (Date.now() - last < 30_000) return { error: "Espere um pouco antes de analisar de novo." };
  analyzeHits.set(userId, Date.now());

  try {
    const { learnings, sample } = await analyzeBrandLearnings(brandId);
    revalidatePath(`/brands/${brandId}`);
    return { learnings, sample };
  } catch (err: any) {
    return { error: `Falha ao analisar: ${String(err.message).slice(0, 160)}` };
  }
}
