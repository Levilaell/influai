// ElevenLabs TTS direto (conta própria) — voz fixa da persona, PT-BR nativo.
// A fala é DETERMINÍSTICA: lê exatamente o roteiro (nunca inventa palavra).
// Usa o endpoint /with-timestamps para obter o alinhamento por caractere,
// que vira legendas sincronizadas palavra a palavra (estilo dopaminérgico).
import fs from "node:fs";
import { env } from "../env.ts";
import { VOICES } from "../config.ts";

export function resolveVoiceId(voice: string): string {
  return VOICES[voice?.toLowerCase()] ?? (voice?.length === 20 ? voice : VOICES.matilda);
}

export type Alignment = {
  chars: string[];
  starts: number[]; // segundos
  ends: number[];
};

// Fala ~10% mais rápida (ritmo de creator; vídeo mais enxuto e take ~9% mais barato).
// Range aceito pela ElevenLabs: 0.7–1.2. Os timestamps já vêm do áudio acelerado,
// então legendas e lip-sync continuam perfeitamente sincronizados.
const TTS_SPEED = Math.min(1.2, Math.max(0.7, Number(process.env.ELEVENLABS_SPEED ?? "1.1")));

/**
 * Gera narração mp3 em outFile e retorna o alinhamento por caractere (se disponível).
 * Tenta /with-timestamps (eleven_v3 → multilingual_v2); se falhar, cai no endpoint
 * simples sem timestamps (legendas voltam ao modo proporcional).
 */
export async function elevenLabsTTS(opts: {
  text: string;
  voice: string;
  outFile: string;
}): Promise<{ alignment: Alignment | null }> {
  const voiceId = resolveVoiceId(opts.voice);
  const key = env("ELEVENLABS_API_KEY");

  const withTimestamps = async (modelId: string): Promise<Alignment | null> => {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: opts.text,
          model_id: modelId,
          language_code: "pt",
          voice_settings: { speed: TTS_SPEED },
        }),
      }
    );
    if (!res.ok) throw new Error(`ElevenLabs ${modelId} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json: any = await res.json();
    fs.writeFileSync(opts.outFile, Buffer.from(json.audio_base64, "base64"));
    const a = json.normalized_alignment ?? json.alignment;
    if (!a?.characters) return null;
    return {
      chars: a.characters,
      starts: a.character_start_times_seconds,
      ends: a.character_end_times_seconds,
    };
  };

  const plain = async (modelId: string): Promise<null> => {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: opts.text,
          model_id: modelId,
          language_code: "pt",
          voice_settings: { speed: TTS_SPEED },
        }),
      }
    );
    if (!res.ok) throw new Error(`ElevenLabs ${modelId} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    fs.writeFileSync(opts.outFile, Buffer.from(await res.arrayBuffer()));
    return null;
  };

  // MODELO FIXO (consistência é a promessa nº 1 do produto): o fallback silencioso
  // v3→v2 fazia a MESMA voz soar diferente entre teaser/vídeo/prévia (o v3 ainda tem
  // alta variação entre gerações). multilingual_v2 = estável e o que gerou as prévias.
  const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";
  try {
    return { alignment: await withTimestamps(MODEL) };
  } catch {
    await plain(MODEL); // mesmo modelo, sem timestamps (legendas caem no proporcional)
  }
  return { alignment: null };
}

/**
 * Agrupa o alinhamento por caractere em "chunks" curtos de legenda (2-3 palavras),
 * cada um com início/fim — para legendas rápidas e sincronizadas com a fala.
 */
export function captionChunks(alignment: Alignment, maxCharsPerChunk = 16): { text: string; start: number; end: number }[] {
  // 1. reconstrói palavras a partir dos caracteres
  type Word = { text: string; start: number; end: number };
  const words: Word[] = [];
  let cur = "";
  let curStart = 0;
  for (let i = 0; i < alignment.chars.length; i++) {
    const ch = alignment.chars[i];
    if (/\s/.test(ch)) {
      if (cur) words.push({ text: cur, start: curStart, end: alignment.ends[i - 1] ?? alignment.starts[i] });
      cur = "";
    } else {
      if (!cur) curStart = alignment.starts[i];
      cur += ch;
    }
  }
  if (cur) words.push({ text: cur, start: curStart, end: alignment.ends[alignment.ends.length - 1] });

  // 2. agrupa em chunks curtos (2-3 palavras), quebrando em fim de frase
  const chunks: { text: string; start: number; end: number }[] = [];
  let group: Word[] = [];
  const flush = () => {
    if (!group.length) return;
    // limpa pontuação solta nas bordas do chunk (ex: vírgula perdida no início)
    const text = group.map((w) => w.text).join(" ").replace(/^[\s,.;:!?-]+/, "").trim();
    if (text) {
      chunks.push({ text, start: group[0].start, end: group[group.length - 1].end });
    }
    group = [];
  };
  for (const w of words) {
    const projected = [...group, w].map((x) => x.text).join(" ");
    if (group.length >= 3 || (group.length >= 2 && projected.length > maxCharsPerChunk)) flush();
    group.push(w);
    // fim de frase (. ! ? :) => corta aqui pra não misturar frases
    if (/[.!?:]$/.test(w.text)) flush();
  }
  flush();
  return chunks;
}
