// Cérebro da Marca — captura contexto do negócio UMA vez, por qualquer entrada
// (print de perfil, texto colado, ou descrição livre), e produz um Perfil da
// Marca estruturado que alimenta o motor de ideias e o gerador de roteiro.
// Caminho "C": Claude multimodal lê imagem OU texto — sem scraping, qualquer rede.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { stripEmojis } from "../text.ts";
import "../env.ts";

export const brandProfileSchema = z.object({
  business: z.string().describe("O que a marca vende ou faz, em uma frase"),
  audience: z.string().describe("Público-alvo principal"),
  value_proposition: z.string().describe("Proposta de valor / principais diferenciais"),
  tone: z.string().describe("Tom de voz do conteúdo (ex: descontraído e educativo)"),
  niche: z.string().describe("Nicho de conteúdo"),
  content_pillars: z.array(z.string()).min(3).max(6).describe("Temas recorrentes de conteúdo"),
  products: z.array(z.string()).max(8).describe("Produtos/serviços específicos mencionados"),
  confidence: z.enum(["alta", "média", "baixa"]).describe("Confiança na extração dado o material"),
  notes: z.string().describe("O que faltou ou o que confirmar com o usuário, em PT-BR"),
});
export type BrandProfile = z.infer<typeof brandProfileSchema>;

const BRAND_JSON_SCHEMA = {
  type: "object",
  properties: {
    business: { type: "string", description: "O que a marca vende ou faz, em uma frase" },
    audience: { type: "string", description: "Público-alvo principal" },
    value_proposition: { type: "string", description: "Proposta de valor / diferenciais" },
    tone: { type: "string", description: "Tom de voz do conteúdo" },
    niche: { type: "string", description: "Nicho de conteúdo" },
    content_pillars: { type: "array", items: { type: "string" }, description: "3-6 temas recorrentes" },
    products: { type: "array", items: { type: "string" }, description: "Produtos/serviços específicos" },
    confidence: { type: "string", enum: ["alta", "média", "baixa"] },
    notes: { type: "string", description: "O que faltou / confirmar com o usuário, em PT-BR" },
  },
  required: ["business", "audience", "value_proposition", "tone", "niche", "content_pillars", "products", "confidence", "notes"],
  additionalProperties: false,
} as const;

const EXTRACT_SYSTEM = `Você analisa o material que um criador fornece sobre o próprio negócio (print de perfil de rede social, bio + legendas coladas, link de site já convertido em texto, ou descrição livre) e extrai um Perfil da Marca para orientar a criação de conteúdo em vídeo curto.
Seja concreto e fiel ao material — não invente produtos que não aparecem. Se o material for pobre, marque confidence "baixa" e diga em notes o que confirmar. Tudo em português brasileiro, exceto nomes próprios.`;

type ImageInput = { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" };

/** Extrai o Perfil da Marca de imagem (print) e/ou texto (bio, legendas, descrição). */
export async function extractBrandProfile(input: {
  image?: ImageInput;
  text?: string;
}): Promise<BrandProfile> {
  if (!input.image && !input.text) throw new Error("Forneça uma imagem (print) ou texto");
  const client = new Anthropic();

  const content: any[] = [];
  if (input.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 },
    });
  }
  content.push({
    type: "text",
    text: input.text
      ? `Material fornecido pelo usuário:\n\n${input.text}\n\nExtraia o Perfil da Marca.`
      : "Este é um print do perfil do usuário. Leia a bio, o conteúdo visível e a estética, e extraia o Perfil da Marca.",
  });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: BRAND_JSON_SCHEMA } },
  } as any);

  const out = (response.content as any[]).find((b) => b.type === "text")?.text;
  if (!out) throw new Error("Extração sem resposta");
  return brandProfileSchema.parse(JSON.parse(out));
}

// ── Motor de ideias ──────────────────────────────────────────────────
export const videoIdeaSchema = z.object({
  title: z.string().describe("Título curto e chamativo da ideia"),
  hook: z.string().describe("Frase de abertura (primeiros 2s)"),
  format: z.string().describe("Formato viral (ex: listicle, mito x verdade, storytime, erro comum)"),
  angle: z.string().describe("Por que essa ideia conversa com o público desta marca"),
  topic: z.string().describe("Tema pronto para virar roteiro (alimenta generateScript)"),
});
export type VideoIdea = z.infer<typeof videoIdeaSchema>;

const IDEAS_JSON_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          format: { type: "string" },
          angle: { type: "string" },
          topic: { type: "string", description: "Tema pronto para virar roteiro" },
        },
        required: ["title", "hook", "format", "angle", "topic"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
} as const;

