// PRIMEIRO VÍDEO AUTOMÁTICO — a maior alavanca de retenção.
// No cadastro (vindo da LP com nicho + prévia), gera o 1º vídeo do usuário SOZINHO:
// cria marca + persona (1 rosto rápido, sem wizard) + vídeo, gera de GRAÇA (sem hold),
// e avisa por email. Zero setup. Self-contained (mesmo motor do lead-video).
import type PgBoss from "pg-boss";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { genImage, downloadToBuffer } from "@influa/core/providers/index";
import { hostBuffer } from "../assets.ts";
import { generateNarration, generateAvatarTake } from "@influa/core/pipeline/avatar";
import { assembleAvatar } from "@influa/core/pipeline/assemble";
import { sendEmail, emailTemplate } from "@influa/core/email/index";
import { generatePreview } from "@influa/core/growth/preview";
import { pickVoiceForGender } from "@influa/core/config";

function slug(s: string): string {
  return (s || "persona").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

async function handleFirstVideo(data: { userId: string; niche?: string; preview?: any }) {
  const userId = data?.userId;
  if (!userId) return;
  const niche = String(data?.niche ?? "").trim().slice(0, 80);
  let preview = typeof data?.preview === "string" ? JSON.parse(data.preview) : data?.preview;
  let lines: string[] = (preview?.script?.lines ?? []).slice(0, 5);
  // Prévia não veio (sessionStorage perdido, Google, etc.)? Gera do nicho aqui.
  if (!lines.length && niche) {
    try {
      preview = await generatePreview(niche);
      lines = (preview?.script?.lines ?? []).slice(0, 5);
    } catch (e) {
      console.warn(`[first-video] falha ao gerar prévia do nicho "${niche}": ${(e as Error).message}`);
    }
  }
  const persona = preview?.persona ?? {};
  if (!lines.length) return; // sem nicho/prévia => usuário faz o fluxo manual

  const pool = getPool();
  const storage = getStorage();

  // Idempotência: só 1 primeiro-vídeo por usuário (retry/reenvio não duplica).
  const { rows: has } = await pool.query("select 1 from videos where user_id = $1 limit 1", [userId]);
  if (has[0]) return;

  // 1. Marca
  const brandName = niche ? niche.charAt(0).toUpperCase() + niche.slice(1) : "Minha marca";
  const { rows: b } = await pool.query("insert into brands (user_id, name) values ($1,$2) returning id", [userId, brandName]);
  const brandId = b[0].id;
  await pool.query("insert into brand_memory (brand_id) values ($1) on conflict do nothing", [brandId]);

  // 2. Persona (rosto único, já 'ready' — sem os 4 candidatos + sheet)
  const personaName = persona.name || "Seu influenciador";
  // Voz coerente com o gênero da persona (evita rosto masculino + voz feminina).
  const gender: "masculina" | "feminina" = persona.gender === "masculina" ? "masculina" : "feminina";
  const seed = personaName.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const voice = pickVoiceForGender(gender, seed);
  const { rows: p } = await pool.query(
    `insert into personas (user_id, brand_id, name, slug, description, niche, voice_id, moderation, face_style, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'realista','ready') returning id`,
    [userId, brandId, personaName, `${slug(personaName)}-${Date.now().toString(36)}`, persona.look || personaName, niche || "geral", voice, JSON.stringify({ allowed: true, auto: true })]
  );
  const personaId = p[0].id;

  // rosto (keyframe text-to-image) -> guarda como 'front' (aparece no painel)
  const kfBuf = await downloadToBuffer(
    await genImage({
      prompt: `${persona.look ?? "friendly Brazilian content creator"}, as a social media creator, face clearly visible with open eyes, natural confident expression, in a setting relevant to "${niche}". Photorealistic, vertical 9:16, cinematic lighting, high detail. No text, no letters, no watermark.`,
    })
  );
  const faceKey = `personas/${personaId}/front.jpg`;
  await storage.put(faceKey, kfBuf);
  await pool.query("insert into persona_assets (persona_id, kind, idx, storage_key, provider_url) values ($1,'front',0,$2,null)", [personaId, faceKey]);

  // 3. Vídeo (registro) — status 'rendering', grátis (sem hold de créditos)
  const script: any = {
    title: preview.script?.title ?? "Seu primeiro vídeo",
    hook: lines[0],
    narration: lines.join(" "),
    hashtags: (preview.script?.hashtags ?? []).slice(0, 6),
    shots: lines.map((d) => ({ visual_prompt: "x", dialogue: d, camera: "medium shot" })),
  };
  const { rows: v } = await pool.query(
    `insert into videos (user_id, brand_id, persona_id, topic, script, status, reference_keys, style, segments)
     values ($1,$2,$3,$4,$5,'rendering',$6,$7,1) returning id`,
    [userId, brandId, personaId, script.title, JSON.stringify(script), JSON.stringify([faceKey]), JSON.stringify({})]
  );
  const videoId = v[0].id;

  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `fv-${videoId.slice(0, 8)}-`));
    const imageUrl = await hostBuffer(`videos/${videoId}/kf-host.jpg`, kfBuf, "image/jpeg");
    const voiceFile = path.join(tmp, "voice.mp3");
    const narr = await generateNarration({ script, voice, outFile: voiceFile });
    const audioUrl = await hostBuffer(`videos/${videoId}/voice-host.mp3`, fs.readFileSync(voiceFile), "audio/mpeg");
    const take = await generateAvatarTake({ audioUrl, imageUrl });
    const takeFile = path.join(tmp, "take.mp4");
    fs.writeFileSync(takeFile, take.buffer);
    const finalFile = path.join(tmp, "final.mp4");
    await assembleAvatar({
      takeFile, script, audioDurationSeconds: narr.durationSeconds, alignment: narr.alignment ?? null,
      music: "inspirador", broll: null, outFile: finalFile,
    });
    const key = `videos/${videoId}/final.mp4`;
    await storage.put(key, fs.readFileSync(finalFile));
    fs.rmSync(tmp, { recursive: true, force: true });

    await pool.query(
      "update videos set status='ready', final_storage_key=$2, progress=$3 where id=$1",
      [videoId, key, JSON.stringify({ step: "done", pct: 100, message: "Pronto!", at: new Date().toISOString() })]
    );

    // avisa por email (traz o usuário de volta pra ver + o empurrão de assinatura)
    const { rows: ur } = await pool.query("select email from users where id = $1", [userId]);
    if (ur[0]?.email) {
      const base = (process.env.PUBLIC_BASE_URL ?? "https://influai.com.br").replace(/\/$/, "");
      await sendEmail({
        to: ur[0].email,
        subject: "Seu primeiro vídeo está pronto 🎉",
        html: emailTemplate({
          title: "Seu primeiro vídeo está pronto!",
          body: `O <b>${personaName}</b> gravou o primeiro vídeo pra sua ${niche || "marca"} — sozinho. É assim todo dia, no piloto automático.`,
          ctaLabel: "Assistir agora",
          ctaUrl: `${base}/videos/${videoId}`,
        }),
        text: `Seu primeiro vídeo está pronto: ${base}/videos/${videoId}`,
      });
    }
    console.log(`[first-video] entregue para user ${userId} (video ${videoId})`);
  } catch (err: any) {
    await pool.query("update videos set status='failed', error=$2 where id=$1", [videoId, String(err?.message).slice(0, 200)]);
    console.error(`[first-video] erro user ${userId}: ${String(err?.message).slice(0, 200)}`);
    throw err; // retry pelo pg-boss
  }
}

export async function registerFirstVideoJobs(boss: PgBoss) {
  await boss.createQueue("first-video-dlq");
  await boss.createQueue("first-video", {
    retryLimit: 2, retryDelay: 90, retryBackoff: true, expireInSeconds: 1200, deadLetter: "first-video-dlq",
  } as any);
  await boss.work("first-video", async (jobs: any[]) => {
    for (const job of jobs) await handleFirstVideo(job.data);
  });
  await boss.work("first-video-dlq", async (jobs: any[]) => {
    for (const job of jobs) console.error(`[first-video] DLQ: desisti do user ${job.data?.userId}`);
  });
  console.log("[worker] fila first-video pronta");
}
