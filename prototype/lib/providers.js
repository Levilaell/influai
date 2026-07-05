// Camada de provedores: mesma interface para fal.ai e Atlas Cloud.
// O pipeline chama genImage/genVideo/genVoice sem saber qual provedor está ativo.
// Provedor ativo: PROVIDER=fal | atlas (auto-detectado pelas chaves no .env).
import { fal } from "@fal-ai/client";
import { PROVIDER, MODELS, ATLAS } from "../config.js";

// ────────────────────────────────────────────────────────────────────────────
// Interface pública
// ────────────────────────────────────────────────────────────────────────────

/** Gera imagem. Com referenceImages => identity lock (edit). Retorna URL. */
export async function genImage({ prompt, referenceImages = [] }) {
  if (PROVIDER === "atlas") return atlasImage({ prompt, referenceImages });
  return falImage({ prompt, referenceImages });
}

/** Gera vídeo image-to-video. Retorna URL do .mp4. */
export async function genVideo({ prompt, imageUrl, resolution, aspectRatio, generateAudio, durationSeconds, onProgress }) {
  if (PROVIDER === "atlas")
    return atlasVideo({ prompt, imageUrl, resolution, aspectRatio, generateAudio, durationSeconds });
  return falVideo({ prompt, imageUrl, resolution, aspectRatio, generateAudio, onProgress });
}

/** Gera narração TTS. Retorna URL do áudio. */
export async function genVoice({ text, voice, language }) {
  if (PROVIDER === "atlas") return atlasVoice({ text, voice, language });
  return falVoice({ text, voice, language });
}

/**
 * TTS direto na ElevenLabs (conta própria — voz fixa da persona, PT-BR nativo).
 * Grava o mp3 em outFile. eleven_v3 com fallback para multilingual_v2.
 */
