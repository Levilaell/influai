"use server";
import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { generateScriptInput, scriptSchema } from "@influa/core/schemas";
import { generateScript } from "@influa/core/pipeline/script";
import { objectiveGuide, lengthSpec } from "@influa/core/pipeline/format";
import { getBrandMemory, memoryForPrompt } from "@influa/core/brand/memory";
import { normalizeStyle } from "@influa/core/pipeline/style";
import { holdAndQueueVideo, InsufficientCreditsError } from "@influa/core/credits/ledger";
import { estimateVideoCredits } from "@influa/core/config";
import { requireUserId } from "@/lib/auth";
import { sendJob } from "@/lib/queue";

export type ActionState = { error?: string } | undefined;

function scriptChars(script: { shots: { dialogue: string }[] }): number {
  return script.shots.reduce((s, x) => s + x.dialogue.length, 0);
}

/** Fábrica passo 1: tema -> roteiro (Claude) -> vídeo draft -> edição. */
export async function createVideoDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const len = lengthSpec(String(formData.get("length") ?? "curto"));
  const parsed = generateScriptInput.safeParse({
    personaId: formData.get("personaId"),
    topic: formData.get("topic"),
    shots: len.shots,
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { personaId, topic, shots } = parsed.data;

  const pool = getPool();
  const { rows } = await pool.query(
    "select * from personas where id = $1 and user_id = $2 and status = 'ready'",
    [personaId, userId]
  );
  const persona = rows[0];
  if (!persona) return { error: "Persona não encontrada ou ainda não está pronta" };

  // Recursos da marca (logo/produto) escolhidos p/ aparecer na cena
  let referenceKeys: string[] = [];
  const rawRefs = formData.get("referenceKeys");
  if (typeof rawRefs === "string" && rawRefs) {
    try {
      const ids = JSON.parse(rawRefs) as string[];
      if (Array.isArray(ids) && ids.length) {
        const { rows: ba } = await pool.query(
          "select storage_key from brand_assets where id = any($1) and brand_id = $2",
          [ids.slice(0, 4), persona.brand_id]
        );
        referenceKeys = ba.map((r: any) => r.storage_key);
      }
    } catch {
      /* ignora seleção malformada */
    }
  }

  // Estilo escolhido pelo usuário (cenário + dinâmica de câmera + cartela)
  let style: unknown = {};
  const rawStyle = formData.get("style");
  if (typeof rawStyle === "string" && rawStyle) {
    try {
      style = normalizeStyle(JSON.parse(rawStyle));
    } catch {
      /* usa padrão */
    }
  }

  // Voz escolhida no form. Igual à da persona => sem override (troca futura da persona vale).
  const rawVoice = String(formData.get("voice") ?? "").trim();
  const voiceOverride =
    /^[A-Za-z0-9]{8,40}$/.test(rawVoice) && rawVoice !== persona.voice_id ? rawVoice : null;

  // Memória operacional da marca (temas já cobertos, estilo) injetada no roteiro
  const memory = memoryForPrompt(await getBrandMemory(persona.brand_id));

  let script;
  try {
    script = await generateScript({
      personaName: persona.name,
      personaDescription: persona.description,
      niche: persona.niche,
      topic,
      shots,
      objectiveGuide: objectiveGuide(String(formData.get("objective") ?? "")),
      formatGuide: len.guide, // duração; o objetivo já define a estrutura
      memoryContext: memory || undefined,
    });
  } catch (err: any) {
    return { error: `Falha ao gerar o roteiro: ${String(err.message).slice(0, 200)}` };
  }

  const { rows: v } = await pool.query(
    `insert into videos (user_id, brand_id, persona_id, topic, script, status, reference_keys, style, segments, voice_override)
     values ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9) returning id`,
    [userId, persona.brand_id, personaId, topic, JSON.stringify(script), JSON.stringify(referenceKeys), JSON.stringify(style), len.segments, voiceOverride]
  );
  redirect(`/videos/${v[0].id}`);
}

/** Volta do rascunho pro formulário (ajustar tema/estilo/música/voz). Apaga o rascunho —
 *  o roteiro é grátis, então recomeçar não custa nada pro usuário. */
export async function backToSetupAction(videoId: string): Promise<ActionState> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select persona_id, topic, status from videos where id = $1 and user_id = $2",
    [videoId, userId]
  );
  const v = rows[0];
  if (!v) return { error: "Vídeo não encontrado" };
  if (!["draft", "estimated"].includes(v.status)) return { error: "Este vídeo já foi processado" };
  await pool.query("delete from videos where id = $1", [videoId]);
  const topic = encodeURIComponent(String(v.topic ?? "").slice(0, 300));
  redirect(`/videos/new?persona=${v.persona_id}&topic=${topic}`);
}

