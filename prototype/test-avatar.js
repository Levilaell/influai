#!/usr/bin/env node
// Experimento: TTS (ElevenLabs direto) + lip-sync (Kling v2.6 avatar no Atlas).
// Valida o fluxo "voz determinística + talking head" como modo padrão do produto.
//
// Fluxo: roteiro existente → ElevenLabs TTS (palavras EXATAS, PT-BR) →
//        hospeda áudio → Kling avatar anima keyframe da Lia sincronizado →
//        output/avatar-test/avatar.mp4
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const EL_KEY = process.env.ELEVENLABS_API_KEY;
const ATLAS_KEY = process.env.ATLAS_API_KEY;
const ATLAS_BASE = process.env.ATLAS_BASE_URL ?? "https://api.atlascloud.ai";
if (!EL_KEY || !ATLAS_KEY) throw new Error("Defina ELEVENLABS_API_KEY e ATLAS_API_KEY no .env");

const AVATAR_MODEL = process.env.ATLAS_AVATAR_MODEL ?? "kwaivgi/kling-v2.6-pro/avatar";
const OUT = "output/avatar-test";
fs.mkdirSync(OUT, { recursive: true });

// ── 1. Texto: hook + primeira fala do último roteiro gerado ─────────────────
const lastRun = fs.readdirSync("output").filter((d) => d.startsWith("20")).sort().at(-1);
const script = JSON.parse(fs.readFileSync(`output/${lastRun}/script.json`, "utf8"));
const text = `${script.hook} ${script.shots[0].dialogue}`;
console.log(`▶ Texto (${text.length} chars): "${text}"`);

// ── 2. TTS na ElevenLabs (eleven_v3, fallback multilingual_v2) ──────────────
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL"; // Sarah (feminina, multilíngue)
const audioFile = path.join(OUT, "voice.mp3");

async function tts(modelId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId, language_code: "pt" }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${modelId} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  fs.writeFileSync(audioFile, Buffer.from(await res.arrayBuffer()));
}

try {
  await tts("eleven_v3");
  console.log("✓ TTS gerado (eleven_v3)");
} catch (err) {
  console.log(`  (eleven_v3 indisponível: ${err.message.slice(0, 120)} — tentando multilingual_v2)`);
  await tts("eleven_multilingual_v2");
  console.log("✓ TTS gerado (eleven_multilingual_v2)");
}

// ── 3. Hospedar o áudio (o Atlas precisa de URL pública) ────────────────────
async function uploadAudio() {
  // 0x0.st
  try {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(audioFile)], { type: "audio/mpeg" }), "voice.mp3");
    const res = await fetch("https://0x0.st", {
      method: "POST",
      headers: { "User-Agent": "curl/8.5.0" },
      body: form,
    });
    const url = (await res.text()).trim();
    if (res.ok && url.startsWith("http")) return url;
    throw new Error(`0x0.st: ${url.slice(0, 100)}`);
  } catch (e) {
    console.log(`  (0x0.st falhou: ${e.message.slice(0, 80)} — tentando tmpfiles.org)`);
  }
  // tmpfiles.org
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(audioFile)], { type: "audio/mpeg" }), "voice.mp3");
  const res = await fetch("https://tmpfiles.org/api/v1/upload", { method: "POST", body: form });
  const json = await res.json();
  const page = json?.data?.url;
  if (!page) throw new Error(`tmpfiles: ${JSON.stringify(json).slice(0, 200)}`);
  return page.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

const audioUrl = await uploadAudio();
console.log(`✓ áudio hospedado: ${audioUrl}`);

// ── 4. Keyframe da Lia (selfie angle do último run) ─────────────────────────
const manifest = JSON.parse(fs.readFileSync(`output/${lastRun}/manifest.json`, "utf8"));
const image = manifest.keyframes.at(-1); // último keyframe = selfie angle
console.log(`✓ keyframe: ${image}`);

// ── 5. Kling avatar: submit + poll ──────────────────────────────────────────
const headers = { Authorization: `Bearer ${ATLAS_KEY}`, "Content-Type": "application/json" };
const submit = await fetch(`${ATLAS_BASE}/api/v1/model/generateVideo`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: AVATAR_MODEL,
    audio: audioUrl,
    image,
    prompt: "Natural talking head, subtle hand gestures, warm friendly delivery, looking at camera.",
  }),
});
const sjson = await submit.json();
if (!submit.ok) throw new Error(`Atlas avatar ${submit.status}: ${JSON.stringify(sjson).slice(0, 400)}`);
const id = sjson.data?.id ?? sjson.id;
console.log(`▶ Kling avatar processando (prediction ${id})...`);

const deadline = Date.now() + 600000;
let videoUrl;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000));
  const poll = await fetch(`${ATLAS_BASE}/api/v1/model/prediction/${id}`, { headers });
  const state = await poll.json();
  const status = state.data?.status ?? state.status;
  if (status === "completed" || status === "succeeded") {
    const outputs = state.data?.outputs ?? state.outputs;
    videoUrl = Array.isArray(outputs) ? outputs[0]?.url ?? outputs[0] : outputs?.url ?? outputs;
    break;
  }
  if (status === "failed") throw new Error(`Avatar falhou: ${JSON.stringify(state.data?.error ?? state).slice(0, 400)}`);
  process.stdout.write(".");
}
if (!videoUrl) throw new Error("Timeout no Kling avatar");

// ── 6. Baixar resultado ──────────────────────────────────────────────────────
const finalFile = path.join(OUT, "avatar.mp4");
const dl = await fetch(videoUrl);
fs.writeFileSync(finalFile, Buffer.from(await dl.arrayBuffer()));
console.log(`\n✔ AVATAR_OK ${finalFile}`);
console.log(`  Áudio determinístico: ${audioFile}`);
