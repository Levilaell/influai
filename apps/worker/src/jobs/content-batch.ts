// Job "content-batch": gera N ideias variadas (memória antirrepetição) + N
// roteiros em paralelo e insere como rascunhos, atualizando o progresso. Roda em
// background (sem risco de timeout de request).
import type PgBoss from "pg-boss";
import { getPool } from "@influa/core/db/client";
import { generateScript } from "@influa/core/pipeline/script";
import { objectiveGuide, objectiveIdeaHint } from "@influa/core/pipeline/format";
import { generateIdeas, brandProfileFromPersona } from "@influa/core/brand/index";
import { getBrandMemory, memoryForPrompt } from "@influa/core/brand/memory";

export function registerContentBatch(boss: PgBoss) {
  return (async () => {
    await boss.createQueue("content-batch");
    await boss.work("content-batch", { batchSize: 1 }, async ([job]) => {
      const { batchId, brandId, personaId, count, shots, segments, lengthGuide, style, objective } = (job.data as any) ?? {};
      const pool = getPool();
      try {
        const { rows: pr } = await pool.query(
          "select * from personas where id = $1 and brand_id = $2 and status = 'ready'",
          [personaId, brandId]
        );
        const persona = pr[0];
        if (!persona) throw new Error("Persona não está pronta");

        const { rows: bp } = await pool.query("select * from brand_profiles where brand_id = $1", [brandId]);
        const profile = bp[0]
          ? {
              business: bp[0].business, audience: bp[0].audience, value_proposition: bp[0].value_proposition,
              tone: bp[0].tone, niche: bp[0].niche, content_pillars: bp[0].content_pillars,
              products: bp[0].products, confidence: bp[0].confidence, notes: bp[0].notes,
            }
          : brandProfileFromPersona(persona);
        const memory = memoryForPrompt(await getBrandMemory(brandId));

        const ideas = (await generateIdeas(profile, count, memory || undefined, objectiveIdeaHint(objective))).slice(0, count);

        // roteiros em paralelo; insere e incrementa o progresso conforme cada um fica pronto
        await Promise.all(
          ideas.map(async (idea) => {
            const script = await generateScript({
              personaName: persona.name, personaDescription: persona.description, niche: persona.niche,
              topic: idea.topic, shots,
              objectiveGuide: objectiveGuide(objective),
              formatGuide: lengthGuide, // duração; o objetivo já define a estrutura
              memoryContext: memory || undefined,
            });
            await pool.query(
              `insert into videos (user_id, brand_id, persona_id, topic, script, status, style, segments)
               values ($1, $2, $3, $4, $5, 'draft', $6, $7)`,
              [persona.user_id, brandId, personaId, idea.topic, JSON.stringify(script), JSON.stringify(style), segments || 1]
            );
            await pool.query("update content_batches set created = created + 1 where id = $1", [batchId]);
          })
        );
        await pool.query("update content_batches set status = 'done' where id = $1", [batchId]);
        console.log(`[content-batch] ✔ ${batchId}: ${ideas.length} rascunhos`);
      } catch (err) {
        await pool.query("update content_batches set status = 'error', error = $2 where id = $1", [
          batchId, String((err as Error).message).slice(0, 300),
        ]);
        console.warn(`[content-batch] ✗ ${batchId}: ${(err as Error).message}`);
      }
    });
  })();
}
