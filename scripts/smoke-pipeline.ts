#!/usr/bin/env tsx
// Smoke test do core: pipeline completo SEM web/fila, com paridade com o
// protótipo. Econômico: 2 shots (~10s de narração) ≈ $0.70 no Atlas.
// Uso: pnpm smoke
import "@influa/core/env";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { moderate } from "@influa/core/moderation/gate";
import { generateScript } from "@influa/core/pipeline/script";
import {
  generateSceneKeyframe,
  generateNarration,
  generateAvatarTake,
} from "@influa/core/pipeline/avatar";
import { assembleAvatar } from "@influa/core/pipeline/assemble";
import { genImage } from "@influa/core/providers/index";
import { getStorage } from "@influa/core/storage/index";

// Hospeda mídia no storage (R2/local) e devolve URL pública — Atlas aposentado.
async function hostPublic(key: string, buf: Buffer, ct: string): Promise<string> {
  const st = getStorage();
  await st.put(key, buf, ct);
  return st.publicUrl(key, 2 * 60 * 60);
}
import { estimateVideoUSD } from "@influa/core/config";

const t0 = Date.now();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "influa-smoke-"));
const dot = () => process.stdout.write(".");

const personaDescription = "young brazilian woman, mid 20s, wavy brown hair, brown eyes, warm smile";

// 1. Moderação (deve passar)
console.log("1/7 moderação...");
const mod = await moderate(personaDescription, "persona");
if (!mod.allowed) throw new Error(`Moderação bloqueou indevidamente: ${mod.reason}`);
console.log(`  ✓ allowed (${mod.category})`);

// 2. Rosto base (text-to-image)
console.log("2/7 rosto base...");
const baseFace = await genImage({
  prompt: `Photorealistic portrait of ${personaDescription}. Ultra realistic skin texture, natural lighting, looking at camera, plain neutral background, social media creator aesthetic. Vertical 9:16 composition.`,
  onPoll: dot,
});
console.log(`\n  ✓ ${baseFace.slice(0, 80)}...`);

// 3. Roteiro (2 shots — econômico)
console.log("3/7 roteiro...");
const script = await generateScript({
  personaName: "Lia Smoke",
  personaDescription,
  niche: "curiosidades de tecnologia",
  topic: "o app de IA que resume qualquer vídeo de 1 hora",
  shots: 2,
});
const scriptChars = script.shots.reduce((s, x) => s + x.dialogue.length, 0);
console.log(`  ✓ "${script.title}" (${scriptChars} chars) — estimativa: $${estimateVideoUSD(scriptChars).total}`);

// 4. Keyframe de cena (identity lock com o rosto base)
console.log("4/7 keyframe de cena...");
const keyframe = await generateSceneKeyframe({ referenceUrls: [baseFace], script, onPoll: dot });
console.log(`\n  ✓ keyframe ok (${keyframe.buffer.length} bytes)`);

// 5. Narração (ElevenLabs, voz matilda)
console.log("5/7 narração...");
const voiceFile = path.join(tmp, "voice.mp3");
const narration = await generateNarration({ script, voice: "matilda", outFile: voiceFile });
console.log(`  ✓ ${narration.durationSeconds.toFixed(1)}s`);

// 6. Áudio sobe pro storage do próprio Atlas (robusto, sem túnel)
console.log("6/7 take avatar...");
const audioUrl = await hostPublic(`scripts/${Date.now().toString(36)}-voice.mp3`, fs.readFileSync(voiceFile), "audio/mpeg");
const take = await generateAvatarTake({ audioUrl, imageUrl: keyframe.providerUrl, onPoll: dot });
const takeFile = path.join(tmp, "take.mp4");
fs.writeFileSync(takeFile, take.buffer);
console.log(`\n  ✓ take ${(take.buffer.length / 1e6).toFixed(1)}MB`);

// 7. Montagem (legendas)
console.log("7/7 montagem...");
const outFile = path.join("data", "smoke", "final.mp4");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
await assembleAvatar({
  takeFile,
  script,
  audioDurationSeconds: narration.durationSeconds,
  alignment: narration.alignment,
  outFile,
});

console.log(`\n✔ SMOKE_OK ${outFile} em ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(0);
