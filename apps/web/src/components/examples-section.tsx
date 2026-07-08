"use client";
// Seção "veja como ficaria pro SEU negócio": chips de ramo -> player 9:16 COM SOM.
// O marquee do topo é ambiente/teaser; aqui o visitante escolhe o nicho dele e
// ASSISTE um vídeo real completo (voz, legenda karaokê, música) — a prova de verdade.
import { useRef, useState } from "react";
import { EXAMPLES } from "./video-showcase";

export function ExamplesSection() {
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const e = EXAMPLES[idx];

  const pick = (i: number) => {
    setIdx(i);
    // troca de nicho: recarrega e já toca com som (gesto do usuário autoriza o áudio)
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.load();
      v.play().catch(() => {});
    });
  };

  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
      {/* Chips de ramo */}
      <div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex.src}
              type="button"
              onClick={() => pick(i)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                i === idx
                  ? "border-accent bg-accent/10 font-semibold text-accent"
                  : "border-line text-muted hover:border-accent/50 hover:text-ink"
              }`}
            >
              {ex.niche}
            </button>
          ))}
        </div>
        <p className="mt-5 max-w-[420px] text-[.95rem] text-muted">
          <span className="font-semibold text-ink">{e.niche}</span> · {e.tag}. Vídeo real gerado pela
          Influai — roteiro, voz, legenda e música, sem nenhuma edição humana. Dá o play e ouve a voz.
        </p>
      </div>

      {/* Player 9:16 com som */}
      <div className="mx-auto w-[240px] md:w-[270px]">
        <div
          className="relative overflow-hidden rounded-[28px] border border-line bg-bg-soft shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)]"
          style={{ aspectRatio: "9 / 16" }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            key={e.src}
            src={e.src}
            poster={e.poster}
            controls
            playsInline
            preload="none"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
