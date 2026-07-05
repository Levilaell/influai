import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = { title: "Como funciona · influai" };

const display = "font-[family-name:var(--font-display)]";

const STEPS = [
  {
    n: "01",
    tag: "O cérebro",
    title: "Crie sua Marca",
    text: "Tudo gira em torno da marca. Você ensina a IA sobre o seu negócio uma vez — com um print do perfil ou um texto — e ela entende seu nicho, tom e público. A partir daí ela sugere os temas dos vídeos. Personas, vídeos, agenda e memória vivem todos dentro da marca.",
  },
  {
    n: "02",
    tag: "O rosto",
    title: "Crie uma Persona",
    text: "É o seu influenciador de IA — rosto e voz travados, o mesmo em todos os vídeos. Você descreve, escolhe o rosto entre as opções geradas, e a gente cria um “character sheet” que mantém a identidade consistente em 1 ou 1.000 vídeos.",
  },
  {
    n: "03",
    tag: "A fábrica",
    title: "Gere o Vídeo",
    text: "Escolha um tema (ou aceite a sugestão da IA pro seu nicho). Em um clique: roteiro, cenas, voz humana e legenda. O vídeo sai pronto, 9:16, sem marca d'água. Você vê o custo em créditos antes de gerar.",
  },
  {
    n: "04",
    tag: "No automático",
    title: "Agende e acompanhe",
    text: "Agende os posts pra sair no horário que você marcar e acompanhe tudo no painel. A ideia é essa: um influenciador que posta sozinho, todo dia, sem você aparecer ou editar.",
  },
];

export default function TutorialPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className={`${display} text-3xl font-semibold`}>Como funciona</h1>
        <p className="mt-1 max-w-xl text-muted">
          Tudo começa na <span className="text-ink">Marca</span> — o cérebro. A partir dela você cria personas e gera
          vídeos. Em 4 passos:
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
          Criar minha primeira marca →
        </Link>
        <span className="text-sm text-muted">Leva uns minutos e o primeiro vídeo é por nossa conta.</span>
      </div>
    </div>
  );
}
