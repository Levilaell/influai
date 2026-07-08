// Roteiro viral via Claude (structured output) — porte de prototype/stages/script.js
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "../config.ts";
import { scriptSchema, SCRIPT_JSON_SCHEMA, type Script } from "../schemas.ts";
import { stripEmojis, normalizeHashtags } from "../text.ts";
import "../env.ts";

const SYSTEM = `Você é roteirista de vídeos curtos virais (TikTok/Reels/Shorts) em português brasileiro.
Regras:
- O hook abre o vídeo e precisa gerar curiosidade imediata (pergunta, afirmação polêmica ou promessa).
- DURAÇÃO OBRIGATÓRIA: o vídeo inteiro tem entre ~22 e ~30 segundos. Cada shot dura ~6-8 segundos e a fala (dialogue) deve ter NO MÁXIMO ~16 palavras. A soma de TODAS as falas deve ficar entre ~300 e ~410 caracteres — dá pra desenvolver UMA ideia com começo, meio e fim, mas sem enrolação. Nunca passe de ~410 caracteres.
- OBJETIVO MANDA NO ÂNGULO: se o tema não conversar naturalmente com o objetivo do vídeo, adapte o ÂNGULO do tema para servir o objetivo (ex.: tema "bastidores da cafeteria" com objetivo de vender → bastidores que terminam mostrando o produto e um convite pra visitar/comprar). Nunca ignore o objetivo.
- A personagem fala direto com a câmera na maioria dos shots (estilo creator).
- NUNCA use emojis em nenhum campo — a fala é lida por voz sintética e emoji atrapalha.
- FALA 100% FALÁVEL (TTS): a voz sintética NÃO pronuncia aspas, parênteses ou símbolos — a frase perde o sentido. Ex.: 'comenta "quero" que eu separo um copo' vira "comenta, quero que eu separo um copo" (errado!). Escreva do jeito que se FALA: "comenta a palavra quero que eu separo um copo" ou "manda um QUERO nos comentários". Nunca use aspas, parênteses, barras ou abreviações não-faladas (use "por cento" em vez de %, se precisar) dentro de dialogue/hook.
- hashtags: sem o símbolo #, sem emoji, sem repetir, minúsculas.
- visual_prompt sempre em inglês, cinematográfico, vertical 9:16, e coerente de um shot para o outro (mesma roupa, mesmo cenário base, continuidade de luz). A persona é um talking head: o rosto fica visível e ela geralmente fala para a câmera. Gestos naturais e mostrar produtos (à altura do peito) são bem-vindos; só evite descrever poses extremas que estraguem o take (fechar os olhos por muito tempo, virar totalmente de costas, rosto escondido).
- O último shot fecha com CTA sutil (seguir/comentar).
- PONTUAÇÃO OBRIGATÓRIA: escreva as falas com pontuação natural e completa (vírgulas, pontos, interrogação, exclamação, reticências quando fizer sentido). A voz sintética depende da pontuação para pausas e entonação corretas — texto sem pontuação sai robótico e corrido. Ex: "Você sabia disso? Pois é. A maioria das pessoas erra aqui, todo dia."
- ACENTUAÇÃO CORRETA E COMPLETA: use TODOS os acentos e sinais do português (á, à, â, ã, é, ê, í, ó, ô, õ, ú, ç). Escreva "você", "não", "São", "está", "é", "português" — NUNCA "voce", "nao", "Sao". Acentuação errada faz a voz pronunciar errado.

VERACIDADE (evitar conteúdo falso):
- NÃO invente estatísticas, porcentagens, números, datas ou estudos específicos. Só cite um número se for um fato amplamente conhecido e correto; na dúvida, fale de forma qualitativa ("a maioria", "costuma") em vez de cravar um dado.
- EVITE absolutos ("sempre", "nunca", "garantido", "todo mundo"); prefira "costuma", "na maioria dos casos", "tende a".
- Não prometa resultados garantidos. O conteúdo é educativo/opinativo, não promessa.`;

// Nichos sensíveis ganham regras extras (risco jurídico e de dano ao usuário).
const SENSITIVE = [
  { rx: /financ|invest|dinheiro|renda|cripto|bolsa|tesouro|poupan|juros|d[íi]vida|econom/i,
    rule: `NICHO FINANCEIRO: nunca prometa lucro/enriquecimento nem recomende investimento específico como garantia. Enquadre como educação financeira geral. Uma das falas deve lembrar que não é recomendação de investimento e que resultados variam.` },
  { rx: /sa[úu]de|dieta|emagre|nutri|treino|rem[ée]dio|suplement|m[ée]dic|doen[çc]a|ansiedad|depress/i,
    rule: `NICHO SAÚDE: não dê diagnóstico, dosagem ou prescrição. Nada de promessa de cura/resultado. Uma das falas deve orientar procurar um profissional de saúde.` },
  { rx: /jur[íi]dic|advog|direito|processo|imposto|tribut|contrat/i,
    rule: `NICHO JURÍDICO: não dê aconselhamento jurídico definitivo. Enquadre como informação geral e sugira consultar um profissional.` },
];

function sensitiveRules(niche: string | null, topic: string): string {
  const hay = `${niche ?? ""} ${topic}`;
  const hits = SENSITIVE.filter((s) => s.rx.test(hay)).map((s) => s.rule);
  return hits.length ? `\n\nATENÇÃO — regras deste nicho:\n${hits.join("\n")}` : "";
}

export async function generateScript(opts: {
  personaName: string;
  personaDescription: string;
  niche: string | null;
  topic: string;
  shots: number;
  objectiveGuide?: string; // objetivo do vídeo (engajar/vender/educar/entreter)
  formatGuide?: string; // formato (curto/educativo/anúncio)
  memoryContext?: string; // memória operacional da marca (temas cobertos, estilo)
}): Promise<Script> {
  const client = new Anthropic();
  const memoryBlock = opts.memoryContext ? `\n\n${opts.memoryContext}` : "";
  const intent = [opts.objectiveGuide, opts.formatGuide].filter(Boolean).join("\n");
  const system = SYSTEM + (intent ? `\n\n${intent}` : "") + sensitiveRules(opts.niche, opts.topic);
  // Params via `as any`: a API aceita thinking adaptive + output_config
  // (validado no smoke test), mas o SDK 0.39 ainda não os tipa.
  // Haiku 4.5 (e modelos < 4.6) não suportam adaptive thinking — só habilita onde é suportado.
  const supportsThinking = !/haiku|claude-3|claude-2/i.test(CLAUDE_MODEL);
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    ...(supportsThinking ? { thinking: { type: "adaptive" as const } } : {}),
    system,
    messages: [
      {
        role: "user",
        content: `Persona: ${opts.personaName} — ${opts.personaDescription}
Nicho: ${opts.niche ?? "geral"}
Tema do vídeo: ${opts.topic}
Número de shots: exatamente ${opts.shots}.${memoryBlock}

Gere o roteiro completo.`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: SCRIPT_JSON_SCHEMA } },
  } as any);

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error(`Roteiro vazio (stop_reason: ${response.stop_reason})`);
  const raw = scriptSchema.parse(JSON.parse(text));
  // Defesa: limpa emojis da fala/hook/narração e normaliza hashtags mesmo que o modelo escorregue
  return {
    ...raw,
    hook: stripEmojis(raw.hook),
    narration: stripEmojis(raw.narration),
    shots: raw.shots.map((s) => ({ ...s, dialogue: stripEmojis(s.dialogue) })),
    hashtags: normalizeHashtags(raw.hashtags),
  };
}
