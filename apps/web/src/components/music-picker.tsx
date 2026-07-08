"use client";
// Seletor de música em chips (sem <select>), com prévia por faixa.
// Previews servidos em /music-previews/<key>.mp3. O áudio para ao desmontar o
// componente (sair da página / gerar roteiro) — antes ficava tocando pra sempre.
import { useEffect, useRef, useState } from "react";
import { MUSIC_OPTIONS, type Music } from "@influa/core/pipeline/style";

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
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] transition ${
                  playing === m.key
                    ? "border-accent text-accent"
                    : "border-line text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {playing === m.key ? "◼" : "▶"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
