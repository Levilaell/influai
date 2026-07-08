// Job principal: vídeo modo avatar (validado no protótipo em 2026-07-02).
//   moderate -> scene_keyframe -> narration -> avatar_take -> assemble -> finalize
// Cada step é idempotente (job_steps); custo real acumulado em cost_usd;
// sucesso devolve a sobra do hold; falha terminal (DLQ) devolve tudo.
import type PgBoss from "pg-boss";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { step, clearStep, jobCostUsd } from "../steps.ts";

const execFileAsync = promisify(execFile);

/** map com concorrência máxima (ordem preservada). Pra rodar takes em paralelo sem estourar o Atlas. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Reтenta em 429/rate-limit/timeout transitório do Atlas — o usuário nunca vê "Falha",
 *  só espera um pouco mais. Backoff escalonado até ~5min. */
async function withTakeRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [20000, 45000, 90000, 150000];
  for (let a = 0; ; a++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const transient = /429|rate.?limit|too many|timed? ?out|50[234]/i.test(msg);
      if (!transient || a >= delays.length) throw e;
      console.warn(`[video] take transitório (${msg.slice(0, 80)}), retry ${a + 1} em ${delays[a] / 1000}s`);
      await new Promise((r) => setTimeout(r, delays[a]));
    }
  }
}
/** Duração em segundos de um mp4/mp3 (ffprobe). */
async function probeSeconds(file: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
    ]);
    return parseFloat(stdout.trim()) || 4;
  } catch {
    return 4; // fallback: assume ~4s
  }
}
import { setVideoStatus, setVideoProgress, setVideoFailed } from "../progress.ts";
import { publicAssetUrl, getPersonaAssets, hostBuffer } from "../assets.ts";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { moderate } from "@influa/core/moderation/gate";
import {
  generateSceneKeyframe,
  generateNarration,
} from "@influa/core/pipeline/avatar";
import { wavespeedAvatarSubmit, wavespeedResultUrl, downloadToBuffer } from "@influa/core/providers/index";
import { assembleAvatar } from "@influa/core/pipeline/assemble";
import { suggestBroll, generateBrollClip } from "@influa/core/pipeline/broll";
import { normalizeStyle } from "@influa/core/pipeline/style";
import { faceStyle } from "@influa/core/pipeline/face";
import { planSegments, sliceAudio, concatTakes } from "@influa/core/pipeline/segments";
import { releaseVideoHold, releaseVideoLeftover } from "@influa/core/credits/ledger";
import { sendEmail, emailTemplate } from "@influa/core/email/index";
import { addCoveredTopic } from "@influa/core/brand/memory";
import { PRICING, usdToCredits } from "@influa/core/config";
import { scriptSchema } from "@influa/core/schemas";

