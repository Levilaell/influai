"use client";
// Isca de conversão: nicho -> prévia AO VIVO (persona + 5 ideias + roteiro) -> no pico do
// "wow", CRIAR CONTA GRÁTIS (não waitlist). O email + nicho vão pré-preenchidos pro cadastro.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackPixel } from "@/components/meta-pixel";

type Preview = {
  niche: string;
  persona: { name: string; tagline: string; look: string };
  ideas: { title: string; hook: string }[];
  script: { title: string; lines: string[]; hashtags: string[] };
};

const LOADING_MSGS = [
  "Entendendo o seu negócio...",
  "Criando o influenciador ideal...",
  "Bolando 5 ideias de vídeo...",
  "Escrevendo o primeiro roteiro...",
];

export function KillerWaitlist(_props: { refCode?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"input" | "loading" | "reveal">("input");
  const [niche, setNiche] = useState("");
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string>();
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function genPreview() {
    if (niche.trim().length < 2) return setError("Conte qual é o seu negócio (ex: cafeteria, advogado, loja de roupa).");
    setError(undefined);
    setStage("loading");
    let i = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    timer.current = setInterval(() => { i++; setLoadingMsg(LOADING_MSGS[i % LOADING_MSGS.length]); }, 1500);
    try {
      const r = await fetch("/api/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ niche }),
      });
      const j = await r.json();
      if (timer.current) clearInterval(timer.current);
      if (!r.ok) { setStage("input"); return setError(j.error ?? "Tenta de novo em instantes."); }
      setPreview(j.preview);
      setStage("reveal");
      trackPixel("ViewContent", { content_name: "preview_gerado", niche });
    } catch {
      if (timer.current) clearInterval(timer.current);
      setStage("input");
      setError("Falha de conexão — tenta de novo.");
    }
  }

  function goRegister(e: React.FormEvent) {
    e.preventDefault();
    trackPixel("Lead", { content_name: "criar_conta" });
    // guarda a prévia p/ o cadastro disparar o 1º vídeo automático (zero setup)
    try {
      if (preview) sessionStorage.setItem("influa_preview", JSON.stringify(preview));
    } catch {
      /* sessionStorage indisponível — segue sem o vídeo automático */
    }
    const qs = new URLSearchParams({ email, niche }).toString();
    router.push(`/register?${qs}`);
  }

  // ── ENTRADA: pergunta o negócio, não o email ──
  if (stage === "input" || stage === "loading") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && genPreview()}
            placeholder="Qual é o seu negócio? (ex: cafeteria, advogado...)"
            disabled={stage === "loading"}
            className="w-full rounded-full border border-line bg-bg-soft px-6 py-4 text-ink outline-none focus:border-accent"
          />
          <button
            onClick={genPreview}
            disabled={stage === "loading"}
            className="shrink-0 rounded-full bg-accent px-7 py-4 font-bold text-accent-ink transition hover:brightness-110 disabled:opacity-70"
          >
            {stage === "loading" ? "criando..." : "Ver minha máquina de conteúdo"}
          </button>
        </div>
        {stage === "loading" && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            {loadingMsg}
          </div>
        )}
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        {stage === "input" && <p className="mt-3 text-center text-xs text-muted">Grátis, sem cadastro. Você vê o resultado na hora.</p>}
      </div>
    );
  }

  // ── REVELAÇÃO: a máquina de conteúdo dela, ao vivo ──
  if (stage === "reveal" && preview) {
    return (
      <div className="mx-auto max-w-3xl text-left">
        <p className="text-center text-sm text-accent">Pronto — essa é a máquina de conteúdo da sua {preview.niche}:</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-bg-soft p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Seu influenciador</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">{preview.persona.name}</p>
            <p className="text-sm text-accent">{preview.persona.tagline}</p>
            <p className="mt-2 text-sm text-muted">{preview.persona.look}</p>
          </div>
          <div className="rounded-2xl border border-line bg-bg-soft p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Roteiro pronto — {preview.script.title}</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {preview.script.lines.map((l, i) => (<li key={i} className="text-ink/90">{l}</li>))}
            </ul>
            <p className="mt-2 text-xs text-muted">{preview.script.hashtags.map((h) => `#${h}`).join(" ")}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-bg-soft p-5">
          <p className="text-xs uppercase tracking-wide text-muted">5 ideias de vídeo pra você</p>
          <ul className="mt-2 space-y-2">
            {preview.ideas.map((idea, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-ink">{idea.title}</span>
                <span className="text-muted"> — “{idea.hook}”</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-7 rounded-2xl border border-accent/40 bg-accent/5 p-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold">Isso é só a prévia.</p>
          <p className="mt-1 text-sm text-muted">
            Crie sua conta <b>grátis</b> e transforme isso em <b>vídeos prontos</b> — com esse influenciador gravando
            tudo sozinho. O <b>primeiro vídeo é por nossa conta</b>.
          </p>
          <form onSubmit={goRegister} className="mx-auto mt-4 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              name="email" type="email" required placeholder="seu@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border border-line bg-bg px-6 py-3.5 text-ink outline-none focus:border-accent"
            />
            <button className="shrink-0 rounded-full bg-accent px-7 py-3.5 font-bold text-accent-ink transition hover:brightness-110">
              Criar minha conta grátis
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      </div>
    );
  }

  return null;
}
