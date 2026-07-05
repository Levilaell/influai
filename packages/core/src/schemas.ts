// Fonte única de validação: usada nas server actions, no worker e (a versão
// JSON Schema) no structured output do Claude.
import { z } from "zod";

export const shotSchema = z.object({
  visual_prompt: z.string().min(10),
  dialogue: z.string().min(3).max(200), // ~20 palavras => estimativa de duração confiável
  camera: z.enum(["close-up", "medium shot", "wide shot", "over-the-shoulder", "selfie angle"]),
});

export const scriptSchema = z.object({
  title: z.string().min(3).max(120),
  hook: z.string().min(3).max(220),
  narration: z.string().min(10),
  shots: z.array(shotSchema).min(2).max(20), // até 20 p/ vídeos longos multi-segmento
  hashtags: z.array(z.string()).max(15),
});
export type Script = z.infer<typeof scriptSchema>;

// Versão JSON Schema para output_config.format do Claude (mantida à mão —
// idêntica à validada no protótipo).
export const SCRIPT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título curto do vídeo" },
    hook: { type: "string", description: "Frase de abertura (primeiros 2s) que prende atenção" },
    narration: { type: "string", description: "Narração completa em PT-BR, tom conversacional" },
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          visual_prompt: {
            type: "string",
            description:
              "Prompt visual em inglês para o gerador de imagem/vídeo. Descreve cena, enquadramento, luz e ação da personagem. NÃO descreve o rosto (vem das referências).",
          },
          dialogue: {
            type: "string",
            description: "Fala da personagem nesta cena, em PT-BR (1-2 frases curtas, máx ~20 palavras)",
          },
          camera: {
            type: "string",
            enum: ["close-up", "medium shot", "wide shot", "over-the-shoulder", "selfie angle"],
          },
        },
        required: ["visual_prompt", "dialogue", "camera"],
        additionalProperties: false,
      },
    },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["title", "hook", "narration", "shots", "hashtags"],
  additionalProperties: false,
} as const;

export const registerInput = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha precisa de pelo menos 8 caracteres"),
  displayName: z.string().min(2).max(60),
});

export const createPersonaInput = z.object({
  name: z.string().min(2).max(40),
  description: z.string().min(15, "Descreva a aparência com mais detalhe (em inglês)").max(500),
  niche: z.string().min(3).max(80),
  voiceId: z.string().min(3),
});

export const generateScriptInput = z.object({
  personaId: z.string().uuid(),
  topic: z.string().min(5).max(1200), // ideias do motor podem ser temas detalhados
  shots: z.number().int().min(2).max(20).default(4),
});

export const moderationResult = z.object({
  allowed: z.boolean(),
  category: z.enum(["ok", "real_person", "celebrity", "minor", "nsfw", "other"]),
  reason: z.string(),
});
export type ModerationResult = z.infer<typeof moderationResult>;

export const MODERATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    allowed: { type: "boolean" },
    category: { type: "string", enum: ["ok", "real_person", "celebrity", "minor", "nsfw", "other"] },
    reason: { type: "string", description: "Motivo curto em PT-BR, exibível ao usuário" },
  },
  required: ["allowed", "category", "reason"],
  additionalProperties: false,
} as const;
