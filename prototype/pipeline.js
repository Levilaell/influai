#!/usr/bin/env node
// Pipeline completo: persona -> roteiro -> keyframes -> vídeo -> (voz) -> montagem.
//
// Uso:
//   node pipeline.js \
//     --persona "Lia" \
//     --descricao "young brazilian woman, mid 20s, wavy brown hair, brown eyes, warm smile" \
//     --nicho "curiosidades de tecnologia" \
//     --tema "3 apps de IA que parecem ilegais de tão bons" \
//     --shots 4 --mode native --yes
//
// A persona é criada uma vez e reutilizada (Persona Lock). Rode de novo com o
// mesmo --persona e outro --tema para gerar o segundo vídeo com o MESMO rosto.
import "dotenv/config";
import { fal } from "@fal-ai/client";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

import { DEFAULTS, PROVIDER, estimateCostUSD } from "./config.js";
import { createPersona, loadPersona } from "./stages/persona.js";
import { generateScript } from "./stages/script.js";
import { generateKeyframes } from "./stages/keyframes.js";
import { generateShots } from "./stages/video.js";
import { generateVoice } from "./stages/voice.js";
import { assemble, assembleAvatar } from "./stages/assemble.js";
import { generateSceneKeyframe, generateNarration, generateAvatarTake } from "./stages/avatar.js";

if (PROVIDER === "fal") fal.config({ credentials: process.env.FAL_KEY });

const args = parseArgs(process.argv.slice(2));
const cfg = {
  personaName: args.persona ?? "Lia",
  personaDescription:
    args.descricao ?? "young brazilian woman, mid 20s, wavy brown hair, brown eyes, warm smile",
  niche: args.nicho ?? "curiosidades de tecnologia",
  topic: args.tema ?? "3 ferramentas de IA que parecem mágica",
  shots: Number(args.shots ?? DEFAULTS.shots),
  shotSeconds: Number(args.segundos ?? DEFAULTS.shotSeconds),
  audioMode: args.mode ?? DEFAULTS.audioMode, // avatar | native | tts
  voice: args.voz ?? null,                    // matilda | sarah | jessica | ... (ou voice_id)
  skipConfirm: Boolean(args.yes),
};

main().catch((err) => {
  console.error(`\n✗ Pipeline falhou: ${err.message}`);
  process.exit(1);
});

