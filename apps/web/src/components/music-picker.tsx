"use client";
// Seletor de música em chips (sem <select>), com prévia por faixa.
// Previews servidos em /music-previews/<key>.mp3. O áudio para ao desmontar o
// componente (sair da página / gerar roteiro) — antes ficava tocando pra sempre.
import { useEffect, useRef, useState } from "react";
import { MUSIC_OPTIONS, type Music } from "@influa/core/pipeline/style";

// Ícones em SVG (o caractere ▶ vira EMOJI azul em vários dispositivos)
export function PlayIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.5 1.2v9.6L10.6 6z" />
    </svg>
  );
}
export function StopIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2" y="2" width="8" height="8" rx="1" />
    </svg>
  );
}

export function MusicPicker({ value, onChange }: { value: Music; onChange: (m: Music) => void }) {
  const [playing, setPlaying] = useState<Music | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  };

  // Cleanup: navegação/desmonte não pode deixar a prévia tocando.
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = (key: Music) => {
    if (playing === key) return stop();
    stop();
    const a = new Audio(`/music-previews/${key}.mp3`);
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(key)).catch(() => setPlaying(null));
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {MUSIC_OPTIONS.map((m) => {
        const selected = value === m.key;
        return (
          <div
            key={m.key}
            className={`flex items-center justify-between gap-1 rounded-xl border px-3 py-2.5 text-sm transition ${
              selected ? "border-accent bg-accent/5" : "border-line hover:border-accent/40"
            }`}
          >
            <button
              type="button"
              onClick={() => onChange(m.key)}
              className={`flex-1 text-left ${selected ? "font-medium text-ink" : "text-muted"}`}
            >
              {m.label}
            </button>
            {m.key !== "none" && (
              <button
                type="button"
                onClick={() => toggle(m.key)}
                title="Ouvir prévia"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                  playing === m.key
                    ? "border-accent text-accent"
                    : "border-line text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {playing === m.key ? <StopIcon /> : <PlayIcon />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
