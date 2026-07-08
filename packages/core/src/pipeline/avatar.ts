// Estágios do modo avatar — porte de prototype/stages/avatar.js.
// Funções puras: recebem URLs, devolvem buffers/arquivos; quem persiste é o worker.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { atlasImage, downloadToBuffer } from "../providers/atlas.ts";
import { wavespeedAvatar } from "../providers/wavespeed.ts";
import { elevenLabsTTS, type Alignment } from "../providers/elevenlabs.ts";
import type { Script } from "../schemas.ts";

const execFileAsync = promisify(execFile);

/**
 * Keyframe único de cena: persona no ambiente do 1º shot (identity lock).
 * productUrls = logo/produtos da marca a aparecer na cena (refs extras do Nano Banana).
 */
export async function generateSceneKeyframe(opts: {
  referenceUrls: string[];
  productUrls?: string[];
  productHint?: string; // rótulos dos recursos ("café em grão, logo da marca")
  scenePrompt?: string; // ambiente escolhido pelo usuário (estilo)
  sceneRefUrl?: string; // foto do espaço REAL da marca (referência de cenário)
  renderStyle?: string; // "photorealistic" | "3D animated ..." (estilo do rosto)
  script: Script;
  onPoll?: () => void;
}): Promise<{ providerUrl: string; buffer: Buffer }> {
  const shot = opts.script.shots[0];
  const persona = opts.referenceUrls.slice(0, 3);
  const products = (opts.productUrls ?? []).slice(0, 4); // 3 + 4 = 7 refs (< limite 14)
  const sceneRef = opts.sceneRefUrl ? [opts.sceneRefUrl] : [];
  const productLine = products.length
    ? ` The scene naturally features the product/brand shown in the ADDITIONAL reference images${
        opts.productHint ? ` (${opts.productHint})` : ""
      }: the person presents or holds it, product clearly visible with branding, labels and logo kept faithful to those references.`
    : "";
  // Foto de cenário real tem prioridade máxima; senão, o prompt de cenário; senão o visual_prompt.
  const sceneLine = opts.sceneRefUrl
    ? ` The background and environment must match the LAST reference image (a photo of the real location) — same space, decor and vibe.`
    : opts.scenePrompt
      ? ` Setting: ${opts.scenePrompt}.`
      : "";
  const render = opts.renderStyle || "photorealistic";
  const providerUrl = await atlasImage({
    // Talking head como padrão (rosto visível, olhos abertos, geralmente para a câmera)
    // pra evitar poses ruins no keyframe — mas gestos naturais e mostrar produtos são ok.
    // Proibimos texto (modelos alucinam texto-lixo em placas/rótulos).
    prompt: `The character from the FIRST reference images (identical face and hair), as a social media creator speaking to the viewer. Face clearly visible with open eyes, mostly facing the camera. ${shot.camera}. Scene: ${shot.visual_prompt}.${sceneLine} Natural confident expression and gestures; holding products at chest height is fine, but the face stays visible and engaged (avoid fully turning away or closing the eyes).${productLine} ${render}, vertical 9:16, cinematic lighting, high detail. No text, no letters, no captions, no watermark, no signage anywhere in the image.`,
    referenceImages: [...persona, ...products, ...sceneRef],
    onPoll: opts.onPoll,
  });
  return { providerUrl, buffer: await downloadToBuffer(providerUrl) };
}

/** Narração completa (dialogues concatenados = mesmo texto das legendas). */
export async function generateNarration(opts: {
  script: Script;
  voice: string;
  outFile: string;
}): Promise<{ durationSeconds: number; text: string; alignment: Alignment | null }> {
  const text = opts.script.shots.map((s) => s.dialogue).join(" ");
  const { alignment } = await elevenLabsTTS({ text, voice: opts.voice, outFile: opts.outFile });
  const durationSeconds = await probeDurationSeconds(opts.outFile);
  return { durationSeconds, text, alignment };
}

/** Take contínuo com lip-sync (áudio embutido no mp4). */
export async function generateAvatarTake(opts: {
  audioUrl: string;
  imageUrl: string;
  onPoll?: () => void;
}): Promise<{ providerUrl: string; buffer: Buffer }> {
  // Take de avatar agora no WaveSpeed (elástico, cena com movimento, mesmo preço do Atlas).
  const providerUrl = await wavespeedAvatar({
    audioUrl: opts.audioUrl,
    imageUrl: opts.imageUrl,
    onPoll: opts.onPoll,
  });
  return { providerUrl, buffer: await downloadToBuffer(providerUrl) };
}

export async function probeDurationSeconds(file: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  const dur = parseFloat(stdout.trim());
  if (!Number.isFinite(dur)) throw new Error(`ffprobe não retornou duração para ${file}`);
  return dur;
}
