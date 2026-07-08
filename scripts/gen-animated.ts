// Gera 3 exemplos ANIMADOS (3D, estilo Pixar) pra vitrine — mesmo pipeline, keyframe animado.
// Saída: apps/web/public/examples/anim-<slug>.mp4 + .jpg
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

const NICHES = [
  { slug: "anim-petshop", niche: "petshop e cuidados com pets" },
  { slug: "anim-doceria", niche: "doceria e confeitaria artesanal" },
  { slug: "anim-curiosidades", niche: "curiosidades e ciência divertida" },
];

function voiceFor(look: string): string {
  const female = /mulher|feminin|garota|moça|ela /i.test(look);
  const pool = CURATED_VOICES.filter((v) => (female ? v.gender === "feminina" : v.gender === "masculina"));
  return (pool.length ? pool : CURATED_VOICES)[0].id;
}

async function genOne(item: (typeof NICHES)[number]) {
  if (fs.existsSync(`${OUT}/${item.slug}.mp4`)) {
    console.log(`[anim] = ${item.slug} já existe, pulando`);
    return null;
  }
  const t0 = Date.now();
  console.log(`[anim] ▶ ${item.slug}`);
  try {
    const preview = await generatePreview(item.niche);
    const persona: any = preview.persona ?? {};
    const lines: string[] = (preview.script?.lines ?? []).slice(0, 5);
    if (!lines.length) throw new Error("prévia sem roteiro");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `an-${item.slug}-`));

    // keyframe 3D ANIMADO (força estilo cartoon, não fotorrealista)
    const kfBuf = await downloadToBuffer(
      await genImage({
        prompt: `A 3D animated character in modern Pixar/Disney render style — a friendly Brazilian content creator, expressive big eyes, warm smile, stylized hair — speaking directly to camera and gesturing, inside a colorful setting relevant to "${item.niche}". Vibrant colors, cinematic 3D lighting, soft shadows, vertical 9:16 portrait, high detail. Stylized cartoon animation, NOT photorealistic. No text, no letters, no watermark.`,
      })
    );
    const imageUrl = await hostPublic(`scripts/${Date.now().toString(36)}-kf.jpg`, kfBuf, "image/jpeg");

    const script: any = {
      title: preview.script?.title ?? item.slug,
      hook: lines[0],
      narration: lines.join(" "),
      hashtags: (preview.script?.hashtags ?? []).slice(0, 6),
      shots: lines.map((d) => ({ visual_prompt: "x", dialogue: d, camera: "medium shot" })),
    };
    const voiceFile = path.join(tmp, "voice.mp3");
    const narr = await generateNarration({ script, voice: voiceFor(persona.look ?? ""), outFile: voiceFile });
    const audioUrl = await hostPublic(`scripts/${Date.now().toString(36)}-voice.mp3`, fs.readFileSync(voiceFile), "audio/mpeg");

    const take = await generateAvatarTake({ audioUrl, imageUrl });
    const takeFile = path.join(tmp, "take.mp4");
    fs.writeFileSync(takeFile, take.buffer);
    const rawFinal = path.join(tmp, "final.mp4");
    await assembleAvatar({
      takeFile, script, audioDurationSeconds: narr.durationSeconds, alignment: narr.alignment ?? null,
      music: "inspirador", broll: null, outFile: rawFinal,
    });

    fs.mkdirSync(OUT, { recursive: true });
    await exec("ffmpeg", ["-y", "-v", "error", "-i", rawFinal, "-vf", "scale=-2:832", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", `${OUT}/${item.slug}.mp4`]);
    await exec("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", rawFinal, "-frames:v", "1", "-vf", "scale=400:-1", `${OUT}/${item.slug}.jpg`]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`[anim] ✔ ${item.slug} (${persona.name}) em ${Math.round((Date.now() - t0) / 1000)}s`);
    return item.slug;
  } catch (e: any) {
    console.error(`[anim] x ${item.slug} FALHOU: ${String(e?.message).slice(0, 160)}`);
    return null;
  }
}

async function withRetry(item: (typeof NICHES)[number]) {
  for (let a = 1; a <= 3; a++) {
    const r = await genOne(item);
    if (r || fs.existsSync(`${OUT}/${item.slug}.mp4`)) return r;
    if (a < 3) await new Promise((res) => setTimeout(res, 30000 * a));
  }
  return null;
}

// serial (concorrência 1) pra não estourar o rate limit do Atlas
for (const n of NICHES) await withRetry(n);
console.log("[anim] pronto");
process.exit(0);
