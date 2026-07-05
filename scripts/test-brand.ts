// Prova de qualidade do Cérebro da Marca (caminho C): extração por PRINT e por
// TEXTO colado, + motor de ideias. Uso: npx tsx scripts/test-brand.ts
import "@influa/core/env";
import fs from "node:fs";
import { extractBrandProfile, generateIdeas } from "@influa/core/brand/index";

function show(label: string, profile: any, ideas: any[]) {
  console.log(`\n══════ ${label} ══════`);
  console.log(`negócio:   ${profile.business}`);
  console.log(`público:   ${profile.audience}`);
  console.log(`proposta:  ${profile.value_proposition}`);
  console.log(`tom:       ${profile.tone}`);
  console.log(`nicho:     ${profile.niche}`);
  console.log(`pilares:   ${profile.content_pillars.join(" · ")}`);
  console.log(`produtos:  ${profile.products.join(", ")}`);
  console.log(`confiança: ${profile.confidence} — ${profile.notes}`);
  console.log(`\n  ideias de vídeo:`);
  ideas.forEach((i, n) => console.log(`  ${n + 1}. [${i.format}] ${i.title}\n     hook: "${i.hook}"\n     tema: ${i.topic}`));
}

// ── Caminho 1: PRINT (imagem) ────────────────────────────────────────
const imgPath = process.argv[2] ?? "/tmp/mock-ig.png";
if (fs.existsSync(imgPath)) {
  console.log(`▶ extraindo de PRINT (${imgPath})...`);
  const base64 = fs.readFileSync(imgPath).toString("base64");
  const profile = await extractBrandProfile({ image: { base64, mediaType: "image/png" } });
  const ideas = await generateIdeas(profile, 5);
  show("VIA PRINT DE PERFIL", profile, ideas);
} else {
  console.log(`(pulei o print — ${imgPath} não existe)`);
}

// ── Caminho 2: TEXTO colado (bio + legendas) ─────────────────────────
const pasted = `Bio do meu perfil:
"Studio Aurora | Pilates e Fisioterapia 🧘‍♀️ Reeducação postural e alívio de dores nas costas. Aulas em grupo reduzido, atendimento individual. Zona Sul SP. Agende sua aula experimental."

Minhas 3 legendas que mais performaram:
1. "Dor lombar não é normal, é sinal. 3 exercícios que aliviam em casa 👇"
2. "Antes e depois de 3 meses de pilates: a diferença na postura da Dona Célia, 62 anos ❤️"
3. "Pilates NÃO é só alongamento. Desmistificando o maior mito do studio."`;

console.log(`\n▶ extraindo de TEXTO colado...`);
const p2 = await extractBrandProfile({ text: pasted });
const i2 = await generateIdeas(p2, 5);
show("VIA TEXTO COLADO", p2, i2);

console.log("\n✔ BRAND_OK");
process.exit(0);
