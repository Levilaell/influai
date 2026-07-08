// Loop de aprendizado: olha os vídeos da marca + suas métricas reais e extrai o
// que funciona (hooks, formatos, temas), gravando em brand_memory.learnings.
// Esses learnings já entram no prompt de roteiro/ideias (memoryForPrompt) — fecha o loop.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CLAUDE_MODEL } from "../config.ts";
import { getPool } from "../db/client.ts";
import { stripEmojis } from "../text.ts";
import "../env.ts";

const SYSTEM = `Você é analista de performance de conteúdo curto. Recebe uma lista de vídeos de uma marca com título, tema, gancho e métricas (views, likes, comentários, salvamentos). Compare os que performaram melhor com os piores e extraia APRENDIZADOS acionáveis e específicos desta marca (ex: "ganchos em forma de pergunta tiveram mais retenção", "temas sobre X renderam mais salvamentos", "vídeos mais curtos performaram melhor"). Seja concreto e curto. Se os dados forem poucos, seja cauteloso e diga o que ainda falta observar. NUNCA use emojis.`;

const SCHEMA = {
  type: "object",
  properties: { learnings: { type: "array", items: { type: "string" }, description: "3 a 6 aprendizados curtos em PT-BR" } },
  required: ["learnings"],
  additionalProperties: false,
} as const;

export async function analyzeBrandLearnings(brandId: string): Promise<{ learnings: string[]; sample: number }> {
  const pool = getPool();
  // último snapshot de métricas por vídeo da marca
  const { rows } = await pool.query(
    `select v.script->>'title' as title, v.topic, v.script->>'hook' as hook,
            m.views, m.likes, m.comments, m.saves
     from videos v
     join lateral (
       select * from video_metrics vm where vm.video_id = v.id order by recorded_at desc limit 1
     ) m on true
     where v.brand_id = $1
     order by m.views desc
     limit 40`,
    [brandId]
  );
  if (rows.length < 2) {
    return { learnings: [], sample: rows.length };
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      { role: "user", content: `Vídeos da marca com desempenho:\n${JSON.stringify(rows, null, 2)}\n\nExtraia os aprendizados.` },
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  } as any);
  const out = (response.content as any[]).find((b) => b.type === "text")?.text;
  if (!out) throw new Error("Análise sem resposta");
  const learnings = z
    .object({ learnings: z.array(z.string()) })
    .parse(JSON.parse(out))
    .learnings.map(stripEmojis)
    .filter(Boolean)
    .slice(0, 6);

  await pool.query(
    `insert into brand_memory (brand_id, learnings) values ($1, $2)
     on conflict (brand_id) do update set learnings = $2`,
    [brandId, JSON.stringify(learnings)]
  );
  return { learnings, sample: rows.length };
}
