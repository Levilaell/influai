"use client";
// Seletor de música com preview (▶ ouvir). Previews servidos em /music-previews/<key>.mp3.
import { useRef, useState } from "react";
import { MUSIC_OPTIONS, type Music } from "@influa/core/pipeline/style";

export function MusicPicker({ value, onChange }: { value: Music; onChange: (m: Music) => void }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const toggle = () => {
    if (value === "none") return;
    if (playing) return stop();
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = `/music-previews/${value}.mp3`;
    audioRef.current.onended = () => setPlaying(false);
    audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => {
          stop();
          onChange(e.target.value as Music);
        }}
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent"
      >
        {MUSIC_OPTIONS.map((m) => (
          <option key={m.key} value={m.key}>{m.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={toggle}
        disabled={value === "none"}
        className="shrink-0 rounded-xl border border-line px-4 text-sm text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
        title="Ouvir prévia"
      >
        {playing ? "parar" : "ouvir"}
      </button>
    </div>
  );
}
