// Empurrão de assinatura no momento "uau" (vídeo pronto) — só pra quem está no free.
import Link from "next/link";

export function UpgradeNudge({
  title = "Gostou do resultado? 🎉",
  text = "Assine e crie quantos vídeos quiser — todo dia, sem esperar, sem limite.",
  cta = "Ver planos",
}: {
  title?: string;
  text?: string;
  cta?: string;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">{title}</p>
          <p className="text-sm text-muted">{text}</p>
        </div>
        <Link
          href="/credits"
          className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-95"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
