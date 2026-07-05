// Vídeo longo multi-segmento: divide a narração em N trechos (nos limites dos
// shots), para gerar um take por trecho e concatenar. Kling não faz 60-90s num
// take só; então quebramos, com cena diferente por segmento (variedade visual).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Script } from "../schemas.ts";
import type { Alignment } from "../providers/elevenlabs.ts";

export type Segment = { shotStart: number; shotEnd: number; startSec: number; endSec: number; text: string };

/** Distribui os shots em N segmentos e calcula os limites de tempo de cada um. */
export function planSegments(script: Script, segments: number, totalSeconds: number, alignment: Alignment | null): Segment[] {
  const n = Math.max(1, Math.min(segments, script.shots.length));
  const perSeg = Math.ceil(script.shots.length / n);
  const groups: { shotStart: number; shotEnd: number }[] = [];
  for (let i = 0; i < script.shots.length; i += perSeg) {
    groups.push({ shotStart: i, shotEnd: Math.min(i + perSeg, script.shots.length) });
  }

  // tempo por shot: proporcional aos caracteres (ou pelo alignment, se houver)
  const chars = script.shots.map((s) => s.dialogue.length);
  const totalChars = chars.reduce((a, b) => a + b, 0) || 1;
  const shotEnds: number[] = [];
  let acc = 0;
  for (let i = 0; i < script.shots.length; i++) {
    acc += totalSeconds * (chars[i] / totalChars);
    shotEnds.push(acc);
  }
  void alignment; // (o split usa os limites proporcionais; alignment fica p/ legendas)

  return groups.map((g) => ({
    ...g,
    startSec: g.shotStart === 0 ? 0 : shotEnds[g.shotStart - 1],
    endSec: shotEnds[g.shotEnd - 1] ?? totalSeconds,
    text: script.shots.slice(g.shotStart, g.shotEnd).map((s) => s.dialogue).join(" "),
  }));
}

/** Extrai o trecho [start,end] de um mp3 (para gerar o take daquele segmento). */
export async function sliceAudio(inFile: string, start: number, end: number, outFile: string): Promise<string> {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await run("ffmpeg", ["-y", "-i", inFile, "-ss", start.toFixed(3), "-to", end.toFixed(3), "-c", "copy", outFile]);
  return outFile;
}

/** Concatena N takes (mesma resolução/fps) num único mp4 (vídeo + áudio). */
export async function concatTakes(takeFiles: string[], outFile: string): Promise<string> {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (takeFiles.length === 1) {
    fs.copyFileSync(takeFiles[0], outFile);
    return outFile;
  }
  // normaliza cada take (720x1280, 30fps, aac) e concatena via filter_complex
  const inputs: string[] = [];
  const parts: string[] = [];
  takeFiles.forEach((f, i) => {
    inputs.push("-i", f);
    parts.push(`[${i}:v]scale=720:1280,fps=30,setsar=1[v${i}]`);
    parts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`);
  });
  const concatIn = takeFiles.map((_, i) => `[v${i}][a${i}]`).join("");
  const fc = `${parts.join(";")};${concatIn}concat=n=${takeFiles.length}:v=1:a=1[v][a]`;
  await run("ffmpeg", [
    "-y", ...inputs,
    "-filter_complex", fc,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "160k",
    outFile,
  ]);
  return outFile;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${code}:\n${stderr.slice(-1500)}`))));
    proc.on("error", reject);
  });
}
