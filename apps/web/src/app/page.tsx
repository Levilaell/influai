import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { KillerWaitlist } from "@/components/killer-waitlist";
import { VideoShowcase } from "@/components/video-showcase";

export const metadata: Metadata = {
  title: "influai. — A fábrica de influenciadores de IA",
  description:
    "Crie um influenciador de IA pra sua marca: rosto consistente, vídeos prontos pra postar e publicação agendada — sem gravar, sem aparecer, sem editar.",
};

const USE_CASES = [
  {
    tag: "Marca",
    title: "Promover seu negócio",
    text: "Um garoto-propaganda que só fala do seu produto — sem cachê, sem gravar, nunca some. Ideal pra cafeteria, loja, app, infoproduto.",
  },
  {
    tag: "Audiência",
    title: "Crescer um perfil do zero",
    text: "Conteúdo de nicho no piloto automático. Dicas, listas, curiosidades — a máquina roteiriza pro seu tema e entrega o vídeo pronto.",
  },
  {
    tag: "Persona",
    title: "Ter um influencer só seu",
    text: "Um rosto e uma voz que são exclusivamente seus, travados. O mesmo influenciador em 1 ou 1.000 vídeos, sem contrato, sem imprevisto.",
  },
  {
    tag: "Faceless",
    title: "Aparecer sem aparecer",
    text: "Não quer mostrar o rosto? A persona aparece por você. Roteiro, narração e legenda prontos — você nunca liga a câmera.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Crie sua persona",
    text: "Descreva o influenciador e escolha o rosto. A gente trava a identidade: mesmo rosto, mesma voz, em 1 ou 1.000 vídeos.",
  },
  {
    num: "02",
    title: "Gere o vídeo",
    text: "Escolha o tema (ou deixe a IA sugerir pelo seu nicho). Você vê o custo em créditos antes de gerar — sem surpresa na fatura.",
  },
  {
    num: "03",
    title: "Agende e esqueça",
    text: "O vídeo sai pronto, sem marca d'água, e é publicado no horário que você marcar. Acompanhe as métricas reais no painel.",
  },
];

const COMPARE: [string, string, string][] = [
  ["Produção", "Contrata editor e roteirista", "Tudo em um clique, na plataforma"],
  ["Aparecer na câmera", "Você grava e aparece", "A persona aparece por você"],
  ["Consistência do rosto", "Cada vídeo um rosto diferente", "Persona travada automaticamente"],
  ["Custo", "Cachê, edição e horas", "Preço claro antes de cada vídeo"],
  ["Se a geração falhar", "Prejuízo do bolso", "Crédito devolvido, sempre"],
  ["Publicação", "Baixa e posta na mão", "Agendamento de posts"],
];

const PLANS = [
  {
    name: "Starter",
    price: "R$ 127",
    featured: false,
    items: ["~6 vídeos de 20s/mês", "2 personas", "Export sem marca d'água"],
  },
  {
    name: "Pro",
    price: "R$ 397",
    featured: true,
    items: ["~21 vídeos de 20s/mês", "8 personas", "Agendamento de posts", "Fila prioritária"],
  },
  {
    name: "Studio",
    price: "R$ 997",
    featured: false,
    items: ["~54 vídeos de 20s/mês", "Personas ilimitadas", "5 assentos + prioridade", "Recursos avançados da marca"],
  },
];

const FAQ = [
  {
    q: "O rosto fica igual mesmo em todos os vídeos?",
    a: 'Sim. Ao criar a persona, geramos um "character sheet" com o rosto em vários ângulos e usamos essas referências em toda geração futura. É a nossa funcionalidade nº 1 — e o que separa um perfil crível de uma conta aleatória de IA.',
  },
  {
    q: "Preciso saber editar vídeo ou usar prompts?",
    a: "Não. Você descreve o tema (ou aceita a sugestão pro seu nicho) e recebe o vídeo pronto: roteiro, cenas, voz, legenda e capa. Quem quiser controle fino pode editar o roteiro antes de gerar.",
  },
  {
    q: "Como funcionam os créditos?",
    a: "Cada vídeo consome créditos proporcionais à duração e à qualidade escolhida. O custo exato aparece antes de você confirmar. Se a geração falhar, o crédito volta automaticamente — sem abrir chamado.",
  },
  {
    q: "Posso usar o rosto de uma pessoa real?",
    a: "Não. Personas são 100% sintéticas — bloqueamos tentativas de replicar pessoas reais ou celebridades. Isso protege você juridicamente e mantém as contas seguras nas plataformas. Os vídeos saem com rótulo de conteúdo gerado por IA, conforme as regras do Instagram e TikTok.",
  },
  {
    q: "Como começo?",
    a: "É só criar sua conta grátis — você já entra com créditos pro primeiro vídeo por nossa conta. Crie sua marca, gere o primeiro influenciador e o primeiro vídeo na hora. Se gostar, assina um plano pra criar sem limite.",
  },
];

