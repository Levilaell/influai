"use client";
// Exemplos reais empilhados (sem seletor): moda, estética e cafeteria — o visitante
// rola e ASSISTE cada um com som. Cada exemplo aponta o que reparar (voz, legenda,
// cenário) pra prova ficar explícita, não decorativa.

const SHOWCASE = [
  {
    src: "/examples/moda.mp4",
    poster: "/examples/moda.jpg",
    niche: "Loja de roupa",
    note: "Repara na naturalidade: selfie no provador, gesto de creator e legenda sincronizada palavra a palavra.",
  },
  {
    src: "/examples/estetica.mp4",
    poster: "/examples/estetica.jpg",
    niche: "Clínica de estética",
    note: "Voz 100% em português natural e cenário coerente com o negócio — autoridade sem gravar nada.",
  },
  {
    src: "/examples/cafeteria.mp4",
    poster: "/examples/cafeteria.jpg",
    niche: "Cafeteria",
    note: "Roteiro, voz, legenda e trilha saíram prontos da plataforma — zero edição humana.",
  },
];

export function ExamplesSection() {
  return (
    <div className="space-y-12 md:space-y-16">
      {SHOWCASE.map((e, i) => (
        <div
          key={e.src}
          className={`flex flex-col items-center gap-6 md:gap-12 ${
            i % 2 ? "md:flex-row-reverse" : "md:flex-row"
          }`}
        >
          <div className="w-[240px] shrink-0 md:w-[264px]">
            <div
              className="relative overflow-hidden rounded-[28px] border border-line bg-bg-soft shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)]"
              style={{ aspectRatio: "9 / 16" }}
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={e.src}
                poster={e.poster}
                controls
                playsInline
                preload="none"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className={`max-w-[400px] text-center md:text-left ${i % 2 ? "md:text-right" : ""}`}>
            <div className="mb-2 inline-block rounded-full bg-accent/10 px-3 py-1 text-[.72rem] font-semibold uppercase tracking-wide text-accent">
              {e.niche}
            </div>
            <p className="text-[1.05rem] leading-relaxed text-muted">{e.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