/** Salva o roteiro editado (só em draft). */
export async function updateScriptAction(videoId: string, scriptJson: unknown): Promise<ActionState> {
  const userId = await requireUserId();
  const parsed = scriptSchema.safeParse(scriptJson);
  if (!parsed.success) return { error: `Roteiro inválido: ${parsed.error.errors[0].message}` };

  const { rowCount } = await getPool().query(
    `update videos set script = $3 where id = $1 and user_id = $2 and status in ('draft','estimated','failed')`,
    [videoId, userId, JSON.stringify(parsed.data)]
  );
  if (!rowCount) return { error: "Vídeo não editável neste estado" };
  revalidatePath(`/videos/${videoId}`);
}

/** Fábrica passo 2: hold transacional + enfileira o pipeline. */
export async function enqueueVideoAction(videoId: string): Promise<ActionState> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select * from videos where id = $1 and user_id = $2",
    [videoId, userId]
  );
  const video = rows[0];
  if (!video) return { error: "Vídeo não encontrado" };
  if (!["draft", "estimated"].includes(video.status)) return { error: "Vídeo já processado ou em processamento" };

  const script = scriptSchema.parse(video.script);
  const broll = video.style?.broll === true;
  const estimate = estimateVideoCredits(scriptChars(script), broll, video.segments || 1); // texto FINAL + segmentos

  try {
    await holdAndQueueVideo({ userId, videoId, estimate });
  } catch (err) {
    if (err instanceof InsufficientCreditsError)
      return { error: `Créditos insuficientes (${err.balance}/${err.needed}). Assine um plano pra criar sem limite.` };
    throw err;
  }
  // Clique duplo: holdAndQueueVideo retorna false (hold já existe) e o
  // singletonKey deduplica o job — ambos idempotentes.
  await sendJob("video-pipeline", { videoId }, videoId);
  revalidatePath(`/videos/${videoId}`);
}

/** Retry pós-falha: novo vídeo com o mesmo roteiro (ledger permanece auditável). */
export async function retryVideoAction(videoId: string): Promise<ActionState> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select * from videos where id = $1 and user_id = $2 and status = 'failed'",
    [videoId, userId]
  );
  if (!rows[0]) return { error: "Apenas vídeos com falha podem ser refeitos" };

  const { rows: v } = await pool.query(
    `insert into videos (user_id, brand_id, persona_id, topic, script, status)
     values ($1, $2, $3, $4, $5, 'draft') returning id`,
    [userId, rows[0].brand_id, rows[0].persona_id, rows[0].topic, JSON.stringify(rows[0].script)]
  );
  redirect(`/videos/${v[0].id}`);
}

/** Remove um dir de storage best-effort (local). O ledger é preservado (video_id vira SET NULL). */
function rmStorageDir(prefix: string) {
  try {
    fs.rmSync(path.dirname(getStorage().getPath(`${prefix}/x`)), { recursive: true, force: true });
  } catch {
    /* arquivos podem não existir */
  }
}

/** Exclui um vídeo (arquivos + linha). O extrato de créditos permanece (auditoria). */
export async function deleteVideoAction(videoId: string): Promise<void> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query("select brand_id from videos where id = $1 and user_id = $2", [videoId, userId]);
  if (!rows[0]) return;
  rmStorageDir(`videos/${videoId}`);
  await pool.query("delete from videos where id = $1 and user_id = $2", [videoId, userId]);
  redirect(`/brands/${rows[0].brand_id}`);
}

/** Trocar voz e refazer: novo vídeo com o mesmo roteiro/estilo, mas outra voz. */
export async function changeVideoVoiceAction(videoId: string, voiceId: string): Promise<ActionState> {
  const userId = await requireUserId();
  if (voiceId.length < 3) return { error: "Escolha uma voz" };
  const pool = getPool();
  const { rows } = await pool.query(
    "select * from videos where id = $1 and user_id = $2 and status = 'ready'",
    [videoId, userId]
  );
  const v = rows[0];
  if (!v) return { error: "Vídeo não encontrado" };

  const { rows: nv } = await pool.query(
    `insert into videos (user_id, brand_id, persona_id, topic, script, status, reference_keys, style, segments, voice_override)
     values ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9) returning id`,
    [userId, v.brand_id, v.persona_id, v.topic, JSON.stringify(v.script), JSON.stringify(v.reference_keys ?? []),
     JSON.stringify(v.style ?? {}), v.segments ?? 1, voiceId]
  );
  redirect(`/videos/${nv[0].id}`);
}

/** Reporta um defeito no vídeo pronto (você revisa e reembolsa manualmente se for caso). */
export async function reportVideoAction(videoId: string, reason: string): Promise<ActionState> {
  const userId = await requireUserId();
  const pool = getPool();
  const { rows } = await pool.query(
    "select id from videos where id = $1 and user_id = $2 and status = 'ready'",
    [videoId, userId]
  );
  if (!rows[0]) return { error: "Vídeo não encontrado" };
  // evita spam: 1 report aberto por vídeo
  await pool.query(
    `insert into video_reports (video_id, user_id, reason)
     select $1, $2, $3
     where not exists (select 1 from video_reports where video_id = $1 and status = 'open')`,
    [videoId, userId, reason.slice(0, 500)]
  );
  revalidatePath(`/videos/${videoId}`);
}
