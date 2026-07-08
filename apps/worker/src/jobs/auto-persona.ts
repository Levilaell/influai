// FUNIL NOVO (2026-07-08): persona automática do cadastro SEM portão de escolha.
//   1 rosto direto -> ângulos (identity lock) -> persona READY -> TEASER de ~8s
//   com marca d'água (a persona se APRESENTA ao dono — não é conteúdo postável).
// O teaser é grátis (plataforma absorve ~R$3): é o "aha" antes do paywall.
// Quem quiser outro rosto usa "gerar outras opções" (fluxo antigo de candidatos).
import type PgBoss from "pg-boss";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { step, jobCostUsd } from "../steps.ts";
import { setPersonaStatus } from "../progress.ts";
import { publicAssetUrl, getPersonaAssets, hostBuffer } from "../assets.ts";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { sendEmail, emailTemplate } from "@influa/core/email/index";
import { genImage, downloadToBuffer } from "@influa/core/providers/index";
import { generateNarration, generateAvatarTake } from "@influa/core/pipeline/avatar";
import { assembleAvatar } from "@influa/core/pipeline/assemble";
import { generateTeaserLine } from "@influa/core/growth/teaser";
import { releaseRefHold } from "@influa/core/credits/ledger";
import { faceStyle } from "@influa/core/pipeline/face";
import { mapLimit } from "@influa/core/util/concurrency";
import { PRICING, usdToCredits, CURATED_VOICES } from "@influa/core/config";

const exec = promisify(execFile);

const SHEET_POSES: Record<string, string> = {
  three_quarter: "three-quarter view portrait, slight smile",
  speaking: "mid-speech expression, talking to camera, hands slightly visible, upper body",
};

async function insertAsset(personaId: string, kind: string, idx: number, storageKey: string, providerUrl: string | null) {
  await getPool().query(
    `insert into persona_assets (persona_id, kind, idx, storage_key, provider_url) values ($1,$2,$3,$4,$5)`,
    [personaId, kind, idx, storageKey, providerUrl]
  );
}

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? "https://influai.com.br").replace(/\/$/, "");
}

