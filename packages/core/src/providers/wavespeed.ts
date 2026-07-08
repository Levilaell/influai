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

/** Submete um job no WaveSpeed e faz polling até o resultado (URL do output). */
async function submitPoll(path: string, body: Record<string, unknown>, onPoll?: () => void): Promise<string> {
  const sub = await fetch(`${BASE}/${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const sj: any = await sub.json().catch(() => ({}));
  if (!sub.ok) throw new Error(`WaveSpeed ${path} ${sub.status}: ${JSON.stringify(sj).slice(0, 300)}`);
  const id = sj.data?.id ?? sj.id ?? sj.request_id;
  if (!id) throw new Error(`WaveSpeed ${path}: sem prediction id em ${JSON.stringify(sj).slice(0, 200)}`);

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(3000);
    const r = await fetch(`${BASE}/predictions/${id}/result`, { headers: headers() });
    const p: any = await r.json().catch(() => ({}));
    const st = String(p.data?.status ?? p.status ?? "").toLowerCase();
    if (st === "completed" || st === "succeeded") {
      const out = p.data?.outputs ?? p.outputs;
      const url = Array.isArray(out) ? out[0] : out;
      if (!url || typeof url !== "string")
        throw new Error(`WaveSpeed ${path} ${id}: outputs inesperados ${JSON.stringify(out).slice(0, 200)}`);
      return url;
    }
    if (st === "failed" || st === "error")
      throw new Error(`WaveSpeed ${path} ${id} falhou: ${JSON.stringify(p.data?.error ?? p).slice(0, 300)}`);
    onPoll?.();
  }
  throw new Error(`WaveSpeed ${path} ${id}: timeout`);
}

/** Take de avatar (talking-head com lip-sync). */
export async function wavespeedAvatar(opts: { audioUrl: string; imageUrl: string; onPoll?: () => void }): Promise<string> {
  return submitPoll(
    `wavespeed-ai/${AVATAR_MODEL}`,
    { image: opts.imageUrl, audio: opts.audioUrl, prompt: "person talking directly to camera, natural confident expression", resolution: RESOLUTION, seed: -1 },
    opts.onPoll
  );
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
