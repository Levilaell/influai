// Adapter Atlas Cloud — porte fiel de prototype/lib/providers.js.
// ATENÇÃO (aprendido na prática): o Atlas IGNORA campos desconhecidos
// silenciosamente — nome de campo errado não dá erro, dá resultado errado.
// Payloads validados contra https://static.atlascloud.ai/model/schema/<slug>.json
import { env } from "../env.ts";
import { ATLAS } from "../config.ts";

export interface AtlasCallbacks {
  onPoll?: () => void;
}

function atlasHeaders() {
  return {
    Authorization: `Bearer ${env("ATLAS_API_KEY")}`,
    "Content-Type": "application/json",
  };
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return { raw: await res.text().catch(() => "") };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Portão global de concorrência do Atlas ──────────────────────────────
// A conta aguenta ~1 prediction concorrente (empírico). SEM isso, um take de vídeo e a
// geração de rostos de uma persona (filas diferentes no mesmo worker) rodam juntos → 429.
// O semáforo serializa TODAS as predictions (imagem + vídeo) no processo. Tunável por env.
const ATLAS_MAX = Math.max(1, Number(process.env.ATLAS_CONCURRENCY ?? "1"));
let atlasActive = 0;
const atlasWaiters: (() => void)[] = [];
async function acquireAtlasSlot(): Promise<void> {
  if (atlasActive < ATLAS_MAX) {
    atlasActive++;
    return;
  }
  await new Promise<void>((res) => atlasWaiters.push(res)); // slot transferido ao ser resolvido
}
function releaseAtlasSlot(): void {
  const next = atlasWaiters.shift();
  if (next) next(); // passa o slot direto (atlasActive não muda)
  else atlasActive = Math.max(0, atlasActive - 1);
}

export async function atlasSubmitAndPoll(
  path: string,
  payload: Record<string, unknown>,
  opts: { intervalMs: number; timeoutMs: number } & AtlasCallbacks
): Promise<string> {
  await acquireAtlasSlot();
  try {
  const res = await fetch(`${ATLAS.baseUrl}${path}`, {
    method: "POST",
    headers: atlasHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(`Atlas ${path} ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);

  const id = json.data?.id ?? json.id;
  if (!id) throw new Error(`Atlas ${path}: sem prediction id em ${JSON.stringify(json).slice(0, 300)}`);

  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    await sleep(opts.intervalMs);
    const poll = await fetch(`${ATLAS.baseUrl}/api/v1/model/prediction/${id}`, {
      headers: atlasHeaders(),
    });
    const state = await safeJson(poll);
    const status = state.data?.status ?? state.status;

    if (status === "completed" || status === "succeeded") {
      const outputs = state.data?.outputs ?? state.outputs;
      const url = Array.isArray(outputs) ? (outputs[0]?.url ?? outputs[0]) : (outputs?.url ?? outputs);
      if (!url || typeof url !== "string")
        throw new Error(`Atlas prediction ${id}: outputs inesperados ${JSON.stringify(outputs).slice(0, 300)}`);
      return url;
    }
    if (status === "failed") {
      throw new Error(`Atlas prediction ${id} falhou: ${JSON.stringify(state.data?.error ?? state).slice(0, 400)}`);
    }
    opts.onPoll?.();
  }
  throw new Error(`Atlas prediction ${id}: timeout após ${opts.timeoutMs / 1000}s`);
  } finally {
    releaseAtlasSlot();
  }
}

/** Gera imagem. Com referenceImages => identity lock (modelo /edit). Retorna URL do provedor. */
export async function atlasImage(
  opts: { prompt: string; referenceImages?: string[] } & AtlasCallbacks
): Promise<string> {
  const refs = opts.referenceImages ?? [];
  const model = refs.length ? ATLAS.models.imageEdit : ATLAS.models.image;
  const payload: Record<string, unknown> = {
    model,
    prompt: opts.prompt,
    aspect_ratio: "9:16",
    resolution: "1k",
  };
  if (refs.length) payload[ATLAS.imageRefField] = refs; // "images" (máx 14)
  return atlasSubmitAndPoll("/api/v1/model/generateImage", payload, {
    intervalMs: 2000,
    timeoutMs: 180000,
    onPoll: opts.onPoll,
  });
}

/** B-roll: anima uma imagem (Veo image-to-video) -> clipe curto sem fala. */
export async function atlasVideoFromImage(
  opts: { imageUrl: string; prompt: string } & AtlasCallbacks
): Promise<string> {
  const payload = {
    model: ATLAS.models.broll,
    image: opts.imageUrl, // schema veo image-to-video: "image"
    prompt: opts.prompt,
    aspect_ratio: "9:16",
  };
  return atlasSubmitAndPoll("/api/v1/model/generateVideo", payload, {
    intervalMs: 5000,
    timeoutMs: 600000,
    onPoll: opts.onPoll,
  });
}

/** Talking head com lip-sync (Kling avatar): keyframe + áudio -> take contínuo com áudio embutido. */
export async function atlasAvatar(
  opts: { audioUrl: string; imageUrl: string; prompt?: string } & AtlasCallbacks
): Promise<string> {
  const payload = {
    model: ATLAS.models.avatar,
    audio: opts.audioUrl, // schema Kling/InfiniteTalk: "audio"/"image" (omni-human usa *_url)
    image: opts.imageUrl,
    resolution: process.env.ATLAS_AVATAR_RESOLUTION ?? "720p", // InfiniteTalk default é 480p
    prompt:
      opts.prompt ??
      // Expressivo estilo creator: expressões faciais vivas, gestos de mão animados,
      // micro-movimentos de cabeça e sobrancelha, energia carismática acompanhando a
      // emoção da fala — mantendo lip-sync natural e olhar para a câmera.
      "Highly expressive social media creator talking to camera. Animated, lively facial expressions and eyebrow movement, energetic natural hand gestures, dynamic head movement, charismatic and engaging delivery that matches the emotion and rhythm of the speech. Natural accurate lip-sync, direct eye contact with the camera. Vibrant, confident, high-energy influencer vibe.",
  };
  return atlasSubmitAndPoll("/api/v1/model/generateVideo", payload, {
    intervalMs: 5000,
    timeoutMs: 900000,
    onPoll: opts.onPoll,
  });
}

/** Baixa uma URL do provedor para Buffer (persistir IMEDIATAMENTE — URLs expiram). */
export async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Sobe um arquivo para o storage do PRÓPRIO Atlas e retorna a download_url.
 * É a forma robusta de dar áudio/imagem para os modelos buscarem — o Atlas
 * busca do storage dele mesmo, sem depender de túnel nem de host de terceiro.
 * POST /api/v1/model/uploadMedia (multipart, campo "file").
 */
export async function atlasUploadMedia(data: Buffer, contentType: string): Promise<string> {
  const ext = contentType.includes("mp3") || contentType.includes("mpeg") ? "mp3"
    : contentType.includes("png") ? "png"
    : contentType.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: contentType }), `upload.${ext}`);

  const res = await fetch(`${ATLAS.baseUrl}/api/v1/model/uploadMedia`, {
    method: "POST",
    // Só Authorization — o fetch define o Content-Type multipart com boundary
    headers: { Authorization: `Bearer ${env("ATLAS_API_KEY")}` },
    body: form,
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(`Atlas uploadMedia ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  const url = json.data?.download_url ?? json.data?.url;
  if (!url) throw new Error(`Atlas uploadMedia: sem download_url em ${JSON.stringify(json).slice(0, 300)}`);
  return url;
}
