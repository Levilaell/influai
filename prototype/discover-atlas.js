#!/usr/bin/env node
// Descobre os IDs exatos dos modelos disponíveis na SUA conta do Atlas Cloud.
// Uso: node discover-atlas.js [filtro]
//   node discover-atlas.js            -> lista veo/banana/kling/seedance/eleven
//   node discover-atlas.js wan        -> lista modelos com "wan" no id
import "dotenv/config";

const KEY = process.env.ATLAS_API_KEY;
if (!KEY) {
  console.error("Defina ATLAS_API_KEY no .env");
  process.exit(1);
}

const BASE = process.env.ATLAS_BASE_URL ?? "https://api.atlascloud.ai";
const filter = process.argv[2]
  ? new RegExp(process.argv[2], "i")
  : /veo|banana|kling|seedance|eleven|tts|imagen|flux|seedream/i;

// A doc pública não fixa o endpoint de listagem — tentamos os padrões comuns.
const CANDIDATES = [
  "/api/v1/models",
  "/api/v1/model/list",
  "/api/v1/model/models",
  "/v1/models", // OpenAI-compatible (pode listar só LLMs)
];

const headers = { Authorization: `Bearer ${KEY}` };

for (const path of CANDIDATES) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers });
    if (!res.ok) {
      console.log(`✗ ${path} -> HTTP ${res.status}`);
      continue;
    }
    const json = await res.json();
    const list = json.data ?? json.models ?? json;
    if (!Array.isArray(list)) {
      console.log(`? ${path} -> resposta não é lista: ${JSON.stringify(json).slice(0, 200)}`);
      continue;
    }
    console.log(`\n✓ ${path} (${list.length} modelos). Filtrados:\n`);
    for (const m of list) {
      const id = m.id ?? m.model ?? m.name ?? JSON.stringify(m).slice(0, 60);
      const type = m.type ?? m.category ?? m.modality ?? "";
      if (filter.test(id)) console.log(`  ${id}${type ? `  [${type}]` : ""}`);
    }
    console.log(`\nUse os IDs acima no .env:
  ATLAS_IMAGE_MODEL=...
  ATLAS_VIDEO_MODEL=...
  ATLAS_TTS_MODEL=...
  ATLAS_LLM_MODEL=...`);
    process.exit(0);
  } catch (err) {
    console.log(`✗ ${path} -> ${err.message}`);
  }
}

console.error(`\nNenhum endpoint de listagem respondeu. Alternativas:
 1. Veja os IDs no dashboard: https://www.atlascloud.ai (página de cada modelo)
 2. Me mande o trecho da doc da sua conta que eu ajusto o adapter.`);
process.exit(1);