export async function registerVideoJobs(boss: PgBoss) {
  await boss.createQueue("video-pipeline-dlq");
  await boss.createQueue("video-pipeline", {
    // Expiração CURTA + muitos retries, de propósito: como o take é retomável (take_submit
    // cacheado), um retry resume do cache em segundos — então expirar é barato e é o que
    // recupera rápido um job órfão (worker reiniciado em deploy). Take legítimo mais longo
    // que 20min só "expira" e o retry seguinte continua o MESMO take de onde parou.
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 1200,
    deadLetter: "video-pipeline-dlq",
  } as any);

  // Concorrência entre vídeos NUM MESMO processo: registramos N workers independentes
  // (cada um pega 1 job com SKIP LOCKED, com seu próprio retry/DLQ). O pipeline é I/O-bound
  // (o take fica minutos aguardando o WaveSpeed), então 1 réplica cuida de vários vídeos —
  // mais barato que N réplicas. batchSize fica 1 (batch do pg-boss é atômico; não serve aqui).
  const VIDEO_CONCURRENCY = Math.max(1, Number(process.env.VIDEO_CONCURRENCY ?? "4"));
  const runVideo = async ([job]: any[]) => {
    const { videoId } = job.data as { videoId: string };
    const jobKey = `video:${videoId}`;
    const pool = getPool();
    const storage = getStorage();

    const { rows } = await pool.query("select * from videos where id = $1", [videoId]);
    const video = rows[0];
    if (!video || ["ready", "failed", "canceled"].includes(video.status)) return;
    const script = scriptSchema.parse(video.script);
    const style = normalizeStyle(video.style);

    // ── 0. Moderação do roteiro FINAL (editável na UI) ────────────────
    const modResult = await step(jobKey, "moderate", async () => {
      const text = `${script.title}\n${script.hook}\n${script.shots.map((s) => s.dialogue).join("\n")}`;
      const result = await moderate(text, "roteiro");
      return { output: result };
    });
    if (!(modResult as any).allowed) {
      throw new Error(`MODERATION_BLOCKED: ${(modResult as any).reason}`);
    }

    // ── 1. Narração completa (precisa vir antes p/ dividir nos segmentos) ──
    await setVideoStatus(videoId, "voicing");
    await setVideoProgress(videoId, { step: "narration", pct: 20, message: "Gravando a narração (voz da persona)" });
    const narration = await step(jobKey, "narration", async () => {
      const { rows: pr } = await pool.query("select voice_id from personas where id = $1", [video.persona_id]);
      const voice = video.voice_override || pr[0].voice_id; // override = "trocar voz"
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "influa-"));
      const voiceFile = path.join(tmp, "voice.mp3");
      const result = await generateNarration({ script, voice, outFile: voiceFile });
      const key = `videos/${videoId}/voice.mp3`;
      await storage.put(key, voiceFile);
      return {
        output: { key, durationSeconds: result.durationSeconds, alignment: result.alignment },
        costUsd: PRICING.ttsFlat,
      };
    });

    // ── 2. Segmentos: 1 keyframe + 1 take por trecho (Kling não faz vídeo
    //      longo num take só). segments=1 = comportamento de vídeo curto.
    await setVideoStatus(videoId, "keyframing");
    const assets = await getPersonaAssets(video.persona_id, ["front", "three_quarter", "speaking"]);
    if (!assets.length) throw new Error("Persona sem character sheet");
    const referenceUrls = await Promise.all(assets.slice(0, 3).map(publicAssetUrl));

    const refKeys: string[] = Array.isArray(video.reference_keys) ? video.reference_keys : [];
    let productUrls: string[] = [];
    let productHint = "";
    if (refKeys.length) {
      const { rows: ba } = await pool.query(
        "select storage_key, label, kind from brand_assets where storage_key = any($1) and brand_id = $2",
        [refKeys, video.brand_id]
      );
      productUrls = await Promise.all(
        ba.map((a: any) => publicAssetUrl({ storage_key: a.storage_key, provider_url: null, created_at: new Date(0) }))
      );
      productHint = ba.map((a: any) => a.label || a.kind).filter(Boolean).join(", ");
    }
    const { rows: pfRows } = await pool.query("select face_style from personas where id = $1", [video.persona_id]);
    const renderStyle = faceStyle(pfRows[0]?.face_style).render;

    // Foto do espaço REAL da marca como referência de cenário (opcional)
    let sceneRefUrl: string | undefined;
    if (style.sceneRefKey) {
      const { rows: sr } = await pool.query(
        "select storage_key from brand_assets where storage_key = $1 and brand_id = $2",
        [style.sceneRefKey, video.brand_id]
      );
      if (sr[0]) sceneRefUrl = await publicAssetUrl({ storage_key: sr[0].storage_key, provider_url: null, created_at: new Date(0) });
    }

    const nSeg = Math.max(1, Math.min(video.segments || 1, script.shots.length));
    const segs = planSegments(script, nSeg, (narration as any).durationSeconds, (narration as any).alignment);
    const voicePath = storage.getPath((narration as any).key);

    await setVideoStatus(videoId, "rendering");
    await setVideoProgress(videoId, {
      step: "avatar", pct: 35,
      message: segs.length > 1 ? `Animando ${segs.length} takes em paralelo (lip-sync)` : "Animando o take com lip-sync (2-6 min)",
    });
    // Takes em PARALELO (até 3 por vez) — vídeo longo não espera 1 por 1. Ordem preservada.
    // Takes em PARALELO por vídeo: o WaveSpeed é elástico, então os segmentos de um vídeo
    // longo geram ao mesmo tempo (a parte lenta). O keyframe de cada um usa Atlas e é
    // serializado pelo semáforo do Atlas — só o take roda em paralelo no WaveSpeed.
    const takeKeys = await mapLimit(segs, Math.min(segs.length, 6), async (seg, i) => {
      const segScript = { ...script, shots: script.shots.slice(seg.shotStart, seg.shotEnd) };
      const kf = await step(jobKey, `keyframe_${i}`, async () => {
        const result = await withTakeRetry(() => generateSceneKeyframe({
          referenceUrls, productUrls, productHint, script: segScript,
          scenePrompt: style.scenePrompt, sceneRefUrl, renderStyle,
        }));
        const key = `videos/${videoId}/keyframe_${i}.jpg`;
        await storage.put(key, result.buffer);
        return { output: { key, providerUrl: result.providerUrl, at: Date.now() }, costUsd: PRICING.imagePerUnit };
      });
      const tk = await step(jobKey, `take_${i}`, async () => {
        // Submit CACHEADO à parte: retry do job (ou restart do worker num deploy) RETOMA a
        // MESMA task na WaveSpeed em vez de re-submeter — antes cada retry gerava um take
        // novo e pago, e o anterior terminava órfão lá (usuário via "gerado" + app "falhou").
        const sub: any = await step(jobKey, `take_submit_${i}`, async () => {
          const segAudio = storage.getPath(`videos/${videoId}/seg_${i}.mp3`);
          // 1 segmento = áudio inteiro (sem re-cortar); vários = fatia o trecho
          const audioPath = segs.length === 1 ? voicePath : await sliceAudio(voicePath, seg.startSec, seg.endSec, segAudio);
          const audioUrl = await hostBuffer(`videos/${videoId}/audio_${i}.mp3`, fs.readFileSync(audioPath), "audio/mpeg");
          const imageUrl = await publicAssetUrl({ storage_key: (kf as any).key, provider_url: (kf as any).providerUrl, created_at: new Date((kf as any).at ?? 0) });
          return { output: { id: await withTakeRetry(() => wavespeedAvatarSubmit({ audioUrl, imageUrl })) } };
        });
        try {
          // 30min de poll: no tier Bronze da WaveSpeed (2 concorrentes) a task pode ficar
          // um bom tempo na fila DELES antes de rodar.
          const url = await withTakeRetry(() => wavespeedResultUrl(sub.id, { timeoutMs: 30 * 60 * 1000 }));
          const buf = await downloadToBuffer(url);
          const key = `videos/${videoId}/take_${i}.mp4`;
          await storage.put(key, buf);
          return { output: { key }, costUsd: (seg.endSec - seg.startSec) * PRICING.avatarPerSecond };
        } catch (e: any) {
          // A task morreu DO LADO da WaveSpeed → o id cacheado ficou inútil; limpa pro
          // próximo retry do job re-submeter do zero.
          if (/WAVESPEED_TASK_FAILED/.test(String(e?.message))) await clearStep(jobKey, `take_submit_${i}`);
          throw e;
        }
      });
      return (tk as any).key as string;
    });

    // ── 3. Concatena os takes num só (take.mp4) ──────────────────────
    const take = await step(jobKey, "concat_takes", async () => {
      await Promise.all(takeKeys.map((k) => storage.pull?.(k))); // baixa do R2 se preciso
      const key = `videos/${videoId}/take.mp4`;
      const outFile = storage.getPath(key);
      await concatTakes(takeKeys.map((k) => storage.getPath(k)), outFile);
      await storage.put(key, fs.readFileSync(outFile)); // persiste no R2
      return { output: { key } };
    });

    // ── 3.5 B-roll opcional: 1 clipe reaproveitado em 2-3 cortes ─────
    let brollInfo: { file: string; windows: { start: number; duration: number; clipStart: number }[] } | null = null;
    if (style.broll) {
      await setVideoProgress(videoId, { step: "broll", pct: 78, message: "Gerando o corte de B-roll" });
      const broll = await step(jobKey, "broll", async () => {
        const sug = await suggestBroll(script);
        const buf = await generateBrollClip(sug.prompt);
        const key = `videos/${videoId}/broll.mp4`;
        await storage.put(key, buf);
        const clipDur = await probeSeconds(storage.getPath(key));
        const totalDur = (narration as any).durationSeconds as number;
        const chars = script.shots.map((s) => s.dialogue.length);
        const totalChars = chars.reduce((a, b) => a + b, 0) || 1;
        const before = chars.slice(0, sug.shotIndex).reduce((a, b) => a + b, 0);
        const start = totalDur * (before / totalChars) + 0.2;
        // 1 corte só, mais longo (~3.5s): usa o clipe uma vez, sem ficar repetitivo.
        const duration = Math.min(3.5, Math.max(1.5, clipDur - 0.2), totalDur - start - 0.3);
        const windows = [{ start, duration, clipStart: 0 }];
        return { output: { key, windows }, costUsd: PRICING.brollFlat };
      });
      brollInfo = { file: storage.getPath((broll as any).key), windows: (broll as any).windows };
    }

    // ── 4. Montagem (legendas sincronizadas + B-roll) ────────────────
    await setVideoStatus(videoId, "assembling");
    await setVideoProgress(videoId, { step: "assemble", pct: 85, message: "Queimando legendas e finalizando" });
    const final = await step(jobKey, "assemble", async () => {
      await storage.pull?.((take as any).key); // baixa o take.mp4 do R2 se preciso
      if (brollInfo) brollInfo.file = await (storage.pull?.(`videos/${videoId}/broll.mp4`) ?? brollInfo.file);
      const key = `videos/${videoId}/final.mp4`;
      const outFile = storage.getPath(key);
      await assembleAvatar({
        takeFile: storage.getPath((take as any).key),
        script,
        audioDurationSeconds: (narration as any).durationSeconds,
        alignment: (narration as any).alignment ?? null,
        music: style.music,
        broll: brollInfo,
        outFile,
      });
      await storage.put(key, fs.readFileSync(outFile)); // persiste o final no R2 (a web serve daqui)
      return { output: { key } };
    });

    // ── 5. Finalize: sobra do hold + ready ────────────────────────────
    const costUsd = await jobCostUsd(jobKey);
    const used = usdToCredits(costUsd);
    await releaseVideoLeftover(videoId, used);
    await pool.query(
      `update videos set status = 'ready', final_storage_key = $2, actual_cost_usd = $3,
        progress = $4 where id = $1`,
      [
        videoId,
        (final as any).key,
        costUsd,
        JSON.stringify({ step: "done", pct: 100, message: "Pronto!", at: new Date().toISOString() }),
      ]
    );

    // Avisa por email que ficou pronto — a geração leva minutos e o usuário costuma sair;
    // isso traz ele de volta pra ver o vídeo (e o empurrão de assinatura).
    try {
      const { rows: ur } = await pool.query("select email from users where id = $1", [video.user_id]);
      const email = ur[0]?.email;
      if (email) {
        const base = (process.env.PUBLIC_BASE_URL ?? "https://influai.com.br").replace(/\/$/, "");
        const title = (video.script as any)?.title || video.topic || "seu vídeo";
        await sendEmail({
          to: email,
          subject: "Seu vídeo está pronto 🎉",
          html: emailTemplate({
            title: "Seu vídeo está pronto!",
            body: `O <b>${title}</b> ficou pronto — com o seu influenciador gravando sozinho. É assim todo dia, no piloto automático.`,
            ctaLabel: "Assistir agora",
            ctaUrl: `${base}/videos/${videoId}`,
          }),
          text: `Seu vídeo está pronto: ${base}/videos/${videoId}`,
        });
      }
    } catch (e) {
      console.warn(`[video] falha ao enviar email de pronto: ${(e as Error).message}`);
    }

    // Memória operacional: registra o tema coberto (dedup + aprendizado da marca)
    try {
      await addCoveredTopic(video.brand_id, video.topic, videoId);
    } catch (e) {
      console.warn(`[video] falha ao registrar tema na memória: ${(e as Error).message}`);
    }

    // Retenção: descarta TODOS os artefatos intermediários (keyframe_*, take_*,
    // seg_*, voz, legendas, b-roll) — só o final.mp4 fica. Apaga local E R2.
    try {
      const dir = path.dirname(storage.getPath(`videos/${videoId}/final.mp4`));
      const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      for (const f of names) {
        if (f !== "final.mp4") await storage.delete(`videos/${videoId}/${f}`);
      }
    } catch {
      /* melhor esforço */
    }
    console.log(`[video] ✔ ${videoId} pronto (custo real $${costUsd.toFixed(2)}, ${used} créditos)`);
  };
  for (let w = 0; w < VIDEO_CONCURRENCY; w++) {
    await boss.work("video-pipeline", { batchSize: 1 }, runVideo);
  }

  // Falha TERMINAL: devolve créditos e marca failed
  await boss.work("video-pipeline-dlq", { batchSize: 1 }, async ([job]) => {
    const { videoId } = (job.data as any) ?? {};
    if (!videoId) return;
    // Bloqueio por moderação fica registrado no step cacheado
    const { rows: modRows } = await getPool().query(
      "select output from job_steps where job_key = $1 and step = 'moderate'",
      [`video:${videoId}`]
    );
    const blocked = modRows[0] ? modRows[0].output?.allowed === false : false;
    await releaseVideoHold(videoId, blocked ? "roteiro bloqueado pela moderação" : "falha na geração");
    await setVideoFailed(
      videoId,
      blocked
        ? "Roteiro bloqueado pela moderação. Créditos devolvidos."
        : "Falha na geração. Créditos devolvidos — tente novamente."
    );
    console.log(`[video] ✗ ${videoId} falhou terminalmente — créditos devolvidos`);
  });

  console.log("[worker] job video-pipeline registrado");
}
