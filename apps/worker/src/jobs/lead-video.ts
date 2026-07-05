// Fase 2 da waitlist: gera 1 vídeo GRÁTIS de verdade para o lead (a partir do nicho +
// prévia) e manda por email. Assíncrono — a espera acontece na caixa de entrada, não na página.
// Pipeline enxuto (sem conta/persona/créditos): keyframe text-to-image (sem identity lock,
// é vídeo único de demonstração) -> narração -> take InfiniteTalk -> legendas.
import type PgBoss from "pg-boss";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { genImage, atlasUploadMedia, downloadToBuffer } from "@influa/core/providers/index";
import { generateNarration, generateAvatarTake } from "@influa/core/pipeline/avatar";
import { assembleAvatar } from "@influa/core/pipeline/assemble";
import { sendEmail, emailTemplate } from "@influa/core/email/index";
import { CURATED_VOICES } from "@influa/core/config";
import { env } from "@influa/core/env";

async function handleLead(email: string) {
  const pool = getPool();
  const storage = getStorage();
  const { rows } = await pool.query("select niche, preview, lead_status from waitlist where email = $1", [email]);
  const row = rows[0];
  if (!row || !row.niche || !row.preview) return;
  if (row.lead_status === "ready") return; // já entregue

  await pool.query("update waitlist set lead_status = 'rendering' where email = $1", [email]);
  try {
    const preview = typeof row.preview === "string" ? JSON.parse(row.preview) : row.preview;
    const persona = preview.persona ?? {};
    const lines: string[] = (preview.script?.lines ?? []).slice(0, 5);
    if (!lines.length) throw new Error("prévia sem roteiro");

    const hash = createHash("sha1").update(email).digest("hex").slice(0, 12);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lead-"));

    // 1) keyframe (text-to-image, sem refs — vídeo único de demo)
    const kfBuf = await downloadToBuffer(
      await genImage({
        prompt: `${persona.look ?? "friendly Brazilian content creator"}, as a social media creator speaking directly to camera, in a setting relevant to "${row.niche}". Face clearly visible with open eyes, natural confident expression, gesturing. Photorealistic, vertical 9:16, cinematic lighting, high detail. No text, no letters, no watermark, no signage.`,
      })
    );
    const imageUrl = await atlasUploadMedia(kfBuf, "image/jpeg");

    // 2) narração (voz curada padrão)
    const script: any = {
      title: preview.script?.title ?? "video", hook: lines[0], narration: lines.join(" "),
      hashtags: (preview.script?.hashtags ?? []).slice(0, 6),
      shots: lines.map((d) => ({ visual_prompt: "x", dialogue: d, camera: "medium shot" })),
    };
    const voice = CURATED_VOICES[0].id;
    const voiceFile = path.join(tmp, "voice.mp3");
    const narr = await generateNarration({ script, voice, outFile: voiceFile });
    const audioUrl = await atlasUploadMedia(fs.readFileSync(voiceFile), "audio/mpeg");

    // 3) take (InfiniteTalk) + 4) legendas
    const take = await generateAvatarTake({ audioUrl, imageUrl });
    const takeFile = path.join(tmp, "take.mp4");
    fs.writeFileSync(takeFile, take.buffer);
    const finalFile = path.join(tmp, "final.mp4");
    await assembleAvatar({
      takeFile, script, audioDurationSeconds: narr.durationSeconds, alignment: narr.alignment ?? null,
      music: "inspirador", broll: null, outFile: finalFile,
    });

    // 5) storage + link assinado (30 dias) + email
    const key = `leads/${hash}/final.mp4`;
    await storage.put(key, fs.readFileSync(finalFile));
    const url = storage.publicUrl(key, 60 * 60 * 24 * 30);
    fs.rmSync(tmp, { recursive: true, force: true });

    await pool.query("update waitlist set lead_status = 'ready' where email = $1", [email]);
    await sendEmail({
      to: email,
      subject: `${persona.name ?? "Seu influenciador de IA"} gravou o primeiro vídeo pra você`,
      html: emailTemplate({
        title: "Seu primeiro vídeo está pronto",
        body: `Olha só o que <b>${persona.name ?? "seu influenciador de IA"}</b> já postou pela sua ${row.niche}. Isso é 100% automático — imagine um desses todo dia, sem você gravar nada. Quando o beta abrir, você é dos primeiros.`,
        ctaLabel: "Assistir meu vídeo", ctaUrl: url,
      }),
      text: `Seu primeiro vídeo está pronto: ${url}`,
    });
    console.log(`[lead-video] entregue para ${email}`);
  } catch (err: any) {
    // re-lança pra o pg-boss tentar de novo (429 do Atlas é transitório);
    // se esgotar as tentativas, a DLQ marca 'failed' definitivamente.
    console.error(`[lead-video] erro para ${email} (vai retry):`, String(err?.message).slice(0, 200));
    throw err;
  }
}

export async function registerLeadVideoJobs(boss: PgBoss) {
  await boss.createQueue("lead-video-dlq");
  await boss.createQueue("lead-video", {
    retryLimit: 2,
    retryDelay: 90, // backoff generoso p/ 429 transitório do Atlas
    retryBackoff: true,
    expireInSeconds: 1200,
    deadLetter: "lead-video-dlq",
  } as any);
  await boss.work("lead-video", async (jobs: any[]) => {
    for (const job of jobs) await handleLead(job.data?.email);
  });
  // esgotou as tentativas: marca 'failed' (não trava a lista)
  await boss.work("lead-video-dlq", async (jobs: any[]) => {
    for (const job of jobs) {
      const email = job.data?.email;
      if (email) await getPool().query("update waitlist set lead_status = 'failed' where email = $1", [email]);
      console.error(`[lead-video] DLQ: desisti de ${email}`);
    }
  });
  console.log("[worker] fila lead-video pronta");
}
