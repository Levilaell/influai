// Configuração central do pipeline.
// Provedor ativo: PROVIDER=fal | atlas no .env, ou auto-detecção pelas chaves.
// Todos os endpoints/modelos são intercambiáveis — troca-se aqui (ou por env)
// sem tocar nos estágios.

export const PROVIDER =
  process.env.PROVIDER ??
  (process.env.ATLAS_API_KEY && !process.env.FAL_KEY ? "atlas" : "fal");

// ── fal.ai ──────────────────────────────────────────────────────────────────
export const MODELS = {
  script: "claude-opus-4-8",                       // Anthropic API direta
  image: "fal-ai/nano-banana-pro",                 // text-to-image (rosto base)
  imageEdit: "fal-ai/nano-banana-pro/edit",        // até 14 refs => identity lock
  video: "fal-ai/veo3.1/fast/image-to-video",
  tts: "fal-ai/elevenlabs/tts/eleven-v3",
};

// ── Atlas Cloud ─────────────────────────────────────────────────────────────
// IDs de modelo variam por conta/catálogo — rode `node discover-atlas.js` para
// listar os disponíveis na SUA conta e sobrescreva por env se necessário.
export const ATLAS = {
  baseUrl: process.env.ATLAS_BASE_URL ?? "https://api.atlascloud.ai",
  imageRefField: process.env.ATLAS_IMAGE_REF_FIELD ?? "images", // confirmado no schema oficial
  models: {
    // IDs confirmados via discover-atlas.js (conta do Levi, jul/2026)
    image: process.env.ATLAS_IMAGE_MODEL ?? "google/nano-banana-2/text-to-image",
    imageEdit: process.env.ATLAS_IMAGE_EDIT_MODEL ?? "google/nano-banana-2/edit",
    video: process.env.ATLAS_VIDEO_MODEL ?? "google/veo3.1-fast/image-to-video",
    // std ≈ pro em qualidade percebida (A/B validado pelo Levi em 2026-07-02)
    // pro (1072p, $0.095/s) fica como tier "cinema"
    avatar: process.env.ATLAS_AVATAR_MODEL ?? "kwaivgi/kling-v2.6-std/avatar",
    tts: process.env.ATLAS_TTS_MODEL ?? "elevenlabs/v3/text-to-speech",
    llm: process.env.ATLAS_LLM_MODEL ?? "deepseek-v4", // fallback p/ roteiro sem ANTHROPIC_API_KEY
  },
};

// ── Preços em USD por provedor (estimativas jul/2026 — conferir antes de escalar)
const PRICING_BY_PROVIDER = {
  fal: {
    imagePerUnit: 0.15,
    videoPerSecondNoAudio: 0.10,
    videoPerSecondWithAudio: 0.15,
    ttsPer1kChars: 0.10,
    scriptFlat: 0.05,
  },
  atlas: {
    imagePerUnit: 0.10,          // faixa $0.028–0.15 conforme modelo
    videoPerSecondNoAudio: 0.08, // Veo 3.1 Fast no Atlas
    videoPerSecondWithAudio: 0.08,
    avatarPerSecond: 0.048,      // kling-v2.6-std/avatar (pro/"cinema": 0.095)
    ttsPer1kChars: 0.10,
    scriptFlat: 0.02,
  },
};

// Vozes ElevenLabs (premade, multilíngues — funcionam em PT-BR)
export const VOICES = {
  matilda: "XrExE9yKIg1WjnnlVkGX",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  jessica: "cgSgspJ2msm6clMCkdW9",
  charlie: "IKne3meq5aSn9XLyUdCD",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
};
export const PRICING = PRICING_BY_PROVIDER[PROVIDER] ?? PRICING_BY_PROVIDER.fal;

export const DEFAULTS = {
  shots: 4,             // nº de cenas
  shotSeconds: 8,       // Veo 3.1 gera clipes de até 8s
  resolution: "720p",
  aspectRatio: "9:16",  // vertical (Shorts/Reels/TikTok)
  audioMode: "avatar",  // "avatar" = ElevenLabs TTS + Kling avatar (PADRÃO: fala
                        //            determinística palavra-a-palavra + lip-sync,
                        //            take contínuo — validado em 2026-07-02)
                        // "native" = Veo gera fala+áudio (pode inventar palavras/
                        //            trocar idioma — só para B-roll/testes)
                        // "tts"    = ElevenLabs + mux sem lip-sync (legado)
  personaImages: 4,     // tamanho do character sheet (frente, perfil, 3/4, falando)
};

export function estimateCostUSD({ shots, shotSeconds, audioMode, newPersona, scriptChars = 600 }) {
  const persona = newPersona ? DEFAULTS.personaImages * PRICING.imagePerUnit : 0;
  let keyframes, video, voice;
  if (audioMode === "avatar") {
    keyframes = 1 * PRICING.imagePerUnit;                 // 1 keyframe de cena (take único)
    const estSeconds = Math.ceil(scriptChars / 14);       // fala PT-BR ≈ 14 chars/s
    video = estSeconds * (PRICING.avatarPerSecond ?? 0.095);
    voice = 0; // TTS cobrado na conta ElevenLabs, não nos créditos do provedor
  } else {
    keyframes = shots * PRICING.imagePerUnit;
    const perSecond = audioMode === "native" ? PRICING.videoPerSecondWithAudio : PRICING.videoPerSecondNoAudio;
    video = shots * shotSeconds * perSecond;
    voice = audioMode === "tts" ? (scriptChars / 1000) * PRICING.ttsPer1kChars : 0;
  }
  const total = persona + keyframes + video + voice + PRICING.scriptFlat;
  return {
    persona: round(persona),
    script: PRICING.scriptFlat,
    keyframes: round(keyframes),
    video: round(video),
    voice: round(voice),
    total: round(total),
  };
}

const round = (n) => Math.round(n * 100) / 100;
