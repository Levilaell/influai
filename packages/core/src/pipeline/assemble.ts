// Montagem do take avatar: legendas dopaminérgicas (chunks curtos de 2-3 palavras,
// trocando rápido, sincronizadas com a fala via timestamps da ElevenLabs) queimadas
// sobre o mp4 (áudio já embutido pelo Kling; -c:a copy). Estilo karaokê, fonte
// pesada (Lato Black), tamanho menor. Fallback: SRT proporcional por shot.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Script } from "../schemas.ts";
import { captionChunks, type Alignment } from "../providers/elevenlabs.ts";
import type { Music } from "./style.ts";

export async function assembleAvatar(opts: {
  takeFile: string; // mp4 do Kling (local)
  script: Script;
  audioDurationSeconds: number;
  alignment?: Alignment | null;
  music?: Music; // trilha de fundo (mixada com ducking sob a voz)
  // B-roll: 1 clipe, N cortes (cada janela usa um trecho diferente do MESMO clipe = mais dinâmica, mesmo custo)
  broll?: { file: string; windows: { start: number; duration: number; clipStart: number }[] } | null;
  outFile: string;
}): Promise<string> {
  const workDir = path.dirname(opts.outFile);
  fs.mkdirSync(workDir, { recursive: true });
  const dur = Math.max(1, opts.audioDurationSeconds);

  const chunks =
    opts.alignment
      ? captionChunks(opts.alignment)
      : proportionalChunks(opts.script, opts.audioDurationSeconds);

  const assFile = path.join(workDir, "captions.ass");
  fs.writeFileSync(assFile, buildAss(chunks));

  // Cadeia de VÍDEO: apenas legendas (sem movimento de câmera).
  const videoChain = `ass=${escapeFilterPath(assFile)}`;

  const bed = musicBedPath(opts.music);
  const broll =
    opts.broll && opts.broll.windows.length && fs.existsSync(opts.broll.file) ? opts.broll : null;

  // Caminho simples: sem música e sem B-roll → filtro -vf + áudio copiado (rápido).
  if (!bed && !broll) {
    await run("ffmpeg", [
      "-y", "-i", opts.takeFile,
      "-vf", videoChain,
      "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-c:a", "copy",
      opts.outFile,
    ]);
    return opts.outFile;
  }

  // Caminho composto (filter_complex): monta o vídeo (com corte de B-roll se houver)
  // e o áudio (voz contínua + música com ducking se houver).
  const args = ["-y", "-i", opts.takeFile];
  let idx = 1;
  let brollIdx = -1;
  let musicIdx = -1;
  if (broll) { args.push("-i", broll.file); brollIdx = idx++; }
  if (bed) { args.push("-stream_loop", "-1", "-i", bed); musicIdx = idx++; }

  const parts: string[] = [];
  // ── vídeo ──
  if (broll && broll.windows.length) {
    const norm = "fps=30,scale=720:1280,setsar=1";
    const crop = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
    // janelas válidas, sem sobreposição, dentro do take (ordenadas por start)
    const wins = broll.windows
      .map((w) => ({ start: Math.max(0, w.start), duration: Math.max(0.8, w.duration), clipStart: Math.max(0, w.clipStart) }))
      .filter((w) => w.start + w.duration <= dur - 0.3)
      .sort((a, b) => a.start - b.start)
      .filter((w, i, arr) => i === 0 || w.start >= arr[i - 1].start + arr[i - 1].duration); // sem overlap

    const segs: string[] = [];
    let cursor = 0;
    let k = 0;
    for (const w of wins) {
      if (w.start > cursor + 0.05) {
        parts.push(`[0:v]trim=${cursor.toFixed(2)}:${w.start.toFixed(2)},setpts=PTS-STARTPTS,${norm}[tv${k}]`);
        segs.push(`[tv${k}]`);
      }
      const ce = (w.clipStart + w.duration).toFixed(2);
      parts.push(`[${brollIdx}:v]${crop},trim=${w.clipStart.toFixed(2)}:${ce},setpts=PTS-STARTPTS,${norm}[bv${k}]`);
      segs.push(`[bv${k}]`);
      cursor = w.start + w.duration;
      k++;
    }
    if (cursor < dur - 0.05) {
      parts.push(`[0:v]trim=${cursor.toFixed(2)},setpts=PTS-STARTPTS,${norm}[tvE]`);
      segs.push(`[tvE]`);
    }
    parts.push(`${segs.join("")}concat=n=${segs.length}:v=1:a=0[vsrc]`);
    parts.push(`[vsrc]${videoChain}[v]`);
  } else {
    parts.push(`[0:v]${videoChain}[v]`);
  }
  // ── áudio ──
  let aMap = "0:a";
  if (bed) {
    parts.push(`[${musicIdx}:a]volume=0.16[bed]`);
    parts.push(`[bed][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[bd]`);
    parts.push(`[0:a][bd]amix=inputs=2:duration=first:normalize=0[a]`);
    aMap = "[a]";
  }

  args.push(
    "-filter_complex", parts.join(";"),
    "-map", "[v]", "-map", aMap,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-c:a", bed ? "aac" : "copy", ...(bed ? ["-b:a", "160k"] : []),
    "-shortest",
    opts.outFile
  );
  await run("ffmpeg", args);
  return opts.outFile;
}

