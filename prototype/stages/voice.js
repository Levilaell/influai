// Estágio 5 (opcional, modo "tts") — Narração TTS.
// Vantagem sobre o áudio nativo do Veo: a MESMA voz em todos os vídeos da persona.
// Limitação do protótipo: sem lip-sync dedicado (adicionar sync.so/Kling lip-sync na v2).
// No Atlas Cloud o endpoint de áudio não é documentado publicamente — se falhar,
// use --mode native (áudio do próprio Veo).
import { genVoice } from "../lib/providers.js";

export async function generateVoice({ script, voice = "Rachel" }) {
  const text = script.shots.map((s) => s.dialogue).join(" ");
  console.log(`  ▶ narração (${text.length} caracteres)...`);
  const url = await genVoice({ text, voice, language: "pt" });
  console.log(`  ✓ narração gerada`);
  return url;
}
