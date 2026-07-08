// Gera um set CURADO de vídeos de exemplo pra vitrine da landing, medindo o tempo.
// Nichos de alta conversão + casos de uso diferentes (marca, produto, influencer, serviço).
// Reaproveita o mesmo pipeline do lead-video (nicho -> persona -> roteiro -> keyframe ->
// narração -> take InfiniteTalk -> legendas). Saída: apps/web/public/examples/<slug>.mp4 + .jpg
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generatePreview } from "@influa/core/growth/preview";
import { genImage, downloadToBuffer } from "@influa/core/providers/index";
import { getStorage } from "@influa/core/storage/index";

// Hospeda mídia no storage (R2/local) e devolve URL pública — Atlas aposentado.
async function hostPublic(key: string, buf: Buffer, ct: string): Promise<string> {
  const st = getStorage();
  await st.put(key, buf, ct);
  return st.publicUrl(key, 2 * 60 * 60);
}
import { generateNarration, generateAvatarTake } from "@influa/core/pipeline/avatar";
import { assembleAvatar } from "@influa/core/pipeline/assemble";
import { CURATED_VOICES } from "@influa/core/config";

const exec = promisify(execFile);
const OUT = "apps/web/public/examples";

// Refresh 2026-07-08 (pipeline atual: fala 1.1x, gestos, voz fixa v2, WaveSpeed):
const NICHES = [
  { slug: "moda", niche: "loja de roupa feminina / moda", useCase: "Apresentação de produto", music: "hiphop2" },
  { slug: "estetica", niche: "clínica de estética facial e skincare", useCase: "Serviço + produto", music: "ambiente" },
  { slug: "cafeteria", niche: "cafeteria de bairro especializada em café especial", useCase: "Negócio local", music: "inspirador" },
];

function voiceFor(look: string, seed = 0): string {
  const female = /mulher|feminin|garota|moça|jovem de|ela /i.test(look);
  const pool = CURATED_VOICES.filter((v) => (female ? v.gender === "feminina" : v.gender === "masculina"));
  const list = pool.length ? pool : CURATED_VOICES;
  return list[Math.abs(seed) % list.length].id;
}

async function genOne(item: (typeof NICHES)[number]): Promise<{ slug: string; persona: string; seconds: number } | null> {
  const t0 = Date.now();
  console.log(`[gen] ▶ ${item.slug} — ${item.niche}`);
  try {
    const preview = await generatePreview(item.niche);
    const persona: any = preview.persona ?? {};
    const lines: string[] = (preview.script?.lines ?? []).slice(0, 5);
    if (!lines.length) throw new Error("prévia sem roteiro");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `ex-${item.slug}-`));

    // 1) keyframe (text-to-image)
    const kfBuf = await downloadToBuffer(
      await genImage({
        prompt: `${persona.look ?? "friendly Brazilian content creator"}, as a social media creator speaking directly to camera, in a setting relevant to "${item.niche}". SOLO subject — only this one person, absolutely NO other people anywhere in the frame or background (they would look frozen). Face clearly visible with open eyes, natural confident expression, mid-gesture with hands visible. Photorealistic, vertical 9:16, cinematic lighting, high detail. No text, no letters, no watermark, no signage.`,
      })
    );
    const imageUrl = await hostPublic(`scripts/${Date.now().toString(36)}-kf.jpg`, kfBuf, "image/jpeg");

    // 2) narração (voz casada com o gênero da persona)
    const script: any = {
      title: preview.script?.title ?? item.slug,
      hook: lines[0],
      narration: lines.join(" "),
      hashtags: (preview.script?.hashtags ?? []).slice(0, 6),
      shots: lines.map((d) => ({ visual_prompt: "x", dialogue: d, camera: "medium shot" })),
    };
    const voiceFile = path.join(tmp, "voice.mp3");
    const narr = await generateNarration({ script, voice: voiceFor(persona.look ?? "", item.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0)), outFile: voiceFile });
    const audioUrl = await hostPublic(`scripts/${Date.now().toString(36)}-voice.mp3`, fs.readFileSync(voiceFile), "audio/mpeg");

    // 3) take (InfiniteTalk) + 4) legendas
    const take = await generateAvatarTake({ audioUrl, imageUrl });
    const takeFile = path.join(tmp, "take.mp4");
    fs.writeFileSync(takeFile, take.buffer);
    const rawFinal = path.join(tmp, "final.mp4");
    await assembleAvatar({
      takeFile,
      script,
      audioDurationSeconds: narr.durationSeconds,
      alignment: narr.alignment ?? null,
      music: (item as any).music ?? "inspirador",
      broll: null,
      outFile: rawFinal,
    });

    // 5) compacta p/ web + poster
    fs.mkdirSync(OUT, { recursive: true });
    await exec("ffmpeg", ["-y", "-v", "error", "-i", rawFinal, "-vf", "scale=-2:832", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", `${OUT}/${item.slug}.mp4`]);
    await exec("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", rawFinal, "-frames:v", "1", "-vf", "scale=400:-1", `${OUT}/${item.slug}.jpg`]);
    fs.rmSync(tmp, { recursive: true, force: true });

    const seconds = Math.round((Date.now() - t0) / 1000);
    console.log(`[gen] ✔ ${item.slug} (${persona.name}) em ${seconds}s`);
    return { slug: item.slug, persona: persona.name ?? "?", seconds };
  } catch (e: any) {
    console.error(`[gen] x ${item.slug} FALHOU: ${String(e?.message).slice(0, 200)}`);
    return null;
  }
}

// concorrência 2 (não estourar o Atlas; o worker de prod também pode estar rodando)
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

// retry (Atlas às vezes devolve 429 transitório quando o worker de prod também está gerando)
async function withRetry(item: (typeof NICHES)[number]) {
  for (let a = 1; a <= 3; a++) {
    const r = await genOne(item);
    if (r) return r;
    if (a < 3) {
      const wait = 30000 * a;
      console.log(`[gen] retry ${item.slug}: tentativa ${a + 1}/3 em ${wait / 1000}s`);
      await new Promise((res) => setTimeout(res, wait));
    }
  }
  return null;
}

const started = Date.now();
// concorrência 1: não compete com o worker de produção (E2E) pelo Atlas
const results = (await mapLimit(NICHES, 3, withRetry)).filter(Boolean) as { slug: string; persona: string; seconds: number }[];
const avg = results.length ? Math.round(results.reduce((a, b) => a + b.seconds, 0) / results.length) : 0;
console.log("\n════════ RESUMO ════════");
for (const r of results) console.log(`  ${r.slug.padEnd(14)} ${r.persona.padEnd(22)} ${r.seconds}s`);
console.log(`  ───────────────────────`);
console.log(`  gerados: ${results.length}/${NICHES.length}`);
console.log(`  tempo MÉDIO por vídeo: ${avg}s (~${(avg / 60).toFixed(1)} min)`);
console.log(`  wall-clock total (concorrência 2): ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(0);
