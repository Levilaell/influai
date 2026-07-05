#!/usr/bin/env node
// A/B/C de modelos de avatar: mesmo áudio (Matilda) + mesmo keyframe da Lia.
//   A) kling-v2.6-std   $0.048/s  (candidato a tier econômico/padrão)
//   B) omni-human v1.5  $0.060/s  (candidato intermediário)
//   C) kling-v2.6-pro   $0.095/s  (atual — reaproveitado do último run, $0)
// Gera output/ab-avatar/{std,omni,pro}.mp4 para comparação lado a lado.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { uploadPublic } from "./lib/providers.js";

const ATLAS_KEY = process.env.ATLAS_API_KEY;
const BASE = process.env.ATLAS_BASE_URL ?? "https://api.atlascloud.ai";
const headers = { Authorization: `Bearer ${ATLAS_KEY}`, "Content-Type": "application/json" };

const OUT = "output/ab-avatar";
fs.mkdirSync(OUT, { recursive: true });

// Insumos do último run avatar (mesmo keyframe + mesmo áudio => comparação justa)
const lastRun = "output/2026-07-02T04-09-07";
const manifest = JSON.parse(fs.readFileSync(`${lastRun}/manifest.json`, "utf8"));
const keyframe = manifest.sceneKeyframe;
if (!keyframe) throw new Error("sceneKeyframe não encontrado no manifest");

// C) pro: reaproveita o take existente
fs.copyFileSync(`${lastRun}/take.mp4`, path.join(OUT, "pro.mp4"));
console.log("✓ pro.mp4 reaproveitado do último run ($0)");

// Re-hospeda o áudio (URL antiga do tmpfiles pode ter expirado)
const audioUrl = await uploadPublic(`${lastRun}/voice.mp3`, "audio/mpeg");
console.log(`✓ áudio re-hospedado: ${audioUrl}`);

const PROMPT = "Natural talking head, subtle hand gestures, warm friendly delivery, looking at camera.";

const JOBS = [
  {
    name: "std",
    payload: { model: "kwaivgi/kling-v2.6-std/avatar", audio: audioUrl, image: keyframe, prompt: PROMPT },
  },
  {
    name: "omni",
    payload: {
      model: "bytedance/avatar-omni-human-v1.5",
      audio_url: audioUrl,          // schema do omni usa *_url
      image_url: keyframe,
      prompt: PROMPT,
      output_resolution: 1080,
    },
  },
];

async function runJob({ name, payload }) {
  const res = await fetch(`${BASE}/api/v1/model/generateVideo`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${name} submit ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  const id = json.data?.id ?? json.id;
  console.log(`▶ ${name}: prediction ${id}`);

  const deadline = Date.now() + 900000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));
    const poll = await fetch(`${BASE}/api/v1/model/prediction/${id}`, { headers });
    const state = await poll.json();
    const status = state.data?.status ?? state.status;
    if (status === "completed" || status === "succeeded") {
      const outputs = state.data?.outputs ?? state.outputs;
      const url = Array.isArray(outputs) ? outputs[0]?.url ?? outputs[0] : outputs?.url ?? outputs;
      const file = path.join(OUT, `${name}.mp4`);
      const dl = await fetch(url);
      fs.writeFileSync(file, Buffer.from(await dl.arrayBuffer()));
      console.log(`✓ ${name}.mp4 pronto`);
      return file;
    }
    if (status === "failed")
      throw new Error(`${name} falhou: ${JSON.stringify(state.data?.error ?? state).slice(0, 300)}`);
  }
  throw new Error(`${name}: timeout`);
}

// Roda os dois em PARALELO
const results = await Promise.allSettled(JOBS.map(runJob));
for (const [i, r] of results.entries()) {
  if (r.status === "rejected") console.error(`✗ ${JOBS[i].name}: ${r.reason.message}`);
}
if (results.every((r) => r.status === "rejected")) process.exit(1);
console.log("\n✔ AB_OK output/ab-avatar/ (std.mp4, omni.mp4, pro.mp4)");
