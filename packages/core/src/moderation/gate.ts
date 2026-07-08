// Gate de moderação — roda ANTES de gastar créditos.
// Maior risco jurídico do produto no Brasil: pessoa real/celebridade (direito
// de imagem + LGPD), menores e NSFW.
import Anthropic from "@anthropic-ai/sdk";
import { MODERATION_MODEL } from "../config.ts";
import { moderationResult, MODERATION_JSON_SCHEMA, type ModerationResult } from "../schemas.ts";
import "../env.ts";

const SYSTEM = `Você é o gate de moderação de uma plataforma de influenciadores 100% SINTÉTICOS.
Analise o texto e responda se é permitido. Bloqueie quando o texto:
- descreve, nomeia ou tenta replicar uma PESSOA REAL ou CELEBRIDADE (ator, cantor, político, influencer real, etc.) => category "real_person" ou "celebrity"
- descreve pessoa menor de idade ou com aparência infantil => "minor"
- contém conteúdo sexual/NSFW => "nsfw"
- promove golpe, fraude financeira explícita, ódio ou violência => "other"
- PROMESSA PERIGOSA (só quando for o roteiro): garante lucro/enriquecimento ("fique rico", "renda garantida", retorno específico garantido), recomenda golpe financeiro, promete CURA de doença, ou dá dosagem/prescrição médica específica como certeza => "other". Educação geral (finanças/saúde) com linguagem cuidadosa é PERMITIDA — bloqueie só a promessa/garantia enganosa ou a prescrição perigosa.
Caso contrário => allowed=true, category "ok".
Descrições genéricas de aparência ("young brazilian woman, wavy brown hair") são PERMITIDAS — esse é o uso normal da plataforma. Seja permissivo com temas de conteúdo comuns (tecnologia, finanças pessoais, curiosidades, humor) e rígido com identidade de pessoas reais e com promessas enganosas.
O campo reason deve ser curto, em PT-BR, e exibível ao usuário final.`;

export async function moderate(text: string, context: "persona" | "roteiro"): Promise<ModerationResult> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODERATION_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content: `Contexto: ${context}\n\nTexto a moderar:\n${text}` }],
    output_config: { format: { type: "json_schema", schema: MODERATION_JSON_SCHEMA } },
  } as any);
  const out = response.content.find((b) => b.type === "text")?.text;
  if (!out) throw new Error("Moderação sem resposta");
  return moderationResult.parse(JSON.parse(out));
}