const display = "font-[family-name:var(--font-display)]";
const PIPE = ["tema", "roteiro viral", "persona travada", "cenas", "voz humana", "legenda karaokê", "vídeo 9:16", "agendado", "postado"];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const session = await auth();
  if ((session?.user as { id?: string } | undefined)?.id) redirect("/brands");
  const refCode = (await searchParams)?.ref;

  return (
    <div className="grain relative leading-relaxed">
      {/* brilho lime no topo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(212,255,63,.10),transparent_70%)]" />

      <div className="relative z-[2]">
        <div className="mx-auto max-w-[1120px] px-6">
          <nav className="flex items-center justify-between py-[22px]">
            <div className={`${display} text-[1.35rem] font-semibold`}>
              influai<span className="text-accent">.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Link href="/login" className="rounded-full px-4 py-[9px] text-sm text-muted transition hover:text-ink">
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-accent px-[18px] py-[9px] text-[.9rem] font-semibold text-accent-ink transition hover:brightness-95"
              >
                Criar conta grátis
              </Link>
            </div>
          </nav>
        </div>

        {/* ── HERO ── */}
        <header className="px-6 pb-10 pt-[54px] text-center">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-7 inline-flex rotate-[-1.5deg] items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-[.8rem] font-medium uppercase tracking-[.05em] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              No ar · comece grátis
            </div>
            <h1
              className={`${display} mx-auto mb-6 max-w-[920px] text-[clamp(2.6rem,6.4vw,4.8rem)] font-semibold leading-[1.04] tracking-[-0.015em]`}
            >
              Um influenciador de IA que cria os vídeos da sua marca,{" "}
              <span className="italic text-accent">sozinho</span>.
            </h1>
            <p className="mx-auto mb-10 max-w-[640px] text-[1.15rem] text-muted">
              Rosto e voz que nunca mudam. Tema → roteiro → vídeo 9:16 com voz e legenda, pronto pra postar. Você{" "}
              <span className="text-ink">não grava, não aparece, não edita.</span>
            </p>
            <div id="waitlist" className="scroll-mt-6">
              <KillerWaitlist refCode={refCode} />
            </div>
          </div>
        </header>

        {/* ── VITRINE (prova) ── */}
        <section className="pb-14 pt-6">
          <p className="mb-5 px-6 text-center text-[.86rem] uppercase tracking-[.14em] text-muted">
            Feito 100% por IA — <span className="text-ink">nenhum humano gravou, apareceu ou editou</span>
          </p>
          <VideoShowcase />
        </section>

        {/* ── esteira do pipeline ── */}
        <div className="overflow-hidden border-y border-line bg-bg-soft/60 py-4 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="flex w-max animate-[marquee_32s_linear_infinite] items-center whitespace-nowrap text-[.95rem]">
            {[...PIPE, ...PIPE, ...PIPE].map((w, i) => (
              <span key={i} className="mr-3 flex items-center gap-3">
                <span className={i % PIPE.length === 0 ? "text-accent" : "text-muted"}>{w}</span>
                <span className="text-line">/</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── CASOS DE USO ── */}
        <section className="py-[64px] md:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="mb-12 flex items-end justify-between gap-6">
              <h2 className={`${display} max-w-[620px] text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.08]`}>
                Um influenciador. <span className="italic text-accent">Mil</span> usos.
              </h2>
              <p className="hidden max-w-[280px] text-[.95rem] text-muted md:block">
                Do dono de cafeteria ao criador faceless — a mesma máquina, propósitos diferentes.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((u, i) => (
                <div
                  key={u.title}
                  className="group relative overflow-hidden rounded-[20px] border border-line bg-bg-soft p-6 transition hover:border-accent/50"
                >
                  <div className={`${display} mb-5 text-5xl italic text-line transition group-hover:text-accent/70`}>
                    0{i + 1}
                  </div>
                  <div className="mb-2 inline-block rounded-full bg-accent/10 px-2.5 py-1 text-[.68rem] font-semibold uppercase tracking-wide text-accent">
                    {u.tag}
                  </div>
                  <h3 className={`${display} mb-2 text-[1.35rem] font-semibold leading-tight`}>{u.title}</h3>
                  <p className="text-[.92rem] text-muted">{u.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMO FUNCIONA ── */}
        <section className="py-[64px] md:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-6">
            <h2 className={`${display} mb-3.5 text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.08]`}>
              Da ideia ao post <span className="italic text-accent">em 3 passos</span>
            </h2>
            <p className="mb-12 max-w-[560px] text-muted">
              Sem editor, sem pular de app em app, sem aparecer. Você descreve; a máquina faz o resto.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.num} className="rounded-[20px] border border-line bg-bg-soft px-7 py-8">
                  <div className={`${display} text-[2.6rem] italic leading-none text-accent`}>{s.num}</div>
                  <h3 className={`${display} mb-2 mt-4 text-xl font-semibold`}>{s.title}</h3>
                  <p className="text-[.95rem] text-muted">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── O JEITO ANTIGO × INFLUAI ── */}
        <section className="py-[64px] md:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-6">
            <h2 className={`${display} mb-3.5 text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.08]`}>
              O jeito antigo <span className="italic text-accent">× Influai</span>.
            </h2>
            <p className="mb-11 max-w-[560px] text-muted">
              Contratar editor, gravar, aparecer e postar na mão — ou deixar a Influai criar tudo por você. Você entra e
              sai com vídeo pronto no primeiro dia.
            </p>
            <div className="overflow-hidden rounded-[20px] border border-line">
              {COMPARE.map(([label, them, us], i) => (
                <div
                  key={label}
                  className={`grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr] ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <div className="bg-bg-soft px-5 py-4 text-[.9rem] font-medium text-muted">{label}</div>
                  <div className="border-t border-line px-5 py-4 text-[.92rem] text-muted line-through decoration-danger/50 sm:border-t-0">
                    {them}
                  </div>
                  <div className="flex items-center gap-2 border-t border-line bg-accent/[.04] px-5 py-4 text-[.92rem] text-ink sm:border-t-0">
                    <span className="text-accent">✓</span>
                    {us}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PLANOS ── */}
        <section className="py-[64px] md:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-6">
            <h2 className={`${display} mb-3.5 text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.08]`}>
              Planos simples
            </h2>
            <p className="mb-11 max-w-[560px] text-muted">
              Assinatura mensal com créditos inclusos. Cada vídeo consome créditos conforme a duração — e o custo exato
              aparece antes de você gerar.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`relative rounded-[20px] border px-7 py-8 ${p.featured ? "border-accent bg-accent/[.05]" : "border-line bg-bg-soft"}`}
                >
                  {p.featured && (
                    <div className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-[3px] text-[.72rem] font-bold uppercase tracking-[.05em] text-accent-ink">
                      Mais popular
                    </div>
                  )}
                  <h3 className={`${display} text-xl font-semibold`}>{p.name}</h3>
                  <div className={`${display} mb-0.5 mt-1.5 text-[2.2rem] font-semibold`}>
                    {p.price}
                    <small className="font-sans text-[.95rem] font-normal text-muted">/mês</small>
                  </div>
                  <ul className="mt-5 space-y-1.5">
                    {p.items.map((item) => (
                      <li key={item} className="text-[.93rem] text-muted">
                        <span className="text-accent">→ </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-[64px] md:py-[92px]">
          <div className="mx-auto max-w-[820px] px-6">
            <h2 className={`${display} mb-9 text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.08]`}>
              Perguntas frequentes
            </h2>
            {FAQ.map((f) => (
              <details key={f.q} className="group mb-3 rounded-[18px] border border-line bg-bg-soft px-[22px] py-[18px]">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl text-accent">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">–</span>
                  </span>
                </summary>
                <p className="mt-3 text-[.95rem] text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA (bloco lime) ── */}
        <section className="px-6 pb-[64px] md:pb-[92px]">
          <div className="mx-auto max-w-[1120px] overflow-hidden rounded-[28px] bg-accent px-6 py-14 text-center text-accent-ink md:py-20">
            <h2 className={`${display} mx-auto max-w-[720px] text-[clamp(2rem,4.4vw,3.2rem)] font-semibold leading-[1.06]`}>
              Seu influenciador começa hoje.
            </h2>
            <p className="mx-auto mb-9 mt-4 max-w-[500px] text-[1.05rem] text-accent-ink/75">
              Crie sua conta grátis — o primeiro vídeo é por nossa conta.
            </p>
            <Link
              href="/register"
              className="inline-block rounded-full bg-accent-ink px-8 py-4 text-base font-semibold text-accent transition hover:opacity-90"
            >
              Criar minha conta grátis →
            </Link>
          </div>
        </section>

        <footer className="border-t border-line pb-10 pt-[30px] text-[.85rem] text-muted">
          <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-2.5 px-6">
            <div>© 2026 influai. — todos os vídeos gerados incluem rótulo de conteúdo de IA</div>
            <div className="flex gap-4">
              <Link href="/termos" className="transition hover:text-ink">
                Termos
              </Link>
              <Link href="/privacidade" className="transition hover:text-ink">
                Privacidade
              </Link>
              <span>contato@influai.com.br</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
