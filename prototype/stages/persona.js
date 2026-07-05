// Estágio 2 — Persona Lock: character sheet reutilizável.
// Gera o rosto base e depois variações de ângulo/expressão usando o rosto
// base como referência (identity lock). Funciona em qualquer provedor.
// A persona é salva em personas/<slug>.json e reutilizada em todos os vídeos.
import fs from "node:fs";
import path from "node:path";
import { genImage } from "../lib/providers.js";

const PERSONAS_DIR = "personas";

const POSES = [
  "front-facing portrait, looking directly at camera, neutral friendly expression",
  "three-quarter view portrait, slight smile",
  "profile view portrait",
  "mid-speech expression, talking to camera, hands slightly visible, upper body",
];

export function loadPersona(slug) {
  const file = path.join(PERSONAS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export async function createPersona({ name, description, niche, voiceId = "matilda" }) {
  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  const existing = loadPersona(slug);
  if (existing) {
    console.log(`↺ Persona "${name}" já existe — reutilizando character sheet (0 créditos).`);
    return existing;
  }

  console.log(`▶ Criando persona "${name}" (character sheet de ${POSES.length} imagens)...`);

  // 1. Rosto base (text-to-image)
  const baseUrl = await genImage({
    prompt: `Photorealistic portrait of ${description}. Ultra realistic skin texture, natural lighting, looking at camera, plain neutral background, social media creator aesthetic. Vertical 9:16 composition.`,
  });
  console.log(`  ✓ rosto base: ${baseUrl}`);

  // 2. Variações com identity lock (rosto base como referência)
  const referenceImages = [baseUrl];
  for (const pose of POSES.slice(1)) {
    const url = await genImage({
      prompt: `Same person as in the reference image, identical face and hair. ${pose}. Same lighting style, plain neutral background, photorealistic, vertical 9:16 composition.`,
      referenceImages: [baseUrl],
    });
    referenceImages.push(url);
    console.log(`  ✓ variação: ${pose.split(",")[0]}`);
  }

  const persona = {
    slug,
    name,
    description,
    niche,
    voiceId, // voz fixa da persona (nome em VOICES ou voice_id da ElevenLabs)
    referenceImages, // URLs do provedor — passadas como refs em toda geração futura
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(PERSONAS_DIR, { recursive: true });
  fs.writeFileSync(path.join(PERSONAS_DIR, `${slug}.json`), JSON.stringify(persona, null, 2));
  console.log(`  ✓ Persona Lock salvo em personas/${slug}.json`);
  return persona;
}
