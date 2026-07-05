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
import { genImage, atlasUploadMedia, downloadToBuffer } from "@influa/core/providers/index";
import { generateNarration, generateAvatarTake } from "@influa/core/pipeline/avatar";
import { assembleAvatar } from "@influa/core/pipeline/assemble";
import { CURATED_VOICES } from "@influa/core/config";

const exec = promisify(execFile);
const OUT = "apps/web/public/examples";

const NICHES = [
  { slug: "cafeteria", niche: "cafeteria de bairro especializada em café especial", useCase: "Promoção de marca" },
  { slug: "moda", niche: "loja de roupa feminina / moda", useCase: "Apresentação de produto" },
  { slug: "fitness", niche: "personal trainer e estúdio de treino funcional", useCase: "Influencer pessoal" },
  { slug: "estetica", niche: "clínica de estética facial e skincare", useCase: "Serviço + produto" },
  { slug: "hamburgueria", niche: "hamburgueria artesanal com delivery", useCase: "Promoção de marca" },
  { slug: "imobiliaria", niche: "corretor de imóveis / imobiliária", useCase: "Autoridade e serviço" },
];

function voiceFor(look: string): string {
  const female = /mulher|feminin|garota|moça|jovem de|ela /i.test(look);
  const pool = CURATED_VOICES.filter((v) => (female ? v.gender === "feminina" : v.gender === "masculina"));
  return (pool.length ? pool : CURATED_VOICES)[0].id;
}

async function genOne(item: (typeof NICHES)[number]): Promise<{ slug: string; persona: string; seconds: number } | null> {
  if (fs.existsSync(`${OUT}/${item.slug}.mp4`)) {
    console.log(`[gen] = ${item.slug} já existe, pulando`);
    return null;
  }
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
        prompt: `${persona.look ?? "friendly Brazilian content creator"}, as a social media creator speaking directly to camera, in a setting relevant to "${item.niche}". Face clearly visible with open eyes, natural confident expression, gesturing. Photorealistic, vertical 9:16, cinematic lighting, high detail. No text, no letters, no watermark, no signage.`,
      })
    );
    const imageUrl = await atlasUploadMedia(kfBuf, "image/jpeg");

    // 2) narração (voz casada com o gênero da persona)
    const script: any = {
      title: preview.script?.title ?? item.slug,
      hook: lines[0],
      narration: lines.join(" "),
      hashtags: (preview.script?.hashtags ?? []).slice(0, 6),
      shots: lines.map((d) => ({ visual_prompt: "x", dialogue: d, camera: "medium shot" })),
    };
    const voiceFile = path.join(tmp, "voice.mp3");
    const narr = await generateNarration({ script, voice: voiceFor(persona.look ?? ""), outFile: voiceFile });
    const audioUrl = await atlasUploadMedia(fs.readFileSync(voiceFile), "audio/mpeg");

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
      music: "inspirador",
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
const results = (await mapLimit(NICHES, 1, withRetry)).filter(Boolean) as { slug: string; persona: string; seconds: number }[];
const avg = results.length ? Math.round(results.reduce((a, b) => a + b.seconds, 0) / results.length) : 0;
console.log("\n════════ RESUMO ════════");
for (const r of results) console.log(`  ${r.slug.padEnd(14)} ${r.persona.padEnd(22)} ${r.seconds}s`);
console.log(`  ───────────────────────`);
console.log(`  gerados: ${results.length}/${NICHES.length}`);
console.log(`  tempo MÉDIO por vídeo: ${avg}s (~${(avg / 60).toFixed(1)} min)`);
console.log(`  wall-clock total (concorrência 2): ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(0);
