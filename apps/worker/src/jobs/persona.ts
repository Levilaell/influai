// Jobs do Persona Studio:
//   persona-candidates: 4 rostos candidatos (text-to-image)
//   persona-sheet:      candidato escolhido vira 'front' + 3 variações identity-locked
// Créditos: hold por ref ('persona:<id>:candidates:<n>' | 'persona:<id>:sheet');
// falha terminal (DLQ) devolve tudo; sucesso devolve a sobra.
import type PgBoss from "pg-boss";
import { step, jobCostUsd } from "../steps.ts";
import { setPersonaStatus } from "../progress.ts";
import { publicAssetUrl, getPersonaAssets } from "../assets.ts";
import { getPool } from "@influa/core/db/client";
import { getStorage } from "@influa/core/storage/index";
import { sendEmail, emailTemplate } from "@influa/core/email/index";
import { genImage, downloadToBuffer } from "@influa/core/providers/index";
import { releaseRefHold } from "@influa/core/credits/ledger";
import { faceStyle } from "@influa/core/pipeline/face";
import { mapLimit } from "@influa/core/util/concurrency";
import { PRICING, usdToCredits, DEFAULTS } from "@influa/core/config";

// Imagens em paralelo. Agora no WaveSpeed (elástico), então geramos TODOS de uma vez:
// os 4 candidatos juntos e as 3 variações do sheet juntas. Default 6 cobre ambos; tunável por env.
const IMAGE_CONCURRENCY = Math.max(1, Number(process.env.IMAGE_CONCURRENCY ?? process.env.ATLAS_IMAGE_CONCURRENCY ?? "6"));

// Os 4 candidatos são OPÇÕES DE PESSOA (o usuário escolhe a identidade) — então cada
// variação muda traços do rosto, cabelo e figurino, não só a luz (só luz = 4 clones).
const CANDIDATE_VARIATIONS = [
  "soft rounded facial features, natural loose hair, neutral friendly expression, minimalist casual outfit, soft natural light",
  "angular well-defined facial features, short or tied-back hairstyle, slight warm smile, earth-tone smart casual outfit, golden hour light",
  "expressive eyes and delicate features, wavy or curly hair, confident subtle look, modern relaxed outfit, studio softbox light",
  "striking distinctive features, sleek straight hair in a different tone, gentle smile, elegant minimal outfit, soft window light",
];

// Só os ângulos que o pipeline de vídeo usa como referência de keyframe
// (front + three_quarter + speaking). O "profile" era gerado e nunca usado.
const SHEET_POSES: Record<string, string> = {
  three_quarter: "three-quarter view portrait, slight smile",
  speaking: "mid-speech expression, talking to camera, hands slightly visible, upper body",
};

async function loadPersona(personaId: string) {
  const { rows } = await getPool().query("select * from personas where id = $1", [personaId]);
  return rows[0];
}

// E-mail de retorno — MAIOR vazamento do funil (medido 2026-07-08): usuários saem
// durante a geração dos rostos e nunca voltam (6 de 9 cadastros do dia pararam ali,
// todos com os 4 rostos prontos esperando). O e-mail traz de volta.
async function notifyPersona(personaId: string, subject: string, title: string, body: string, ctaLabel: string, path: string) {
  const { rows } = await getPool().query(
    "select u.email from users u join personas p on p.user_id = u.id where p.id = $1",
    [personaId]
  );
  const email = rows[0]?.email;
  if (!email) return;
  const base = (process.env.PUBLIC_BASE_URL ?? "https://influai.com.br").replace(/\/$/, "");
  await sendEmail({
    to: email,
    subject,
    html: emailTemplate({ title, body, ctaLabel, ctaUrl: `${base}${path}` }),
    text: `${body} ${base}${path}`,
  }).catch(() => {
    /* best-effort */
  });
}

async function insertAsset(opts: {
  personaId: string;
  kind: string;
  idx: number;
  storageKey: string;
  providerUrl: string;
}) {
  await getPool().query(
    `insert into persona_assets (persona_id, kind, idx, storage_key, provider_url)
     values ($1, $2, $3, $4, $5)`,
    [opts.personaId, opts.kind, opts.idx, opts.storageKey, opts.providerUrl]
  );
}

/** Devolve todos os holds não-liberados de uma persona (usado em falha terminal). */
async function releaseAllPersonaHolds(personaId: string, note: string) {
  const { rows } = await getPool().query(
    `select l.ref from credit_ledger l
     where l.persona_id = $1 and l.entry_type = 'hold'
       and not exists (
         select 1 from credit_ledger r where r.ref = l.ref and r.entry_type = 'hold_release'
       )`,
    [personaId]
  );
  for (const { ref } of rows) await releaseRefHold(ref, note);
}

