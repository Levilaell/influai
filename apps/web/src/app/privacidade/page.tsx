import Link from "next/link";

export const metadata = { title: "Política de Privacidade — Influai" };

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
      <Link href="/" className="text-sm text-muted hover:text-accent">← influai.</Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted">Rascunho — sujeito a revisão jurídica (LGPD). Última atualização: 2026.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="text-base font-semibold text-ink">1. Dados que coletamos</h2>
          <p>Dados de conta (nome, e-mail, senha com hash), o conteúdo que você cria (marcas, personas, roteiros, vídeos), e dados de uso e pagamento. Imagens de referência (prints/produtos) que você envia são usadas apenas para gerar o seu conteúdo.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">2. Como usamos</h2>
          <p>Para operar o serviço: gerar vídeos, processar pagamentos, dar suporte e melhorar o produto. Não vendemos seus dados.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">3. Compartilhamento com terceiros</h2>
          <p>Usamos provedores para viabilizar o serviço: geração de mídia (Atlas Cloud), voz (ElevenLabs), IA de texto (Anthropic), pagamento (Stripe) e envio de e-mail. Eles processam dados apenas para as finalidades acima.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">4. Seus direitos (LGPD)</h2>
          <p>Você pode acessar, corrigir ou excluir seus dados, e solicitar a exclusão da conta a qualquer momento, escrevendo para privacidade@influai.com.br.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">5. Retenção</h2>
          <p>Guardamos seu conteúdo enquanto sua conta estiver ativa. Vídeos finais são mantidos durante a assinatura e por um período após; arquivos intermediários são descartados após a montagem.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-ink">6. Contato do encarregado</h2>
          <p>privacidade@influai.com.br</p>
        </section>
      </div>
    </main>
  );
}