export async function registerAutoPersonaJobs(boss: PgBoss) {
  await boss.createQueue("persona-auto-dlq");
  await boss.createQueue("persona-auto", {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 1200,
    deadLetter: "persona-auto-dlq",
  } as any);

  const AUTO_CONCURRENCY = Math.max(1, Number(process.env.PERSONA_CONCURRENCY ?? "3"));

  const run = async ([job]: any[]) => {
    const { personaId, niche, tagline, gender } = job.data as {
      personaId: string; niche: string; tagline?: string; gender: "masculina" | "feminina";
    };
    const jobKey = `persona:${personaId}:auto`;
    const pool = getPool();
    const storage = getStorage();
    const { rows } = await pool.query("select * from personas where id = $1", [personaId]);
    const persona = rows[0];
    if (!persona || persona.status === "ready") return;

    await setPersonaStatus(personaId, "sheet_generating");
    const fstyle = faceStyle(persona.face_style);

    // ── 1. Rosto oficial (1 imagem, direto — sem portão de escolha) ─────
    const front: any = await step(jobKey, "front", async () => {
      // FOCO NO INFLUENCIADOR (feedback 2026-07-08): retrato limpo, SEM cenário —
      // a description costuma citar ambiente/negócio e a imagem saía dominada pelo
      // cenário (parede com texto, outras pessoas). Cenário é papel do keyframe do vídeo.
      const providerUrl = await genImage({
        prompt: `${fstyle.render} close-up portrait of ${persona.description}. IMPORTANT: ignore any environment, location or setting mentioned above — the subject fills the frame from the chest up, against a plain soft neutral studio background. SOLO subject, absolutely no other people. Neutral friendly expression, soft natural light, ${fstyle.texture}, looking at camera. No text, no letters, no signage anywhere. Vertical 9:16 composition.`,
      });
      const key = `personas/${personaId}/front.jpg`;
      await storage.put(key, await downloadToBuffer(providerUrl));
      await insertAsset(personaId, "front", 0, key, providerUrl);
      return { output: { key, providerUrl }, costUsd: PRICING.imagePerUnit };
    });
    const frontUrl = await publicAssetUrl({ storage_key: front.key, provider_url: front.providerUrl });

    // ── 2. Ângulos (identity lock) em paralelo ──────────────────────────
    await mapLimit(Object.entries(SHEET_POSES), 2, ([kind, pose], j) =>
      step(jobKey, kind, async () => {
        const providerUrl = await genImage({
          prompt: `Same character as in the reference image, identical face and hair. ${pose}. Same style and lighting, plain neutral background, ${fstyle.render}, vertical 9:16 composition.`,
          referenceImages: [frontUrl],
        });
        const key = `personas/${personaId}/${kind}.jpg`;
        await storage.put(key, await downloadToBuffer(providerUrl));
        await insertAsset(personaId, kind, j + 1, key, providerUrl);
        return { output: { key }, costUsd: PRICING.imagePerUnit };
      })
    );

    const used = usdToCredits(await jobCostUsd(jobKey));
    await releaseRefHold(`persona:${personaId}:creation`, "sobra da estimativa (persona automática)", used);
    await setPersonaStatus(personaId, "ready");
    await pool.query("update personas set teaser_status = 'generating' where id = $1", [personaId]);

    // ── 3. TEASER (~8s, marca d'água): a persona se apresenta ao dono ───
    // Falha de teaser NÃO falha a persona (try/catch): pior caso, e-mail sem vídeo.
    try {
      const line = await step(jobKey, "teaser_line", async () => ({
        output: { line: await generateTeaserLine({ personaName: persona.name, niche: niche || persona.niche || "seu negócio", gender, tagline }) },
      }));
      const script: any = {
        title: "teaser", hook: (line as any).line, narration: (line as any).line, hashtags: [],
        shots: [{ visual_prompt: "x", dialogue: (line as any).line, camera: "medium shot" }],
      };
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `teaser-${personaId.slice(0, 8)}-`));
      const voiceFile = path.join(tmp, "voice.mp3");
      const voice = persona.voice_id || CURATED_VOICES[0].id;
      const narr = await generateNarration({ script, voice, outFile: voiceFile });

      const teaserTakeKey: any = await step(jobKey, "teaser_take", async () => {
        const audioUrl = await hostBuffer(`personas/${personaId}/teaser-voice.mp3`, fs.readFileSync(voiceFile), "audio/mpeg");
        const take = await generateAvatarTake({ audioUrl, imageUrl: frontUrl });
        const key = `personas/${personaId}/teaser-take.mp4`;
        await storage.put(key, take.buffer);
        return { output: { key }, costUsd: narr.durationSeconds * PRICING.avatarPerSecond + PRICING.ttsFlat };
      });

      await step(jobKey, "teaser_final", async () => {
        await storage.pull?.((teaserTakeKey as any).key);
        const assembled = path.join(tmp, "assembled.mp4");
        await assembleAvatar({
          takeFile: storage.getPath((teaserTakeKey as any).key),
          script,
          audioDurationSeconds: narr.durationSeconds,
          alignment: narr.alignment,
          music: "inspirador",
          broll: null,
          outFile: assembled,
        });
        // Marca d'água (não é conteúdo postável — é a degustação)
        const key = `personas/${personaId}/teaser.mp4`;
        const outFile = storage.getPath(key);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        await exec("ffmpeg", ["-y", "-v", "error", "-i", assembled,
          "-vf", "drawtext=text='influai.com.br':fontcolor=white@0.55:fontsize=30:x=w-tw-24:y=36:font=Lato",
          "-c:v", "libx264", "-crf", "21", "-preset", "veryfast", "-c:a", "copy", "-movflags", "+faststart", outFile]);
        await storage.put(key, fs.readFileSync(outFile));
        return { output: { key } };
      });

      await pool.query("update personas set teaser_status = 'ready', teaser_storage_key = $2 where id = $1",
        [personaId, `personas/${personaId}/teaser.mp4`]);
      fs.rmSync(tmp, { recursive: true, force: true });

      await step(jobKey, "teaser_email", async () => {
        const { rows: u } = await pool.query("select u.email from users u join personas p on p.user_id = u.id where p.id = $1", [personaId]);
        if (u[0]?.email) {
          await sendEmail({
            to: u[0].email,
            subject: `🎬 ${persona.name} gravou uma mensagem pra você`,
            html: emailTemplate({
              title: `${persona.name} está no ar!`,
              body: "Seu influenciador ficou pronto — e gravou um vídeo se apresentando pra você. Dá o play e depois é só escolher o tema do primeiro vídeo de verdade.",
              ctaLabel: "Assistir e criar o primeiro vídeo",
              ctaUrl: `${baseUrl()}/personas/${personaId}`,
            }),
            text: `${persona.name} está pronto! Veja a mensagem: ${baseUrl()}/personas/${personaId}`,
          }).catch(() => {});
        }
        return { output: {} };
      });
      console.log(`[auto-persona] ✔ ${personaId} pronta + teaser`);
    } catch (e: any) {
      console.error(`[auto-persona] teaser falhou (persona segue ready): ${String(e?.message).slice(0, 160)}`);
      await pool.query("update personas set teaser_status = 'failed' where id = $1", [personaId]);
      // Fallback: pelo menos avisa que a persona ficou pronta
      const { rows: u } = await pool.query("select u.email from users u join personas p on p.user_id = u.id where p.id = $1", [personaId]);
      if (u[0]?.email) {
        await sendEmail({
          to: u[0].email,
          subject: "Seu influenciador está pronto 🎬",
          html: emailTemplate({
            title: `${persona.name} está no ar!`,
            body: "O rosto e a identidade do seu influenciador ficaram prontos. Agora é só escolher um tema que a IA escreve o roteiro pra você.",
            ctaLabel: "Criar o primeiro vídeo",
            ctaUrl: `${baseUrl()}/personas/${personaId}`,
          }),
          text: `Seu influenciador está pronto: ${baseUrl()}/personas/${personaId}`,
        }).catch(() => {});
      }
    }
  };

  for (let w = 0; w < AUTO_CONCURRENCY; w++) {
    await boss.work("persona-auto", { batchSize: 1 }, run);
  }

  await boss.work("persona-auto-dlq", { batchSize: 1 }, async ([job]) => {
    const { personaId } = (job.data as any) ?? {};
    if (!personaId) return;
    await releaseRefHold(`persona:${personaId}:creation`, "falha na persona automática");
    await setPersonaStatus(personaId, "failed", "Falha ao criar o influenciador. Créditos devolvidos — tente de novo.");
  });

  console.log("[worker] job persona-auto registrado (funil novo)");
}