export async function registerPersonaJobs(boss: PgBoss) {
  for (const q of ["persona-candidates", "persona-sheet"]) {
    await boss.createQueue(`${q}-dlq`);
    await boss.createQueue(q, {
      retryLimit: 2,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 900,
      deadLetter: `${q}-dlq`,
    } as any);
  }

  // Jobs de persona simultâneos POR RÉPLICA (mesmo padrão do video-pipeline): cada
  // registro pega 1 job por vez; N registros = N usuários criando rostos ao mesmo tempo.
  // I/O-bound (espera o WaveSpeed), então é barato. 2 réplicas × 3 = 6 personas em paralelo.
  const PERSONA_CONCURRENCY = Math.max(1, Number(process.env.PERSONA_CONCURRENCY ?? "3"));

  // ── 4 rostos candidatos ────────────────────────────────────────────
  const runCandidates = async ([job]: any[]) => {
    const { personaId, batch } = job.data as { personaId: string; batch: number };
    const jobKey = `persona:${personaId}:candidates:${batch}`;
    const persona = await loadPersona(personaId);
    if (!persona) return;

    await setPersonaStatus(personaId, "candidates_generating");
    const storage = getStorage();

    const fs = faceStyle(persona.face_style);
    await mapLimit(
      Array.from({ length: DEFAULTS.personaCandidates }, (_, i) => i),
      IMAGE_CONCURRENCY,
      (i) =>
        step(jobKey, `candidate_${i}`, async () => {
          const providerUrl = await genImage({
            prompt: `${fs.render} close-up portrait of ${persona.description}. This is option ${i + 1} of 4 — a UNIQUE individual clearly distinct from the other options: ${CANDIDATE_VARIATIONS[i]}. IMPORTANT: ignore any environment or setting mentioned — subject fills the frame from the chest up, plain soft neutral studio background, SOLO subject, no other people, no text or signage. ${fs.texture}, looking at camera. Vertical 9:16 composition.`,
          });
          const key = `personas/${personaId}/candidate_${batch}_${i}.jpg`;
          await storage.put(key, await downloadToBuffer(providerUrl));
          await insertAsset({ personaId, kind: "candidate", idx: i, storageKey: key, providerUrl });
          return { output: { key, providerUrl }, costUsd: PRICING.imagePerUnit };
        })
    );

    const used = usdToCredits(await jobCostUsd(jobKey));
    await releaseRefHold(jobKey, "sobra da estimativa (candidatos)", used);
    await setPersonaStatus(personaId, "candidates_ready");

    // Só no 1º lote (re-roll = usuário está na página). step() evita duplicar no retry.
    if (batch === 1) {
      await step(jobKey, "notify_candidates_ready", async () => {
        await notifyPersona(
          personaId,
          "Seus 4 rostos ficaram prontos ✨",
          "As opções de rosto estão prontas!",
          "A IA gerou 4 opções de rosto pro seu influenciador. Escolha a sua favorita — leva 10 segundos e ela vira a identidade permanente da sua marca.",
          "Escolher o rosto",
          `/personas/${personaId}`
        );
        return { output: {} };
      });
    }
  };
  for (let w = 0; w < PERSONA_CONCURRENCY; w++) {
    await boss.work("persona-candidates", { batchSize: 1 }, runCandidates);
  }

  await boss.work("persona-candidates-dlq", { batchSize: 1 }, async ([job]) => {
    const { personaId } = (job.data as any) ?? {};
    if (!personaId) return;
    await releaseAllPersonaHolds(personaId, "falha na geração de candidatos");
    await setPersonaStatus(personaId, "failed", "Falha ao gerar os rostos. Créditos devolvidos.");
  });

  // ── Character sheet identity-locked ────────────────────────────────
  const runSheet = async ([job]: any[]) => {
    const { personaId, chosenAssetId } = job.data as { personaId: string; chosenAssetId: string };
    const jobKey = `persona:${personaId}:sheet`;
    const persona = await loadPersona(personaId);
    if (!persona) return;

    await setPersonaStatus(personaId, "sheet_generating");
    const storage = getStorage();

    // Promove o candidato escolhido a rosto oficial
    await step(jobKey, "promote", async () => {
      await getPool().query(
        "update persona_assets set kind = 'front', idx = 0 where id = $1 and persona_id = $2",
        [chosenAssetId, personaId]
      );
      return { output: { chosenAssetId } };
    });

    const [front] = await getPersonaAssets(personaId, ["front"]);
    if (!front) throw new Error("Asset 'front' não encontrado após promote");
    const frontUrl = await publicAssetUrl(front);

    const sheetStyle = faceStyle(persona.face_style);
    await mapLimit(Object.entries(SHEET_POSES), IMAGE_CONCURRENCY, ([kind, pose], j) =>
      step(jobKey, kind, async () => {
        const providerUrl = await genImage({
          prompt: `Same character as in the reference image, identical face and hair. ${pose}. Same style and lighting, plain neutral background, ${sheetStyle.render}, vertical 9:16 composition.`,
          referenceImages: [frontUrl],
        });
        const key = `personas/${personaId}/${kind}.jpg`;
        await storage.put(key, await downloadToBuffer(providerUrl));
        await insertAsset({ personaId, kind, idx: j + 1, storageKey: key, providerUrl });
        return { output: { key, providerUrl }, costUsd: PRICING.imagePerUnit };
      })
    );

    const used = usdToCredits(await jobCostUsd(jobKey));
    await releaseRefHold(jobKey, "sobra da estimativa (character sheet)", used);
    await setPersonaStatus(personaId, "ready");

    await step(jobKey, "notify_ready", async () => {
      await notifyPersona(
        personaId,
        "Seu influenciador está pronto 🎬",
        "Identidade travada — bora pro primeiro vídeo!",
        "O rosto do seu influenciador está travado: ele vai aparecer idêntico em todos os vídeos. Agora é só escolher um tema que a IA escreve o roteiro pra você.",
        "Criar o primeiro vídeo",
        `/videos/new?persona=${personaId}`
      );
      return { output: {} };
    });
  };
  for (let w = 0; w < PERSONA_CONCURRENCY; w++) {
    await boss.work("persona-sheet", { batchSize: 1 }, runSheet);
  }

  await boss.work("persona-sheet-dlq", { batchSize: 1 }, async ([job]) => {
    const { personaId } = (job.data as any) ?? {};
    if (!personaId) return;
    await releaseAllPersonaHolds(personaId, "falha no character sheet");
    await setPersonaStatus(personaId, "failed", "Falha ao gerar o character sheet. Créditos devolvidos.");
  });

  console.log("[worker] jobs de persona registrados");
}
