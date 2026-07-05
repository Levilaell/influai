"use client";
// Vitrine de exemplos: celulares 9:16 com vídeos REAIS gerados, em marquee horizontal.
// Mostra versatilidade (nichos e formatos diferentes) com movimento — nada de grid estático.

const EXAMPLES = [
  { src: "/examples/cafeteria.mp4", poster: "/examples/cafeteria.jpg", niche: "Cafeteria", tag: "Negócio local" },
  { src: "/examples/anim-petshop.mp4", poster: "/examples/anim-petshop.jpg", niche: "Petshop", tag: "Animação 3D" },
  { src: "/examples/moda.mp4", poster: "/examples/moda.jpg", niche: "Moda", tag: "Loja / produto" },
  { src: "/examples/anim-doceria.mp4", poster: "/examples/anim-doceria.jpg", niche: "Doceria", tag: "Animação 3D" },
  { src: "/examples/fitness.mp4", poster: "/examples/fitness.jpg", niche: "Fitness", tag: "Influencer" },
  { src: "/examples/anim-curiosidades.mp4", poster: "/examples/anim-curiosidades.jpg", niche: "Curiosidades", tag: "Animação 3D" },
  { src: "/examples/estetica.mp4", poster: "/examples/estetica.jpg", niche: "Estética", tag: "Serviço" },
  { src: "/examples/hamburgueria.mp4", poster: "/examples/hamburgueria.jpg", niche: "Delivery", tag: "Promoção" },
  { src: "/examples/imobiliaria.mp4", poster: "/examples/imobiliaria.jpg", niche: "Imóveis", tag: "Autoridade" },
];

function Phone({ e }: { e: (typeof EXAMPLES)[number] }) {
  return (
    <figure className="mr-4 w-[168px] shrink-0 md:w-[196px]">
      <div
        className="relative overflow-hidden rounded-[24px] border border-line bg-bg-soft shadow-[0_24px_70px_-24px_rgba(0,0,0,.85)]"
        style={{ aspectRatio: "9 / 16" }}
      >
        <video
          src={e.src}
          poster={e.poster}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <figcaption className="pointer-events-none absolute inset-x-2 bottom-2 rounded-2xl bg-gradient-to-t from-black/85 to-black/25 px-3 py-2 backdrop-blur-[2px]">
          <div className="text-[.74rem] font-semibold leading-tight text-ink">{e.niche}</div>
          <div className="mt-0.5 text-[.58rem] font-semibold uppercase leading-none tracking-[.08em] text-accent">
            {e.tag}
          </div>
        </figcaption>
      </div>
    </figure>
  );
}

export function VideoShowcase() {
  const row = [...EXAMPLES, ...EXAMPLES]; // 2 cópias (9 itens já enchem a tela) + loop -1/2 sem emenda
  return (
    <div className="relative overflow-hidden py-1 [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]">
      <div className="flex w-max animate-[marquee-half_58s_linear_infinite] hover:[animation-play-state:paused]">
        {row.map((e, i) => (
          <Phone key={i} e={e} />
        ))}
      </div>
    </div>
  );
}
