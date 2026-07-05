// Estágio 3 — Keyframes por shot, com Persona Lock + frame chaining.
// Cada keyframe recebe as referências da persona (identity lock) e o keyframe
// anterior (continuidade de roupa/cenário/luz entre shots).
import { genImage } from "../lib/providers.js";

export async function generateKeyframes({ persona, script }) {
  const keyframes = [];
  let previousFrame = null;

  for (const [i, shot] of script.shots.entries()) {
    const refs = [...persona.referenceImages.slice(0, 3)];
    if (previousFrame) refs.push(previousFrame); // frame chaining

    const continuity = previousFrame
      ? "Maintain the exact same outfit, hairstyle, environment and lighting as the last reference image."
      : "Casual creator outfit, consistent modern environment suitable for the scene.";

    const url = await genImage({
      prompt: `The person from the reference images (identical face and hair). ${shot.camera}, ${shot.visual_prompt}. ${continuity} Photorealistic, vertical 9:16, cinematic lighting, high detail.`,
      referenceImages: refs,
    });

    keyframes.push(url);
    previousFrame = url;
    console.log(`  ✓ keyframe ${i + 1}/${script.shots.length} (${shot.camera})`);
  }

  return keyframes;
}
