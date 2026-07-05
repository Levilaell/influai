// Estágio 1 — Roteiro + shot list.
// Primário: Claude via Anthropic API (structured output garantido).
// Fallback: LLM do Atlas Cloud (OpenAI-compatible, json_object) quando não há
// ANTHROPIC_API_KEY — útil para testar tudo com créditos do Atlas.
import { atlasChat } from "../lib/providers.js";
import { PROVIDER } from "../config.js";

const SCRIPT_SCHEMA = {
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
            description: "Prompt visual em inglês para o gerador de imagem/vídeo. Descreve cena, enquadramento, luz e ação da personagem. NÃO descreve o rosto (vem das referências).",
          },
          dialogue: {
            type: "string",
            description: "Fala da personagem nesta cena, em PT-BR (1-2 frases curtas)",
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
};

const SYSTEM = `Você é roteirista de vídeos curtos virais (TikTok/Reels/Shorts) em português brasileiro.
Regras:
- O hook abre o vídeo e precisa gerar curiosidade imediata (pergunta, afirmação polêmica ou promessa).
- Cada shot dura ~8 segundos; a fala (dialogue) de cada shot deve caber confortavelmente nesse tempo (máx ~20 palavras).
- A personagem fala direto com a câmera na maioria dos shots (estilo creator).
- visual_prompt sempre em inglês, cinematográfico, vertical 9:16, e coerente de um shot para o outro (mesma roupa, mesmo cenário base, continuidade de luz).
- O último shot fecha com CTA sutil (seguir/comentar).`;

export async function generateScript({ persona, topic, shots }) {
  const userPrompt = `Persona: ${persona.name} — ${persona.description}
Nicho: ${persona.niche}
Tema do vídeo: ${topic}
Número de shots: exatamente ${shots}.

Gere o roteiro completo.`;

  let script;
  if (process.env.ANTHROPIC_API_KEY) {
    script = await viaAnthropic(userPrompt);
  } else if (PROVIDER === "atlas" && process.env.ATLAS_API_KEY) {
    console.log("  (sem ANTHROPIC_API_KEY — roteiro via LLM do Atlas Cloud)");
    script = await viaAtlas(userPrompt);
  } else {
    throw new Error("Defina ANTHROPIC_API_KEY (ou use PROVIDER=atlas com ATLAS_API_KEY) para gerar o roteiro.");
  }

  if (script.shots.length !== shots) {
    console.warn(`⚠ Pedi ${shots} shots, recebi ${script.shots.length}. Seguindo com o que veio.`);
  }
  return script;
}

async function viaAnthropic(userPrompt) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema: SCRIPT_SCHEMA } },
  });
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`Roteiro vazio (stop_reason: ${response.stop_reason})`);
  return JSON.parse(text);
}

async function viaAtlas(userPrompt) {
  const schemaNote = `\n\nResponda SOMENTE com um JSON válido seguindo exatamente este JSON Schema (sem markdown, sem comentários):\n${JSON.stringify(SCRIPT_SCHEMA)}`;
  const raw = await atlasChat({ system: SYSTEM + schemaNote, user: userPrompt });
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM do Atlas não retornou JSON válido. Início da resposta: ${cleaned.slice(0, 200)}`);
  }
}