// Resolve o arquivo da trilha (assets/music na RAIZ do repo). Caminho relativo ao
// MÓDULO (não ao cwd) — o worker roda de apps/worker, então path.resolve("assets/...")
// apontava pro lugar errado e a música era ignorada silenciosamente (bug corrigido).
function musicDir(): string {
  if (process.env.MUSIC_DIR) return process.env.MUSIC_DIR;
  // este arquivo: <raiz>/packages/core/src/pipeline/assemble.ts → 4 níveis até a raiz
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../assets/music");
}
function musicBedPath(music: Music | undefined): string | null {
  if (!music || music === "none") return null;
  const p = path.join(musicDir(), `${music}.mp3`);
  return fs.existsSync(p) ? p : null;
}

type Chunk = { text: string; start: number; end: number };

// Fallback sem timestamps: divide cada dialogue em grupos de ~3 palavras,
// distribuídos proporcionalmente à duração total.
function proportionalChunks(script: Script, totalSeconds: number): Chunk[] {
  const totalChars = script.shots.reduce((s, x) => s + x.dialogue.length, 0) || 1;
  const chunks: Chunk[] = [];
  let t = 0;
  for (const shot of script.shots) {
    const shotDur = totalSeconds * (shot.dialogue.length / totalChars);
    const words = shot.dialogue.split(/\s+/).filter(Boolean);
    const groups: string[][] = [];
    for (let i = 0; i < words.length; i += 3) groups.push(words.slice(i, i + 3));
    const per = shotDur / (groups.length || 1);
    for (const g of groups) {
      chunks.push({ text: g.join(" "), start: t, end: t + per - 0.05 });
      t += per;
    }
  }
  return chunks;
}

// ── ASS (Advanced SubStation) — controle total de fonte/tamanho/posição ──
// PlayRes casado com o vídeo 720x1280. Fonte Lato Black, tamanho ~46 (menor que
// antes), contorno grosso, um leve "pop" de escala no início de cada chunk.
function buildAss(chunks: Chunk[]): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,Lato Black,46,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0.4,0,1,3.5,1.2,2,60,60,360,1

[Events]
Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text
`;
  const events: string[] = [];

  for (const c of chunks) {
    // pequeno "pop" (escala 80%->100% em 90ms) = sensação dopaminérgica
    const eff = `{\\fscx80\\fscy80\\t(0,90,\\fscx100\\fscy100)}`;
    const text = eff + c.text.toUpperCase().replace(/\n/g, " ");
    // Formato: Layer,Start,End,Style,MarginL,MarginR,MarginV,Effect,Text (9 campos)
    events.push(`Dialogue: 0,${ass(c.start)},${ass(Math.max(c.end, c.start + 0.15))},Pop,0,0,0,,${text}`);
  }
  return header + events.join("\n") + "\n";
}

function ass(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// FFmpeg filter paths precisam de escaping próprio (':' e '\')
function escapeFilterPath(p: string): string {
  return path.resolve(p).replace(/\\/g, "/").replace(/:/g, "\\:");
}

function run(cmd: string, args: string[]): Promise<void> {
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