export async function elevenLabsTTS({ text, voiceId, outFile }) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Defina ELEVENLABS_API_KEY no .env para o modo avatar");
  const call = async (modelId) => {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: modelId, language_code: "pt" }),
      }
    );
    if (!res.ok) throw new Error(`ElevenLabs ${modelId} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  };
  try {
    await call("eleven_v3");
  } catch {
    await call("eleven_multilingual_v2");
  }
  return outFile;
}

/** Sobe um arquivo para URL pública temporária (necessário para o Atlas buscar). */
export async function uploadPublic(file, mime = "audio/mpeg") {
  const { readFileSync } = await import("node:fs");
  const blob = new Blob([readFileSync(file)], { type: mime });
  // 0x0.st (pode estar com uploads desativados) -> tmpfiles.org
  try {
    const form = new FormData();
    form.append("file", blob, "file.bin");
    const res = await fetch("https://0x0.st", { method: "POST", headers: { "User-Agent": "curl/8.5.0" }, body: form });
    const url = (await res.text()).trim();
    if (res.ok && url.startsWith("http")) return url;
    throw new Error(url.slice(0, 80));
  } catch {
    const form = new FormData();
    form.append("file", blob, "file.mp3");
    const res = await fetch("https://tmpfiles.org/api/v1/upload", { method: "POST", body: form });
    const json = await res.json();
    const page = json?.data?.url;
    if (!page) throw new Error(`upload falhou: ${JSON.stringify(json).slice(0, 200)}`);
    return page.replace("tmpfiles.org/", "tmpfiles.org/dl/");
  }
}

/**
 * Talking head com lip-sync: keyframe + áudio -> take contínuo (Kling avatar).
 * O MP4 resultante já vem com o áudio embutido (AAC).
 */
export async function genAvatar({ audioUrl, imageUrl, prompt }) {
  if (PROVIDER !== "atlas")
    throw new Error("Modo avatar requer PROVIDER=atlas neste protótipo (Kling avatar)");
  const payload = {
    model: ATLAS.models.avatar,
    audio: audioUrl,
    image: imageUrl,
    prompt: prompt ?? "Natural talking head, subtle hand gestures, warm friendly delivery, looking at camera.",
  };
  return atlasSubmitAndPoll("/api/v1/model/generateVideo", payload, { intervalMs: 5000, timeoutMs: 900000 });
}

/**
 * LLM de fallback via Atlas (OpenAI-compatible) — usado no roteiro quando
 * não há ANTHROPIC_API_KEY. Retorna o texto bruto da resposta.
 */
export async function atlasChat({ system, user }) {
  const res = await fetch(`${ATLAS.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: atlasHeaders(),
    body: JSON.stringify({
      model: ATLAS.models.llm,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(`Atlas LLM ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Atlas LLM sem conteúdo: ${JSON.stringify(json).slice(0, 300)}`);
  return text;
}

// ────────────────────────────────────────────────────────────────────────────
// fal.ai
// ────────────────────────────────────────────────────────────────────────────

async function falImage({ prompt, referenceImages }) {
  const endpoint = referenceImages.length ? MODELS.imageEdit : MODELS.image;
  const input = { prompt, aspect_ratio: "9:16", num_images: 1 };
  if (referenceImages.length) input.image_urls = referenceImages;
  const result = await fal.subscribe(endpoint, { input, logs: false });
  const url = result.data?.images?.[0]?.url ?? result.data?.image?.url;
  if (!url) throw new Error(`fal imagem: resposta inesperada ${JSON.stringify(result.data).slice(0, 300)}`);
  return url;
}

async function falVideo({ prompt, imageUrl, resolution, aspectRatio, generateAudio, onProgress }) {
  const result = await fal.subscribe(MODELS.video, {
    input: {
      prompt,
      image_url: imageUrl,
      aspect_ratio: aspectRatio,
      resolution,
      generate_audio: generateAudio,
    },
    logs: false,
    onQueueUpdate(update) {
      if (update.status === "IN_PROGRESS") onProgress?.();
    },
  });
  const url = result.data?.video?.url;
  if (!url) throw new Error(`fal vídeo: resposta inesperada ${JSON.stringify(result.data).slice(0, 300)}`);
  return url;
}

async function falVoice({ text, voice, language }) {
  const result = await fal.subscribe(MODELS.tts, {
    input: { text, voice, language_code: language },
    logs: false,
  });
  const url = result.data?.audio?.url ?? result.data?.audio_url;
  if (!url) throw new Error(`fal TTS: resposta inesperada ${JSON.stringify(result.data).slice(0, 300)}`);
  return url;
}

// ────────────────────────────────────────────────────────────────────────────
// Atlas Cloud (submit → poll em /api/v1/model/prediction/{id})
// ────────────────────────────────────────────────────────────────────────────

// Campos validados contra os schemas oficiais em
// https://static.atlascloud.ai/model/schema/<slug>.json (jul/2026).
// ATENÇÃO: o Atlas IGNORA campos desconhecidos silenciosamente — usar o nome
// errado não dá erro, só resultado errado (aprendido na prática).

async function atlasImage({ prompt, referenceImages }) {
  // text-to-image e edit são modelos distintos no Atlas (ex.:
  // google/nano-banana-2/text-to-image vs google/nano-banana-2/edit)
  const model = referenceImages.length ? ATLAS.models.imageEdit : ATLAS.models.image;
  const payload = { model, prompt, aspect_ratio: "9:16", resolution: "1k" };
  if (referenceImages.length) payload[ATLAS.imageRefField] = referenceImages; // "images" (máx 14)
  return atlasSubmitAndPoll("/api/v1/model/generateImage", payload, { intervalMs: 2000, timeoutMs: 180000 });
}

async function atlasVideo({ prompt, imageUrl, resolution, aspectRatio, generateAudio, durationSeconds }) {
  const payload = {
    model: ATLAS.models.video,
    prompt,
    image: imageUrl,               // schema: "image" (string, obrigatório)
    resolution,                    // 720p | 1080p | 4k
    aspect_ratio: aspectRatio,     // 16:9 | 9:16
    generate_audio: generateAudio,
    duration: durationSeconds,     // 4 | 6 | 8 (integer)
  };
  return atlasSubmitAndPoll("/api/v1/model/generateVideo", payload, { intervalMs: 5000, timeoutMs: 600000 });
}

// Vozes multilíngues do ElevenLabs v3 no Atlas (suportam PT-BR)
const ATLAS_TTS_VOICES = {
  jessica: "cgSgspJ2msm6clMCkdW9",
  bella: "EXAVITQu4vr4xnSDxMaL",
  charlie: "IKne3meq5aSn9XLyUdCD",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
};

async function atlasVoice({ text, voice, language }) {
  const voiceId = ATLAS_TTS_VOICES[voice?.toLowerCase()] ?? (voice?.length === 20 ? voice : ATLAS_TTS_VOICES.jessica);
  const payload = { model: ATLAS.models.tts, text, voice: voiceId, language_code: language };
  return atlasSubmitAndPoll("/api/v1/model/generateAudio", payload, { intervalMs: 2000, timeoutMs: 180000 });
}

async function atlasSubmitAndPoll(path, payload, { intervalMs, timeoutMs }) {
  const res = await fetch(`${ATLAS.baseUrl}${path}`, {
    method: "POST",
    headers: atlasHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(`Atlas ${path} ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);

  const id = json.data?.id ?? json.id;
  if (!id) throw new Error(`Atlas ${path}: sem prediction id em ${JSON.stringify(json).slice(0, 300)}`);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const poll = await fetch(`${ATLAS.baseUrl}/api/v1/model/prediction/${id}`, { headers: atlasHeaders() });
    const state = await safeJson(poll);
    const status = state.data?.status ?? state.status;

    if (status === "completed" || status === "succeeded") {
      const outputs = state.data?.outputs ?? state.outputs;
      const url = Array.isArray(outputs) ? outputs[0]?.url ?? outputs[0] : outputs?.url ?? outputs;
      if (!url || typeof url !== "string")
        throw new Error(`Atlas prediction ${id}: outputs inesperados ${JSON.stringify(outputs).slice(0, 300)}`);
      return url;
    }
    if (status === "failed") {
      throw new Error(`Atlas prediction ${id} falhou: ${JSON.stringify(state.data?.error ?? state).slice(0, 400)}`);
    }
    process.stdout.write(".");
  }
  throw new Error(`Atlas prediction ${id}: timeout após ${timeoutMs / 1000}s`);
}

function atlasHeaders() {
  return {
    Authorization: `Bearer ${process.env.ATLAS_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return { raw: await res.text().catch(() => "") };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
