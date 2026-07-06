// Prévia instantânea da landing (sem login): a partir do NICHO do visitante,
// gera persona + 5 ideias + 1 roteiro numa ÚNICA chamada Claude (rápido e barato).
// É a isca: a pessoa vê o "cérebro" trabalhando pro negócio dela antes de dar o email.
import Anthropic from "@anthropic-ai/sdk";
import "../env.ts";

export type PreviewPersona = { name: string; tagline: string; look: string; gender: "masculina" | "feminina" };
export type PreviewIdea = { title: string; hook: string };
export type PreviewScript = { title: string; lines: string[]; hashtags: string[] };
export type Preview = { niche: string; persona: PreviewPersona; ideas: PreviewIdea[]; script: PreviewScript };

const SYSTEM = `Você é estrategista de conteúdo viral (Reels/TikTok/Shorts) em português brasileiro. A partir do NICHO/negócio informado, você cria a "máquina de conteúdo" que um influenciador de IA rodaria para esse negócio.
Regras:
- Tudo específico e afiado para o nicho — nada genérico. Fale a língua do dono desse negócio.
- persona: um influenciador de IA que faria sentido para essa marca (name = nome brasileiro; tagline = bordão/posicionamento em 1 linha; look = descrição visual curta em português: idade aproximada, estilo, ambiente; gender = "masculina" ou "feminina", COERENTE com o name e o look — isso define a voz do vídeo).
- ideas: 5 ideias de vídeo com título chamativo + hook (frase de abertura dos 2 primeiros segundos). Use formatos comprovados (mito x verdade, erro comum, listicle, bastidores, comparação).
- script: 1 roteiro pronto (title + 4 falas curtas em "lines" + 4-6 hashtags sem #). Cada fala ~1 frase, com pontuação natural. A última fala é um CTA sutil.
- NUNCA use emojis. Acentuação correta e completa (você, não, São, é — nunca voce/nao/Sao).`;

const SCHEMA = {
  type: "object",
  properties: {
    persona: {
      type: "object",
      properties: { name: { type: "string" }, tagline: { type: "string" }, look: { type: "string" }, gender: { type: "string", enum: ["masculina", "feminina"] } },
      required: ["name", "tagline", "look", "gender"], additionalProperties: false,
    },
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, hook: { type: "string" } },
        required: ["title", "hook"], additionalProperties: false,
      },
    },
    script: {
      type: "object",
      properties: {
        title: { type: "string" },
        lines: { type: "array", items: { type: "string" } },
        hashtags: { type: "array", items: { type: "string" } },
      },
      required: ["title", "lines", "hashtags"], additionalProperties: false,
    },
  },
  required: ["persona", "ideas", "script"], additionalProperties: false,
} as const;

export async function generatePreview(niche: string): Promise<Preview> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Nicho/negócio: ${niche.slice(0, 120)}\n\nMonte a máquina de conteúdo (persona + 5 ideias + 1 roteiro).` }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  } as any);
  const out = (response.content as any[]).find((b) => b.type === "text")?.text;
  if (!out) throw new Error("Prévia sem resposta");
  const p = JSON.parse(out);
  return {
    niche: niche.slice(0, 120),
    persona: p.persona,
    ideas: (p.ideas ?? []).slice(0, 5),
    script: { title: p.script.title, lines: (p.script.lines ?? []).slice(0, 6), hashtags: (p.script.hashtags ?? []).slice(0, 6) },
  };
}
