// Fala do TEASER de boas-vindas (~8s): a persona se apresenta ao DONO do negócio.
// É o "aha" do funil — rosto + voz + o negócio DELE em vídeo real, antes do paywall.
// Não é conteúdo postável (mensagem pro dono), então não canibaliza o produto pago.
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "../config.ts";
import "../env.ts";

const SYSTEM = `Você escreve UMA fala curta de apresentação de um influenciador de IA falando DIRETO COM O DONO do negócio (não com a audiência dele).
Regras:
- MÁXIMO 22 palavras (vira um vídeo de ~8 segundos).
- Estrutura: saudação + "eu sou {nome}, seu/sua nova influenciadora" + referência ESPECÍFICA ao negócio + convite pra gravar o primeiro vídeo.
- Tom caloroso e confiante, português brasileiro natural, pontuação completa (a fala é lida por voz sintética).
- SEM aspas, parênteses, emojis ou símbolos. Acentuação correta e completa.
- Gênero das palavras coerente com o gênero informado (influenciador/influenciadora, pronto/pronta).`;

const SCHEMA = {
  type: "object",
  properties: { line: { type: "string", description: "A fala, máx ~22 palavras, TTS-safe" } },
  required: ["line"],
  additionalProperties: false,
} as const;

export async function generateTeaserLine(opts: {
  personaName: string;
  niche: string;
  gender: "masculina" | "feminina";
  tagline?: string;
}): Promise<string> {
  const fallback =
    opts.gender === "masculina"
      ? `Oi! Eu sou ${opts.personaName}, seu novo influenciador. Já tenho ideias de vídeo prontas pro seu negócio. Bora gravar a primeira?`
      : `Oi! Eu sou ${opts.personaName}, sua nova influenciadora. Já tenho ideias de vídeo prontas pro seu negócio. Bora gravar a primeira?`;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Influenciador: ${opts.personaName} (voz ${opts.gender})${opts.tagline ? ` — bordão: ${opts.tagline}` : ""}\nNegócio do dono: ${opts.niche}\n\nEscreva a fala.`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    } as any);
    const text = (response.content as any[]).find((b) => b.type === "text")?.text;
    const line = text ? String(JSON.parse(text).line ?? "").trim() : "";
    // Guarda-corpo: sem aspas/símbolos e tamanho sensato, senão usa o fallback
    if (line.length >= 20 && line.length <= 190 && !/["()\[\]{}*#@]/.test(line)) return line;
    return fallback;
  } catch {
    return fallback;
  }
}
