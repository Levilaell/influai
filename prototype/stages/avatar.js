// Estágio (modo avatar) — o caminho PADRÃO de talking head:
//   1. keyframe único de cena (Lia no ambiente, identity lock)
//   2. narração inteira via ElevenLabs (voz fixa da persona, palavras exatas)
//   3. Kling avatar anima o keyframe sincronizado ao áudio (take contínuo)
// Resolve na raiz: palavras inventadas/troca de idioma (TTS determinístico),
// voz inconsistente entre vídeos (voice_id fixo) e gestos pulando em cortes.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { genImage, elevenLabsTTS, uploadPublic, genAvatar } from "../lib/providers.js";
import { VOICES } from "../config.js";

/** Keyframe único: a "cena" do take (persona no ambiente do primeiro shot). */
export async function generateSceneKeyframe({ persona, script }) {
  const shot = script.shots[0];
  const url = await genImage({
    prompt: `The person from the reference images (identical face and hair). ${shot.camera}, ${shot.visual_prompt}. Facing the camera, natural pose ready to speak, hands visible. Photorealistic, vertical 9:16, cinematic lighting, high detail.`,
    referenceImages: persona.referenceImages.slice(0, 3),
  });
  console.log(`  ✓ keyframe de cena (${shot.camera})`);
  return url;
}

/** Narração completa (dialogues concatenados = mesmo texto das legendas). */
export async function generateNarration({ script, voice, outDir }) {
  const text = script.shots.map((s) => s.dialogue).join(" ");
  const voiceId = VOICES[voice?.toLowerCase()] ?? (voice?.length === 20 ? voice : VOICES.matilda);
  const file = path.join(outDir, "voice.mp3");

  console.log(`  ▶ narração ElevenLabs (${text.length} chars, voz ${voice ?? "matilda"})...`);
  await elevenLabsTTS({ text, voiceId, outFile: file });

  const durationSeconds = parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      encoding: "utf8",
    }).trim()
  );
  console.log(`  ✓ narração: ${durationSeconds.toFixed(1)}s`);

  const publicUrl = await uploadPublic(file, "audio/mpeg");
  console.log(`  ✓ áudio hospedado`);
  return { file, publicUrl, durationSeconds, text };
}

/** Take contínuo com lip-sync. */
export async function generateAvatarTake({ keyframeUrl, audioUrl }) {
  console.log(`  ▶ Kling avatar (lip-sync)...`);
  const url = await genAvatar({ audioUrl, imageUrl: keyframeUrl });
  console.log(` ✓ take gerado`);
  return url;
}
