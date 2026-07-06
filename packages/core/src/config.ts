// Port de prototype/config.js — modelos, preços e conversão em créditos.
// MVP: provedor único Atlas Cloud, modo avatar como padrão de talking-head.
import { env } from "./env.ts";

export const ATLAS = {
  baseUrl: process.env.ATLAS_BASE_URL ?? "https://api.atlascloud.ai",
  imageRefField: "images", // confirmado no schema oficial do Atlas
  models: {
    // IDs validados na conta (2026-07-02) — ver prototype/discover-atlas.js
    image: process.env.ATLAS_IMAGE_MODEL ?? "google/nano-banana-2/text-to-image",
    imageEdit: process.env.ATLAS_IMAGE_EDIT_MODEL ?? "google/nano-banana-2/edit",
    // InfiniteTalk: A/B (2026-07-04) venceu — mais dinâmico e mais barato ($0.03/s).
    // Pedimos 720p no payload (default do modelo é 480p). Reversível via env.
    avatar: process.env.ATLAS_AVATAR_MODEL ?? "atlascloud/infinitetalk",
    // Wan 2.6 i2v ($0.018/s) no lugar do veo3.1-fast: ~mesmo movimento, ~1/3 do custo
    // (validado com clipe real de café). Reversível via env.
    broll: process.env.ATLAS_BROLL_MODEL ?? "alibaba/wan-2.6/image-to-video",
  },
};

// Preços em USD (validados 2026-07-02 — conferir periodicamente)
export const PRICING = {
  imagePerUnit: 0.08,     // nano-banana-2 (text-to-image e edit)
  avatarPerSecond: 0.061, // atlascloud/infinitetalk 720p (MEDIDO: $0.4623/7.56s). 480p = ~$0.03/s.
  scriptFlat: 0.03,       // Claude (roteiro + moderação), arredondado pra cima
  ttsFlat: 0.05,          // ElevenLabs (conta própria — contabilizado no custo real)
  brollFlat: 0.17,        // clipe de B-roll: still nano-banana (~0.08) + wan-2.6 i2v ~5s (~0.09)
};

// Vozes ElevenLabs premade multilíngues (PT-BR)
export const VOICES: Record<string, string> = {
  matilda: "XrExE9yKIg1WjnnlVkGX",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  jessica: "cgSgspJ2msm6clMCkdW9",
  charlie: "IKne3meq5aSn9XLyUdCD",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
};

// Vozes CURADAS para o produto — variedade de tom/gênero, boas em PT-BR.
// O preview é gerado por nós em PT-BR (não o sample em inglês da ElevenLabs).
export type CuratedVoice = { id: string; name: string; gender: "feminina" | "masculina"; tone: string };
export const CURATED_VOICES: CuratedVoice[] = [
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "feminina", tone: "profissional, clara" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "feminina", tone: "animada, calorosa" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "feminina", tone: "confiante, madura" },
  { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", gender: "feminina", tone: "brilhante, acolhedora" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "feminina", tone: "jovem, social" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "feminina", tone: "educadora, envolvente" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "masculina", tone: "energético, creator" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "masculina", tone: "grave, confortante" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "masculina", tone: "firme, marcante" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", gender: "masculina", tone: "suave, confiável" },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will", gender: "masculina", tone: "relaxado, otimista" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", gender: "masculina", tone: "carismático, próximo" },
];

// Escolhe uma voz curada do gênero pedido — evita persona masculina com voz feminina.
// `seed` varia a voz entre personas (não fica todo mundo com a mesma).
export function pickVoiceForGender(gender: "masculina" | "feminina", seed = 0): string {
  const pool = CURATED_VOICES.filter((v) => v.gender === gender);
  const list = pool.length ? pool : CURATED_VOICES;
  return list[Math.abs(Math.trunc(seed)) % list.length].id;
}
export const VOICE_PREVIEW_TEXT = "Oi! Essa é a minha voz. Bora criar um conteúdo que prende do começo ao fim?";

export const DEFAULTS = {
  shots: 4,              // blocos de roteiro/legenda
  personaCandidates: 4,  // opções de rosto no wizard
  sheetVariations: 3,    // three_quarter, profile, speaking
  charsPerSecond: 14,    // fala PT-BR ≈ 14 chars/s (validado: 280 chars ≈ 20s)
};

// ── Conversão em créditos ────────────────────────────────────────────
// 1 crédito = $0.01 estimado × CREDIT_MARKUP, sempre ceil.
function markup(): number {
  return parseFloat(process.env.CREDIT_MARKUP ?? "1.0");
}

export function usdToCredits(usd: number): number {
  return Math.ceil(usd * 100 * markup());
}

/** Estimativa do vídeo (modo avatar). segments = nº de takes (vídeo longo). */
export function estimateVideoUSD(scriptChars: number, broll = false, segments = 1) {
  const seconds = Math.ceil(scriptChars / DEFAULTS.charsPerSecond);
  const keyframe = PRICING.imagePerUnit * Math.max(1, segments); // 1 keyframe por segmento
  const avatar = seconds * PRICING.avatarPerSecond;
  const brollCost = broll ? PRICING.brollFlat : 0;
  const total = keyframe + avatar + PRICING.scriptFlat + PRICING.ttsFlat + brollCost;
  return { seconds, keyframe, avatar, broll: brollCost, total: round(total) };
}

export function estimateVideoCredits(scriptChars: number, broll = false, segments = 1): number {
  return usdToCredits(estimateVideoUSD(scriptChars, broll, segments).total);
}

// Criar a persona: cobra UMA vez (4 rostos + character sheet de 3 ângulos).
// Escolher o rosto é grátis; o sheet gera automático dentro desse preço.
export function estimateCreationCredits(): number {
  return usdToCredits((DEFAULTS.personaCandidates + DEFAULTS.sheetVariations) * PRICING.imagePerUnit);
}

// Re-roll ("gerar outros rostos"): só os 4 candidatos novos.
export function estimateCandidatesCredits(): number {
  return usdToCredits(DEFAULTS.personaCandidates * PRICING.imagePerUnit);
}

const round = (n: number) => Math.round(n * 100) / 100;