async function main() {
  if (PROVIDER === "fal" && !process.env.FAL_KEY)
    throw new Error("Defina FAL_KEY no .env (ou use PROVIDER=atlas com ATLAS_API_KEY)");
  if (PROVIDER === "atlas" && !process.env.ATLAS_API_KEY)
    throw new Error("Defina ATLAS_API_KEY no .env (veja .env.example)");

  const slug = cfg.personaName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  const newPersona = !loadPersona(slug);

  // ── Preview de custo ANTES de gastar qualquer coisa (diferencial vs concorrência) ──
  const est = estimateCostUSD({
    shots: cfg.shots,
    shotSeconds: cfg.shotSeconds,
    audioMode: cfg.audioMode,
    newPersona,
    scriptChars: cfg.shots * 110, // ~110 chars de fala por shot
  });
  console.log(`\n┌─ Estimativa de custo (USD) · provedor: ${PROVIDER} · modo: ${cfg.audioMode} ─`);
  console.log(`│ persona (character sheet): $${est.persona.toFixed(2)}${newPersona ? "" : "  (já existe — grátis)"}`);
  console.log(`│ roteiro (Claude):          $${est.script.toFixed(2)}`);
  if (cfg.audioMode === "avatar") {
    console.log(`│ keyframe de cena (1x):     $${est.keyframes.toFixed(2)}`);
    console.log(`│ avatar (take contínuo):    $${est.video.toFixed(2)}`);
    console.log(`│ voz (ElevenLabs):          conta própria (fora dos créditos)`);
  } else {
    console.log(`│ keyframes (${cfg.shots}x):           $${est.keyframes.toFixed(2)}`);
    console.log(`│ vídeo (${cfg.shots}x${cfg.shotSeconds}s, ${cfg.audioMode}):   $${est.video.toFixed(2)}`);
    if (est.voice > 0) console.log(`│ voz (ElevenLabs):          $${est.voice.toFixed(2)}`);
  }
  console.log(`│ TOTAL:                     ~$${est.total.toFixed(2)}  (~R$ ${(est.total * 5.5).toFixed(2)})`);
  console.log("└─────────────────────────────────────────────\n");

  if (!cfg.skipConfirm) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("Continuar? (s/N) ");
    rl.close();
    if (!/^s(im)?$/i.test(answer.trim())) return console.log("Cancelado.");
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join("output", runId);
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();

  // 1. Persona (cria uma vez, reutiliza sempre)
  console.log("── 1/5 Persona ──────────────────────────────");
  const persona = await createPersona({
    name: cfg.personaName,
    description: cfg.personaDescription,
    niche: cfg.niche,
  });

  // 2. Roteiro
  console.log("── 2/5 Roteiro ──────────────────────────────");
  const script = await generateScript({ persona, topic: cfg.topic, shots: cfg.shots });
  console.log(`  ✓ "${script.title}" — hook: "${script.hook}"`);
  fs.writeFileSync(path.join(outDir, "script.json"), JSON.stringify(script, null, 2));

  let finalFile;
  let manifestExtra = {};

  if (cfg.audioMode === "avatar") {
    // ── MODO AVATAR (padrão): TTS determinístico + take contínuo com lip-sync ──
    console.log("── 3/5 Cena ─────────────────────────────────");
    const sceneKeyframe = await generateSceneKeyframe({ persona, script });

    console.log("── 4/5 Voz + Avatar ─────────────────────────");
    const voice = cfg.voice ?? persona.voiceId ?? "matilda";
    const narration = await generateNarration({ script, voice, outDir });
    const takeUrl = await generateAvatarTake({
      keyframeUrl: sceneKeyframe,
      audioUrl: narration.publicUrl,
    });

    console.log("── 5/5 Montagem ─────────────────────────────");
    finalFile = await assembleAvatar({
      script,
      takeUrl,
      audioDurationSeconds: narration.durationSeconds,
      outDir,
    });
    manifestExtra = { sceneKeyframe, takeUrl, voice, narrationSeconds: narration.durationSeconds };
  } else {
    // ── MODOS multi-shot (native/tts) ──
    console.log("── 3/5 Keyframes ────────────────────────────");
    const keyframes = await generateKeyframes({ persona, script });

    console.log("── 4/5 Vídeo ────────────────────────────────");
    const videoUrls = await generateShots({
      script,
      keyframes,
      audioMode: cfg.audioMode,
      shotSeconds: cfg.shotSeconds,
    });

    console.log("── 5/5 Montagem ─────────────────────────────");
    const voiceUrl = cfg.audioMode === "tts" ? await generateVoice({ script }) : null;
    finalFile = await assemble({
      script,
      videoUrls,
      voiceUrl,
      shotSeconds: cfg.shotSeconds,
      outDir,
    });
    manifestExtra = { keyframes, videoUrls, voiceUrl };
  }

  // Manifest para auditoria
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        config: cfg,
        persona: persona.slug,
        estimatedCostUSD: est,
        ...manifestExtra,
        finalFile,
        elapsedSeconds: Math.round((Date.now() - t0) / 1000),
      },
      null,
      2
    )
  );

  console.log(`\n✔ Pronto em ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(`  Vídeo:    ${finalFile}`);
  console.log(`  Título:   ${script.title}`);
  console.log(`  Hashtags: ${script.hashtags.join(" ")}`);
  console.log(`\nPróximo vídeo com a MESMA persona:`);
  console.log(`  node pipeline.js --persona "${cfg.personaName}" --tema "outro tema" --yes`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}
