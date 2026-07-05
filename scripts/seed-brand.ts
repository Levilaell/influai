// Semeia um Cérebro da Marca na Bia + testa o motor de ideias pela camada real.
import "@influa/core/env";
import { getPool } from "@influa/core/db/client";
import { extractBrandProfile, generateIdeas } from "@influa/core/brand/index";

const pool = getPool();
const { rows } = await pool.query("select id, user_id from personas where slug='bia-teste'");
const { id: personaId, user_id: userId } = rows[0];

const text = `Bio: "Bia Investe 💰 | Educação financeira sem economês. Te ajudo a sair das dívidas e começar a investir com pouco. Planilha grátis no link."
Legendas top: "3 gastos invisíveis que sugam seu salário todo mês", "Comecei a investir com R$30 e olha no que deu", "Mito: investir é só pra rico. Bora quebrar isso."`;

console.log("▶ extraindo perfil...");
const profile = await extractBrandProfile({ text });
await pool.query(
  `insert into brand_profiles (persona_id, user_id, business, audience, value_proposition, tone, niche, content_pillars, products, confidence, notes, source)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'text')
   on conflict (persona_id) do update set business=$3, audience=$4, value_proposition=$5, tone=$6, niche=$7, content_pillars=$8, products=$9, confidence=$10, notes=$11`,
  [personaId, userId, profile.business, profile.audience, profile.value_proposition, profile.tone, profile.niche,
   JSON.stringify(profile.content_pillars), JSON.stringify(profile.products), profile.confidence, profile.notes]
);
console.log(`✓ perfil salvo (${profile.confidence}): ${profile.business}`);

console.log("▶ gerando ideias...");
const ideas = await generateIdeas(profile, 6);
ideas.forEach((i, n) => console.log(`  ${n + 1}. [${i.format}] ${i.title}`));
console.log("✔ SEED_BRAND_OK");
process.exit(0);
