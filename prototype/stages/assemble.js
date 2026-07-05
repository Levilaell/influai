// Estágio 6 — Montagem final com FFmpeg:
// baixa os shots, concatena, queima legendas (SRT) e, no modo "tts", faz o mux da narração.
// Requer ffmpeg no PATH (com libass para as legendas).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export async function assemble({ script, videoUrls, voiceUrl, shotSeconds, outDir }) {
  const shotsDir = path.join(outDir, "shots");
  fs.mkdirSync(shotsDir, { recursive: true });

  // 1. Baixa os shots
  const files = [];
  for (const [i, url] of videoUrls.entries()) {
    const file = path.join(shotsDir, `shot_${String(i + 1).padStart(2, "0")}.mp4`);
    await download(url, file);
    files.push(file);
    console.log(`  ✓ baixado shot ${i + 1}`);
  }

  // 2. Narração (modo tts)
  let voiceFile = null;
  if (voiceUrl) {
    voiceFile = path.join(outDir, "voice.mp3");
    await download(voiceUrl, voiceFile);
  }

  // 3. Legendas: uma entrada de SRT por shot (timing aproximado pela duração do shot)
  const srtFile = path.join(outDir, "captions.srt");
  fs.writeFileSync(srtFile, buildSrt(script, shotSeconds));

  // 4. Lista de concat
  const listFile = path.join(outDir, "concat.txt");
  fs.writeFileSync(listFile, files.map((f) => `file '${path.resolve(f)}'`).join("\n"));

  // 5. FFmpeg
  const finalFile = path.join(outDir, "final.mp4");
  const subFilter = `subtitles=${escapeFilterPath(srtFile)}:force_style='FontSize=14,Bold=1,Alignment=2,MarginV=60,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2'`;

  const args = ["-y", "-f", "concat", "-safe", "0", "-i", listFile];
  if (voiceFile) {
    // Modo tts: substitui o áudio pelo da narração
    args.push("-i", voiceFile, "-map", "0:v", "-map", "1:a", "-shortest");
  }
  args.push("-vf", subFilter, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", finalFile);

  console.log(`  ▶ ffmpeg (concat + legendas${voiceFile ? " + narração" : ""})...`);
  await run("ffmpeg", args);
  console.log(`  ✓ vídeo final: ${finalFile}`);
  return finalFile;
}

/**
 * Montagem do modo avatar: take único já com áudio embutido (Kling) ->
 * só queima as legendas, com timing proporcional ao tamanho de cada fala
 * sobre a duração REAL do áudio (bem mais preciso que shotSeconds fixo).
 */
export async function assembleAvatar({ script, takeUrl, audioDurationSeconds, outDir }) {
  fs.mkdirSync(outDir, { recursive: true });

  const takeFile = path.join(outDir, "take.mp4");
  await download(takeUrl, takeFile);
  console.log(`  ✓ take baixado`);

  const srtFile = path.join(outDir, "captions.srt");
  fs.writeFileSync(srtFile, buildProportionalSrt(script, audioDurationSeconds));

  const finalFile = path.join(outDir, "final.mp4");
  const subFilter = `subtitles=${escapeFilterPath(srtFile)}:force_style='FontSize=14,Bold=1,Alignment=2,MarginV=60,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,Outline=2'`;

  console.log(`  ▶ ffmpeg (legendas)...`);
  await run("ffmpeg", [
    "-y", "-i", takeFile,
    "-vf", subFilter,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-c:a", "copy",
    finalFile,
  ]);
  console.log(`  ✓ vídeo final: ${finalFile}`);
  return finalFile;
}

// Divide a duração real do áudio proporcionalmente ao nº de caracteres de cada fala
function buildProportionalSrt(script, totalSeconds) {
  const totalChars = script.shots.reduce((sum, s) => sum + s.dialogue.length, 0);
  let t = 0;
  return script.shots
    .map((shot, i) => {
      const dur = totalSeconds * (shot.dialogue.length / totalChars);
      const entry = `${i + 1}\n${ts(t)} --> ${ts(t + dur - 0.15)}\n${shot.dialogue}\n`;
      t += dur;
      return entry;
    })
    .join("\n");
}

function buildSrt(script, shotSeconds) {
  return script.shots
    .map((shot, i) => {
      const start = i * shotSeconds;
      const end = start + shotSeconds - 0.3;
      return `${i + 1}\n${ts(start)} --> ${ts(end)}\n${shot.dialogue}\n`;
    })
    .join("\n");
}

function ts(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  const ms = String(Math.round((seconds % 1) * 1000)).padStart(3, "0");
  return `${h}:${m}:${s},${ms}`;
}

// FFmpeg filter paths precisam de escaping próprio (':' e '\')
function escapeFilterPath(p) {
  return path.resolve(p).replace(/\\/g, "/").replace(/:/g, "\\:");
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou (${res.status}): ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} saiu com código ${code}:\n${stderr.slice(-2000)}`))
    );
    proc.on("error", reject);
  });
}
