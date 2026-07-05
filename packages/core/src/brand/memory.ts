// Memória Operacional da Marca — acompanha cada operação para evitar falha de
// contexto e repetição, e acumular aprendizado. Vive no nível MARCA (compartilhada
// por todas as personas da marca). Lida em toda geração e atualizada após cada vídeo.
import { getPool } from "../db/client.ts";

export type CoveredTopic = { topic: string; video_id?: string; at: string };
export type BrandMemory = {
  covered_topics: CoveredTopic[];
  learnings: string[];
  style_guide: string;
};

export async function getBrandMemory(brandId: string): Promise<BrandMemory> {
  const { rows } = await getPool().query(
    "select covered_topics, learnings, style_guide from brand_memory where brand_id = $1",
    [brandId]
  );
  const r = rows[0];
  if (!r) return { covered_topics: [], learnings: [], style_guide: "" };
  return { covered_topics: r.covered_topics ?? [], learnings: r.learnings ?? [], style_guide: r.style_guide ?? "" };
}

/** Garante que a linha de memória existe (marcas antigas / criadas fora do fluxo). */
export async function ensureBrandMemory(brandId: string): Promise<void> {
  await getPool().query(
    "insert into brand_memory (brand_id) values ($1) on conflict (brand_id) do nothing",
    [brandId]
  );
}

/** Registra um tema coberto (dedup + aprendizado). Chamado quando o vídeo fica pronto. */
export async function addCoveredTopic(brandId: string, topic: string, videoId?: string): Promise<void> {
  await ensureBrandMemory(brandId);
  const entry: CoveredTopic = { topic, video_id: videoId, at: new Date().toISOString() };
  await getPool().query(
    `update brand_memory
       set covered_topics = (
         -- mantém no máximo os 100 temas mais recentes
         select coalesce(jsonb_agg(t), '[]'::jsonb)
         from (
           select t from jsonb_array_elements(covered_topics || $2::jsonb) t
           order by (t->>'at') desc limit 100
         ) x
       )
     where brand_id = $1`,
    [brandId, JSON.stringify([entry])]
  );
}

/** Formata a memória para injeção no prompt de geração (temas a evitar + estilo). */
export function memoryForPrompt(mem: BrandMemory): string {
  const parts: string[] = [];
  if (mem.covered_topics.length) {
    const recent = mem.covered_topics.slice(0, 25).map((t) => `- ${t.topic}`).join("\n");
    parts.push(`TEMAS JÁ COBERTOS por esta marca (NÃO repita nem faça variações óbvias destes):\n${recent}`);
  }
  if (mem.learnings.length) {
    parts.push(`APRENDIZADOS do que funciona nesta marca:\n${mem.learnings.map((l) => `- ${l}`).join("\n")}`);
  }
  if (mem.style_guide.trim()) {
    parts.push(`GUIA DE ESTILO da marca:\n${mem.style_guide.trim()}`);
  }
  return parts.join("\n\n");
}
