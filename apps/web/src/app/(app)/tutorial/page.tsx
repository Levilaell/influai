import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = { title: "Como funciona · influai" };

const display = "font-[family-name:var(--font-display)]";

const STEPS = [
  {
    n: "01",
    tag: "O rosto",
    title: "Escolha seu influenciador",
    text: "Você diz qual é o seu negócio e a Influai já gera 4 rostos pra você escolher. O escolhido vira a identidade da sua marca — rosto e voz travados, o mesmo em todos os vídeos, de 1 a 1.000. Isso é de graça.",
  },
  {
    n: "02",
    tag: "O cérebro",
    title: "Ensine sobre seu negócio",
    text: "Enquanto os rostos geram, conte pra IA sobre o seu negócio — um print do perfil ou um texto. É assim que ela entende seu nicho, tom e público pra criar vídeos sob medida (não genéricos). Esse passo é obrigatório antes de gerar vídeos.",
  },
  {
    n: "03",
    tag: "A fábrica",
    title: "Monte o roteiro",
    text: "Escolha um tema (ou peça ideias pra IA). Em um clique vem o roteiro pronto e editável, no tom da sua marca. Você ajusta o que quiser antes de gerar.",
  },
  {
    n: "04",
    tag: "No automático",
    title: "Assine e publique",
    text: "Assine um plano pra gerar seus vídeos: 9:16, voz humana e legenda, prontos pra postar. Agende os posts e acompanhe tudo no painel — sem gravar, sem aparecer, sem editar.",
  },
];

export default function TutorialPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className={`${display} text-3xl font-semibold`}>Como funciona</h1>
        <p className="mt-1 max-w-xl text-muted">
          Você monta seu <span className="text-ink">influenciador de IA</span> de graça e, quando quiser gerar os
          vídeos, é só assinar. Em 4 passos:
        </p>
      </div>

      <div className="space-y-4">
        {STEPS.map((s) => (
          <Card key={s.n} className="flex gap-5">
            <div className={`${display} shrink-0 text-4xl italic leading-none text-accent`}>{s.n}</div>
            <div>
              <div className="mb-1 inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[.68rem] font-semibold uppercase tracking-wide text-accent">
                {s.tag}
              </div>
              <h2 className={`${display} text-xl font-semibold`}>{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/brands"
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-95"
        >
          Montar meu influenciador →
        </Link>
        <span className="text-sm text-muted">Montar é grátis. Você assina quando quiser gerar os vídeos.</span>
      </div>
    </div>
  );
}
