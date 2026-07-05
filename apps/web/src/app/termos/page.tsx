import Link from "next/link";

export const metadata = { title: "Termos de Uso — Influai" };

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
      <Link href="/" className="text-sm text-muted hover:text-accent">← influai.</Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted">Rascunho — sujeito a revisão jurídica. Última atualização: 2026.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="text-base font-semibold text-ink">1. O serviço</h2>
          <p>A Influai é uma ferramenta que gera personas sintéticas e vídeos curtos com inteligência artificial. Todo o conteúdo é 100% sintético — não representa pessoas reais.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">2. Uso responsável</h2>
          <p>Você é responsável pelo conteúdo que cria e publica, incluindo a veracidade das informações e a conformidade com as regras das plataformas de destino. É proibido usar a Influai para recriar pessoas reais ou celebridades, gerar conteúdo enganoso, ilegal, difamatório ou que viole direitos de terceiros.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">3. Rotulagem de IA</h2>
          <p>O conteúdo é gerado por IA. Você é responsável por sinalizar isso nas plataformas onde publicar, conforme as regras de cada uma.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">4. Créditos e pagamentos</h2>
          <p>A geração consome créditos, concedidos por assinatura. Cobranças recorrentes são processadas por nosso parceiro de pagamento. Créditos de gerações que falham são devolvidos automaticamente.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">5. Limitação de responsabilidade</h2>
          <p>A Influai é fornecida "como está". Não nos responsabilizamos por decisões tomadas com base no conteúdo gerado nem por penalidades aplicadas por plataformas de terceiros.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">6. Contato</h2>
          <p>Dúvidas: suporte@influai.com.br</p>
        </section>
      </div>
    </main>
  );
}