const IDEAS_SYSTEM = `Você é estrategista de conteúdo viral para vídeos curtos (Reels/TikTok/Shorts) em português brasileiro.
A partir do Perfil da Marca, proponha ideias de vídeo variadas em formato e ângulo, cada uma pronta para um influenciador de IA gravar como talking head. Use formatos comprovados (listicle, mito x verdade, erro comum, storytime, bastidores, comparação, tutorial rápido). O campo "topic" deve ser autoexplicativo o suficiente para virar roteiro sozinho.
NUNCA use emojis em nenhum campo.
ACENTUAÇÃO CORRETA E COMPLETA: use todos os acentos do português (você, não, São, é, prática...) — nunca escreva sem acento (voce, nao, Sao).`;

/** Perfil mínimo a partir só da persona (quando ainda não há Cérebro da Marca). */
export function brandProfileFromPersona(p: {
  description: string;
  niche: string | null;
}): BrandProfile {
  return {
    business: p.niche ? `Criador de conteúdo no nicho de ${p.niche}` : "Criador de conteúdo",
    audience: "Público interessado no nicho",
    value_proposition: "Conteúdo educativo e de entretenimento",
    tone: "Descontraído e informativo",
    niche: p.niche ?? "geral",
    content_pillars: ["Dicas rápidas", "Curiosidades", "Mitos e verdades", "Bastidores"],
    products: [],
    confidence: "baixa",
    notes: "Perfil derivado só do nicho da persona — conecte o Cérebro da Marca para ideias mais afiadas.",
  };
}

/** Gera N ideias de vídeo a partir do Perfil da Marca. Cada ideia vira um tema pronto. */
export async function generateIdeas(profile: BrandProfile, n = 6, memoryContext?: string, objectiveHint?: string): Promise<VideoIdea[]> {
  const client = new Anthropic();
  const memoryBlock = memoryContext ? `\n\n${memoryContext}` : "";
  const objectiveBlock = objectiveHint ? `\n\nOBJETIVO das ideias: ${objectiveHint}` : "";
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: IDEAS_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Perfil da Marca:\n${JSON.stringify(profile, null, 2)}${memoryBlock}${objectiveBlock}\n\nGere exatamente ${n} ideias de vídeo.`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: IDEAS_JSON_SCHEMA } },
  } as any);

  const out = (response.content as any[]).find((b) => b.type === "text")?.text;
  if (!out) throw new Error("Ideias sem resposta");
  const ideas = z.object({ ideas: z.array(videoIdeaSchema) }).parse(JSON.parse(out)).ideas;
  return ideas.map((i) => ({
    title: stripEmojis(i.title),
    hook: stripEmojis(i.hook),
    format: stripEmojis(i.format),
    angle: stripEmojis(i.angle),
    topic: stripEmojis(i.topic),
  }));
}

// ── Cenários específicos da marca ────────────────────────────────────────
export type BrandScene = { label: string; prompt: string };

const SCENES_SYSTEM = `Você sugere CENÁRIOS de gravação coerentes com a marca, para vídeos de talking head vertical.
Regras:
- Os cenários devem fazer sentido para o negócio/nicho (uma marca de finanças NÃO teria "academia"; uma cafeteria teria "balcão da cafeteria", "mesa com xícara ao lado", etc).
- 5 cenários variados mas plausíveis para a marca.
- "label" curto em português (o que o usuário vê). "prompt" em INGLÊS, descrevendo o AMBIENTE/fundo (não a pessoa), pronto para um gerador de imagem (ex: "cozy specialty coffee shop counter, warm wood, plants softly blurred behind").
- NUNCA use emojis.`;

const SCENES_JSON_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Nome curto do cenário em PT-BR" },
          prompt: { type: "string", description: "Descrição do ambiente em inglês para o gerador de imagem" },
        },
        required: ["label", "prompt"],
        additionalProperties: false,
      },
    },
  },
  required: ["scenes"],
  additionalProperties: false,
} as const;

/** Gera cenários de gravação sob medida para a marca (a partir do Perfil). */
export async function generateBrandScenes(profile: BrandProfile, n = 5): Promise<BrandScene[]> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SCENES_SYSTEM,
    messages: [
      { role: "user", content: `Perfil da Marca:\n${JSON.stringify(profile, null, 2)}\n\nSugira exatamente ${n} cenários.` },
    ],
    output_config: { format: { type: "json_schema", schema: SCENES_JSON_SCHEMA } },
  } as any);
  const out = (response.content as any[]).find((b) => b.type === "text")?.text;
  if (!out) throw new Error("Cenários sem resposta");
  const scenes = z
    .object({ scenes: z.array(z.object({ label: z.string(), prompt: z.string() })) })
    .parse(JSON.parse(out)).scenes;
  return scenes.map((s) => ({ label: stripEmojis(s.label), prompt: s.prompt })).slice(0, n);
}
