// B-roll: um corte curto de imagem em movimento sobre a fala. O Claude escolhe o
// momento mais ilustrativo do roteiro e descreve a cena (sem pessoas); geramos um
// still (nano-banana) e animamos (wan-2.2 i2v) — tudo na WaveSpeed, nada no Atlas.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CLAUDE_MODEL } from "../config.ts";
import { downloadToBuffer } from "../providers/atlas.ts";
import { wavespeedImage, wavespeedVideoFromImage } from "../providers/wavespeed.ts";
import type { Script } from "../schemas.ts";
import "../env.ts";

const SYSTEM = `Você escolhe UM momento de um roteiro de vídeo curto para inserir um corte de B-roll (imagem em movimento ilustrativa, SEM pessoas ou rostos). Escolha o bloco de fala mais visual/concreto. Descreva a cena de B-roll em INGLÊS, cinematográfica, close em objeto/detalhe do tema, vertical 9:16 — ex: "close-up of a passion fruit tart, glossy filling slowly dripping, warm cinematic light". Retorne o índice do shot (base 0) e o prompt.`;

const SCHEMA = {
  type: "object",
  properties: {
    shot_index: { type: "integer", description: "Índice do shot (base 0) onde entra o B-roll" },
    prompt: { type: "string", description: "Descrição da cena de B-roll em inglês, sem pessoas" },
  },
  required: ["shot_index", "prompt"],
  additionalProperties: false,
} as const;

export async function suggestBroll(script: Script): Promise<{ shotIndex: number; prompt: string }> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      { role: "user", content: `Roteiro:\n${JSON.stringify(script.shots.map((s, i) => ({ i, dialogue: s.dialogue, visual: s.visual_prompt })), null, 2)}\n\nEscolha o momento e o B-roll.` },
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  } as any);
  const out = (response.content as any[]).find((b) => b.type === "text")?.text;
  if (!out) throw new Error("B-roll sem sugestão");
  const parsed = z.object({ shot_index: z.number().int(), prompt: z.string() }).parse(JSON.parse(out));
  const shotIndex = Math.max(0, Math.min(script.shots.length - 1, parsed.shot_index));
  return { shotIndex, prompt: parsed.prompt };
}

/** Gera o clipe de B-roll: still (nano-banana) -> animação (veo). Retorna o mp4. */
export async function generateBrollClip(prompt: string, onPoll?: () => void): Promise<Buffer> {
  // "No text/letters/signage" evita o texto-lixo alucinado que os modelos costumam
  // queimar em rótulos/placas (aparecia como símbolos estranhos no vídeo).
  const noText = "No people, no faces, no text, no letters, no words, no signage, no watermark, no captions.";
  const stillUrl = await wavespeedImage({ prompt: `${prompt}. Photorealistic, vertical 9:16, cinematic lighting, high detail. ${noText}`, onPoll });
  const clipUrl = await wavespeedVideoFromImage({
    imageUrl: stillUrl,
    prompt: `${prompt}. Subtle cinematic motion, smooth camera move, shallow depth of field. ${noText}`,
    onPoll,
  });
  return downloadToBuffer(clipUrl);
}
