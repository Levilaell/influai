// Estágio 4 — Vídeo por shot (image-to-video).
// No modo "native", o prompt inclui a fala e o modelo gera voz + lip-sync.
// No modo "tts", gera-se o vídeo sem áudio e a voz entra na montagem.
import { genVideo } from "../lib/providers.js";
import { DEFAULTS } from "../config.js";

export async function generateShots({ script, keyframes, audioMode, shotSeconds = DEFAULTS.shotSeconds, resolution = DEFAULTS.resolution }) {
  const videos = [];

  for (const [i, shot] of script.shots.entries()) {
    const speech =
      audioMode === "native"
        ? ` The person speaks directly to camera in Brazilian Portuguese, natural lip-sync, saying: "${shot.dialogue}". Clear voice, subtle ambient sound.`
        : " The person is talking to camera (mouth moving naturally), no audio needed.";

    console.log(`  ▶ shot ${i + 1}/${script.shots.length}...`);
    const url = await genVideo({
      prompt: `${shot.camera}, ${shot.visual_prompt}. Natural realistic motion, handheld creator-style camera.${speech}`,
      imageUrl: keyframes[i],
      aspectRatio: DEFAULTS.aspectRatio,
      resolution,
      generateAudio: audioMode === "native",
      durationSeconds: shotSeconds,
      onProgress: () => process.stdout.write("."),
    });

    videos.push(url);
    console.log(` ✓`);
  }

  return videos;
}
