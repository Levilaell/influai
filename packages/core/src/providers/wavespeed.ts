// Provider WaveSpeedAI — take de avatar (InfiniteTalk) E imagem (nano-banana), tudo elástico.
// InfiniteTalk regular: 704×1280, $0.06/s, cena com movimento. nano-banana-2: mesmo modelo
// do Atlas, mais barato ($0.07 t2i / $0.063 edit), com identity lock. Submit + poll.
import { env } from "../env.ts";

const BASE = "https://api.wavespeed.ai/api/v3";
const AVATAR_MODEL = process.env.WAVESPEED_MODEL ?? "infinitetalk"; // "-fast" = metade do preço, res menor
const RESOLUTION = process.env.WAVESPEED_RESOLUTION ?? "720p";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${env("WAVESPEED_API_KEY")}`, "Content-Type": "application/json" };
}

/** Submete um job no WaveSpeed e devolve o prediction id (SEM esperar o resultado).
 *  Separado do poll pra permitir RETOMAR a mesma task após retry/restart do worker
 *  (o id fica cacheado em job_steps — re-submeter geraria uma task nova e paga). */
export async function wavespeedSubmit(path: string, body: Record<string, unknown>): Promise<string> {
  const sub = await fetch(`${BASE}/${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const sj: any = await sub.json().catch(() => ({}));
  if (!sub.ok) throw new Error(`WaveSpeed ${path} ${sub.status}: ${JSON.stringify(sj).slice(0, 300)}`);
  const id = sj.data?.id ?? sj.id ?? sj.request_id;
  if (!id) throw new Error(`WaveSpeed ${path}: sem prediction id em ${JSON.stringify(sj).slice(0, 200)}`);
  return String(id);
}

/** Faz polling de uma prediction até o output. No tier Bronze (2 concorrentes) a task pode
 *  ficar MUITO tempo na fila deles antes de rodar — o timeout precisa acomodar isso.
 *  Task que falhou DO LADO deles lança "WAVESPEED_TASK_FAILED" (chamador decide re-submeter). */
export async function wavespeedResultUrl(
  id: string,
  opts: { timeoutMs?: number; onPoll?: () => void } = {}
): Promise<string> {
  const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60 * 1000);
  while (Date.now() < deadline) {
    await sleep(3000);
    const r = await fetch(`${BASE}/predictions/${id}/result`, { headers: headers() });
    const p: any = await r.json().catch(() => ({}));
    const st = String(p.data?.status ?? p.status ?? "").toLowerCase();
    if (st === "completed" || st === "succeeded") {
      const out = p.data?.outputs ?? p.outputs;
      const url = Array.isArray(out) ? out[0] : out;
      if (!url || typeof url !== "string")
        throw new Error(`WaveSpeed ${id}: outputs inesperados ${JSON.stringify(out).slice(0, 200)}`);
      return url;
    }
    if (st === "failed" || st === "error")
      throw new Error(`WAVESPEED_TASK_FAILED ${id}: ${JSON.stringify(p.data?.error ?? p).slice(0, 300)}`);
    opts.onPoll?.();
  }
  throw new Error(`WaveSpeed ${id}: timeout`);
}

async function submitPoll(path: string, body: Record<string, unknown>, onPoll?: () => void): Promise<string> {
  const id = await wavespeedSubmit(path, body);
  return wavespeedResultUrl(id, { onPoll });
}

/** Payload/submit do take de avatar (id da task; poll separado via wavespeedResultUrl). */
export async function wavespeedAvatarSubmit(opts: { audioUrl: string; imageUrl: string }): Promise<string> {
  return wavespeedSubmit(`wavespeed-ai/${AVATAR_MODEL}`, {
    image: opts.imageUrl,
    audio: opts.audioUrl,
    prompt: "person talking directly to camera, natural confident expression",
    resolution: RESOLUTION,
    seed: -1,
  });
}

/** Take de avatar (talking-head com lip-sync) — submit + poll numa chamada só
 *  (fluxos simples; o pipeline de vídeo usa submit/poll separados pra retomar). */
export async function wavespeedAvatar(opts: { audioUrl: string; imageUrl: string; onPoll?: () => void }): Promise<string> {
  const id = await wavespeedAvatarSubmit(opts);
  return wavespeedResultUrl(id, { timeoutMs: 30 * 60 * 1000, onPoll: opts.onPoll });
}

/** Imagem (nano-banana-2). Com referências → edit (identity lock); sem → text-to-image. */
export async function wavespeedImage(opts: { prompt: string; referenceImages?: string[]; onPoll?: () => void }): Promise<string> {
  const refs = opts.referenceImages ?? [];
  const path = refs.length ? "google/nano-banana-2/edit" : "google/nano-banana-2/text-to-image";
  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    aspect_ratio: "9:16",
    resolution: "1k",
    output_format: "jpeg",
  };
  if (refs.length) body.images = refs.slice(0, 14);
  return submitPoll(path, body, opts.onPoll);
}
