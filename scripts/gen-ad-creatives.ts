// Produz 4 CRIATIVOS de anúncio em vídeo (influenciador sintético falando o anúncio).
// 4 ângulos distintos p/ A/B. Pipeline: keyframe -> narração (voz casada) -> take
// InfiniteTalk -> legendas + música. Saída: marketing/creatives/<slug>.mp4 (+ poster).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { genImage, atlasUploadMedia, downloadToBuffer } from "@influa/core/providers/index";
import { generateNarration, generateAvatarTake } from "@influa/core/pipeline/avatar";
import { assembleAvatar } from "@influa/core/pipeline/assemble";

const exec = promisify(execFile);
const OUT = "marketing/creatives";

type Creative = { slug: string; angle: string; look: string; voice: string; music: any; lines: string[] };

const CREATIVES: Creative[] = [
  {
    slug: "1-meta-prova",
    angle: "Meta-prova (o anúncio é feito pela própria IA)",
    look: "confident young Brazilian woman, mid 20s, natural wavy brown hair, minimal modern makeup, casual stylish top, bright modern room with a soft ring-light glow, content-creator vibe, speaking directly to camera, gesturing naturally",
    voice: "cgSgspJ2msm6clMCkdW9", // Jessica — animada, calorosa
    music: "hiphop2",
    lines: [
      "Presta atenção nesse detalhe: eu não sou uma pessoa real.",
      "Sou uma influenciadora de inteligência artificial. Esse vídeo foi feito em minutos, sem câmera, sem ninguém gravar.",
      "É isso que a Influai faz pelo seu negócio: cria um rosto que vira a cara da sua marca e posta todo dia, sozinho.",
      "Cria o seu de graça. O link está aqui embaixo.",
    ],
  },
  {
    slug: "2-nao-aparecer",
    angle: "Não precisa aparecer (dono de negócio que odeia gravar)",
    look: "warm approachable Brazilian woman, around 30, friendly genuine smile, casual sweater, cozy well-lit home with plants softly blurred behind, relatable everyday vibe, speaking directly to camera",
    voice: "EXAVITQu4vr4xnSDxMaL", // Sarah — confiante, madura
    music: "inspirador",
    lines: [
      "Você sabe que precisa postar vídeo pro seu negócio. Mas gravar, aparecer na câmera? Nem a pau.",
      "Eu entendo. Por isso eu existo: sou uma influenciadora de IA, e eu apareço por você.",
      "Você me diz o que a sua marca vende, e eu gravo os vídeos. Todo dia. Sem você aparecer, sem editar nada.",
      "Some da câmera. Crie o seu influenciador na Influai, de graça.",
    ],
  },
  {
    slug: "3-funcionario",
    angle: "O funcionário que nunca para (ROI / negócio)",
    look: "professional Brazilian man, around 35, short well-groomed hair, light beard, smart casual button shirt, modern office background softly blurred, confident trustworthy vibe, speaking directly to camera",
    voice: "nPczCjzI2devNBz1zQrb", // Brian — grave, confortante
    music: "hiphop",
    lines: [
      "Quanto você pagaria por um funcionário que grava vídeo pro seu negócio todo santo dia?",
      "Que nunca falta, nunca atrasa, nunca pede aumento. Esse funcionário sou eu. E eu sou feito de inteligência artificial.",
      "Custo uma fração de uma agência, e o rosto é sempre o mesmo: vira a identidade da sua marca.",
      "Contrata o seu na Influai. Começa de graça.",
    ],
  },
  {
    slug: "4-nao-existe",
    angle: "Esse rosto não existe (uau / curiosidade)",
    look: "striking stylish young Brazilian woman, early 20s, bold confident expression, trendy modern outfit, dramatic soft studio lighting with subtle color accents, high-fashion creator aesthetic, speaking directly to camera",
    voice: "FGY2WhTYpPnrIDTdsKH5", // Laura — jovem, social
    music: "funk",
    lines: [
      "Esse rosto não existe. Essa voz não existe.",
      "Mas esse vídeo pode vender o seu negócio agora mesmo.",
      "Eu fui criada por inteligência artificial. A Influai monta um influenciador com a cara da sua marca e cria os vídeos por você: rosto, voz, roteiro e legenda.",
      "Pronto pra postar, em minutos. Faça o teu, é de graça pra começar.",
    ],
  },
];

async function genOne(c: Creative) {
  if (fs.existsSync(`${OUT}/${c.slug}.mp4`)) {
    console.log(`[ad] = ${c.slug} já existe, pulando`);
    return { slug: c.slug, ok: true, skipped: true };
  }
  const t0 = Date.now();
  console.log(`[ad] ▶ ${c.slug} — ${c.angle}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `ad-${c.slug}-`));
  // 1) keyframe
  const kfBuf = await downloadToBuffer(
    await genImage({
      prompt: `${c.look}. Face clearly visible with open eyes, natural confident expression. Photorealistic, vertical 9:16 portrait, cinematic lighting, high detail, shallow depth of field. No text, no letters, no captions, no watermark, no signage.`,
    })
  );
  const imageUrl = await atlasUploadMedia(kfBuf, "image/jpeg");
  // 2) narração (voz casada com o ângulo)
  const script: any = {
    title: c.slug,
    hook: c.lines[0],
    narration: c.lines.join(" "),
    hashtags: [],
    shots: c.lines.map((d) => ({ visual_prompt: "x", dialogue: d, camera: "medium shot" })),
  };
  const voiceFile = path.join(tmp, "voice.mp3");
  const narr = await generateNarration({ script, voice: c.voice, outFile: voiceFile });
  const audioUrl = await atlasUploadMedia(fs.readFileSync(voiceFile), "audio/mpeg");
  // 3) take InfiniteTalk + 4) legendas + música
  const take = await generateAvatarTake({ audioUrl, imageUrl });
  const takeFile = path.join(tmp, "take.mp4");
  fs.writeFileSync(takeFile, take.buffer);
  const rawFinal = path.join(tmp, "final.mp4");
  await assembleAvatar({
    takeFile,
    script,
    audioDurationSeconds: narr.durationSeconds,
    alignment: narr.alignment ?? null,
    music: c.music,
    broll: null,
    outFile: rawFinal,
  });
  fs.mkdirSync(OUT, { recursive: true });
  await exec("ffmpeg", ["-y", "-v", "error", "-i", rawFinal, "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", `${OUT}/${c.slug}.mp4`]);
  await exec("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", rawFinal, "-frames:v", "1", `${OUT}/${c.slug}.jpg`]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const seconds = Math.round((Date.now() - t0) / 1000);
  console.log(`[ad] ✔ ${c.slug} em ${seconds}s (~${Math.round(narr.durationSeconds)}s de vídeo)`);
  return { slug: c.slug, ok: true, seconds };
}

async function withRetry(c: Creative) {
  for (let a = 1; a <= 3; a++) {
    try {
      return await genOne(c);
    } catch (e: any) {
      console.error(`[ad] x ${c.slug} tentativa ${a}: ${String(e?.message).slice(0, 160)}`);
      if (a < 3) await new Promise((r) => setTimeout(r, 30000 * a));
    }
  }
  return { slug: c.slug, ok: false };
}

// concorrência 1 (serial) — o take de avatar do Atlas estoura o limite (~2) se rodar 2 juntos
const out: any[] = [];
for (const c of CREATIVES) {
  out.push(await withRetry(c));
}
console.log("\n=== RESUMO ===");
for (const r of out) console.log(`${r?.ok ? "✔" : "✗"} ${r?.slug}${r?.seconds ? ` (${r.seconds}s)` : ""}`);
process.exit(0);
