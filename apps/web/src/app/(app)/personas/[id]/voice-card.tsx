"use client";
// Voz do influenciador: mostra a voz atual (nome amigável, não o ID), toca a prévia
// em PT-BR e permite trocar ANTES do primeiro vídeo (troca é grátis; vale pros próximos).
import { useEffect, useRef, useState, useTransition } from "react";
import { updatePersonaVoiceAction } from "@/actions/personas";
import { PlayIcon } from "@/components/music-picker";
import { Button, ErrorText } from "@/components/ui";

type Voice = { id: string; name: string; preview: string | null; labels: Record<string, string> };

export function VoiceCard({ personaId, currentVoiceId }: { personaId: string; currentVoiceId: string }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState(currentVoiceId);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => setVoices(d.voices ?? []))
      .catch(() => {});
    return () => audioRef.current?.pause(); // não deixa a prévia tocando ao sair
  }, []);

  const play = (v: Voice) => {
    audioRef.current?.pause();
    if (playing === v.id) return setPlaying(null);
    if (!v.preview) return;
    const a = new Audio(v.preview);
    audioRef.current = a;
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
    setPlaying(v.id);
  };

  const save = (id: string) =>
    start(async () => {
      setError(undefined);
      const fd = new FormData();
      fd.set("personaId", personaId);
      fd.set("voiceId", id);
      const r = await updatePersonaVoiceAction(undefined, fd);
      if (r?.error) return setError(r.error);
      setVoiceId(id);
      setOpen(false);
    });

  const current = voices.find((v) => v.id === voiceId);

  return (
    <div className="rounded-2xl border border-line bg-bg-soft px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm">
          <span className="text-muted">Voz do influenciador:</span>{" "}
          <b>{current ? current.name : "..."}</b>
          {current?.labels?.tone && <span className="text-muted"> — {current.labels.tone}</span>}
        </p>
        {current?.preview && (
          <button
            type="button"
            onClick={() => play(current)}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-accent transition hover:border-accent"
          >
            <PlayIcon /> {playing === current.id ? "parar" : "ouvir"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-muted underline hover:text-accent"
        >
          {open ? "fechar" : "trocar voz"}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            Trocar é grátis e vale pros próximos vídeos. Clique em ouvir pra comparar.
          </p>
          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {voices.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between rounded-xl border bg-bg px-3 py-2 text-sm transition ${
                  voiceId === v.id ? "border-accent" : "border-line hover:border-accent/40"
                }`}
              >
                <button type="button" onClick={() => save(v.id)} disabled={pending} className="flex-1 text-left">
                  <span className="font-medium">{v.name}</span>
                  <span className="block text-[11px] text-muted">
                    {v.labels?.gender}
                    {v.labels?.tone ? ` · ${v.labels.tone}` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => play(v)}
                  className="ml-2 shrink-0 rounded-full border border-line px-3 py-1 text-xs text-accent transition hover:border-accent"
                >
                  {playing === v.id ? "parar" : "ouvir"}
                </button>
              </div>
            ))}
          </div>
          {pending && <p className="text-xs text-muted">salvando...</p>}
          <ErrorText>{error}</ErrorText>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
