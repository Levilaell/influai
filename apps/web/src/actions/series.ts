"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool } from "@influa/core/db/client";
import { normalizeStyle } from "@influa/core/pipeline/style";
import { lengthSpec } from "@influa/core/pipeline/format";
import { scriptSchema } from "@influa/core/schemas";
import { estimateVideoCredits } from "@influa/core/config";
import { holdAndQueueVideo, InsufficientCreditsError } from "@influa/core/credits/ledger";
import { requireUserId } from "@/lib/auth";
import { sendJob } from "@/lib/queue";

// Limite leve por usuário (a geração em lote é vários Claude de uma vez).
const batchHits = new Map<string, number[]>();
function rateOk(userId: string): boolean {
  const now = Date.now();
  const arr = (batchHits.get(userId) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (arr.length >= 6) return false;
  arr.push(now);
  batchHits.set(userId, arr);
  return true;
}

function scriptChars(s: { shots: { dialogue: string }[] }): number {
  return s.shots.reduce((a, x) => a + x.dialogue.length, 0);
}

/**
 * "Gere minha semana": ideias variadas (memória antirrepetição) → N rascunhos
 * prontos para revisar. Não gasta créditos ainda — só cria os drafts.
 */
export async function generateWeekAction(_prev: unknown, formData: FormData): Promise<{ error?: string } | undefined> {
  const userId = await requireUserId();
  const brandId = String(formData.get("brandId") ?? "");
  const personaId = String(formData.get("personaId") ?? "");
  const count = Math.min(7, Math.max(2, Number(formData.get("count") ?? 5)));
  const len = lengthSpec(String(formData.get("length") ?? "curto"));
  const shots = len.shots;
  let style: unknown = {};
  try {
    style = normalizeStyle(JSON.parse(String(formData.get("style") ?? "{}")));
  } catch {
    /* padrão */
  }

  if (!rateOk(userId)) return { error: "Muitas gerações em lote em pouco tempo. Espere um pouco." };

  const pool = getPool();
  const { rows } = await pool.query(
    "select id from personas where id = $1 and user_id = $2 and brand_id = $3 and status = 'ready'",
    [personaId, userId, brandId]
  );
  if (!rows[0]) return { error: "Persona não encontrada ou não está pronta" };

  const objective = String(formData.get("objective") ?? "");

  // Cria o registro do lote e dispara o job de background (retorno imediato).
  const { rows: batch } = await pool.query(
    "insert into content_batches (brand_id, user_id, requested) values ($1, $2, $3) returning id",
    [brandId, userId, count]
  );
  await sendJob(
    "content-batch",
    { batchId: batch[0].id, brandId, personaId, count, shots, segments: len.segments, lengthGuide: len.guide, style, objective },
    batch[0].id
  );
  redirect(`/brands/${brandId}`);
}

/** Enfileira TODOS os rascunhos da marca (gera de fato). Para se faltar crédito. */
export async function enqueueAllDraftsAction(brandId: string): Promise<{ queued: number; skipped: number; error?: string }> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select id, script, style, segments from videos where brand_id = $1 and user_id = $2 and status in ('draft','estimated') order by created_at",
    [brandId, userId]
  );

  let queued = 0;
  let skipped = 0;
  for (const v of rows) {
    try {
      const estimate = estimateVideoCredits(scriptChars(scriptSchema.parse(v.script)), v.style?.broll === true, v.segments || 1);
      await holdAndQueueVideo({ userId, videoId: v.id, estimate });
      await sendJob("video-pipeline", { videoId: v.id }, v.id);
      queued++;
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        skipped = rows.length - queued;
        break; // acabou o crédito — para aqui
      }
      skipped++;
    }
  }
  revalidatePath(`/brands/${brandId}`);
  return { queued, skipped };
}
