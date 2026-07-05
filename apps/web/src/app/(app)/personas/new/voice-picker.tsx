"use client";
// Seletor de voz com preview: lista vozes reais da ElevenLabs e toca a amostra.
import { useEffect, useRef, useState } from "react";

type Voice = { id: string; name: string; preview: string | null; labels: Record<string, string> };

// Fallback caso a API da ElevenLabs esteja fora — as vozes multilíngues padrão.
const FALLBACK: Voice[] = [
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", preview: null, labels: { gender: "female" } },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", preview: null, labels: { gender: "female" } },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", preview: null, labels: { gender: "female" } },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", preview: null, labels: { gender: "male" } },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", preview: null, labels: { gender: "male" } },
];

export function VoicePicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [selected, setSelected] = useState(defaultValue);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => setVoices(d.voices?.length ? d.voices : FALLBACK))
      .catch(() => setVoices(FALLBACK));
  }, []);

  const preview = (v: Voice) => {
    if (!v.preview) return;
    if (audioRef.current) audioRef.current.pause();
    if (playing === v.id) {
      setPlaying(null);
      return;
    }
    const a = new Audio(v.preview);
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    a.play();
    setPlaying(v.id);
  };

  const list = voices ?? FALLBACK;
  const selectedVoice = list.find((v) => v.id === selected);

  return (
    <div>
      <input type="hidden" name={name} value={selected} />
      {!voices && <p className="mb-2 text-xs text-muted">Carregando vozes...</p>}
      <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {list.map((v) => (
          <div
            key={v.id}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
              selected === v.id ? "border-accent bg-accent/5" : "border-line hover:border-accent/40"
            }`}
          >
            <button type="button" onClick={() => setSelected(v.id)} className="flex-1 text-left">
              <span className="font-medium">{v.name}</span>
              {v.labels?.gender && <span className="ml-2 text-xs text-muted">{v.labels.gender}</span>}
              {v.labels?.tone && <span className="block text-[11px] text-muted">{v.labels.tone}</span>}
            </button>
            {v.preview && (
              <button
                type="button"
                onClick={() => preview(v)}
                className="ml-2 rounded-full border border-line px-3 py-1 text-xs text-accent transition hover:border-accent"
              >
                {playing === v.id ? "parar" : "ouvir"}
              </button>
            )}
          </div>
        ))}
      </div>
      {selectedVoice && (
        <p className="mt-2 text-xs text-muted">
          Voz escolhida: <b className="text-ink">{selectedVoice.name}</b>
        </p>
      )}
    </div>
  );
}
