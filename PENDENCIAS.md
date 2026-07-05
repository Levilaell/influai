# Pendências do Levi (coisas que só você pode fazer)

Estas são as tarefas que dependem de contas, aprovações ou decisões externas — o
código do meu lado já está pronto ou estruturado esperando por elas.

## 🔴 Alta prioridade (destravam lançar / faturar)

### 1. Stripe (cobrança) — substituiu a AbacatePay (que exige CNPJ)
- [x] ✅ Chave de teste configurada no `.env` (`rk_test_...`)
- [x] ✅ **3 Prices recorrentes criados via API** (Starter R$127 / Pro R$397 / Studio R$997), IDs no `.env`
- [x] ✅ Checkout real testado — "Assinar" gera a página de pagamento do Stripe (cartão de teste `4242 4242 4242 4242`)
- [ ] ⚠️ **Revogar a chave `rk_live_...`** que você mandou antes (era LIVE e ficou exposta no chat)
- [ ] **Testar o webhook** (o que credita ao pagar): rode o **Stripe CLI** — `stripe listen --forward-to localhost:3000/api/webhooks/stripe` → ele te dá um `whsec_...` (coloca no `.env` como `STRIPE_WEBHOOK_SECRET`) e encaminha os eventos reais pro localhost. Aí pague no checkout de teste e veja os créditos caírem.
- [ ] **Após o deploy:** criar o webhook no painel do Stripe apontando pro seu domínio + o signing secret.
- [ ] Ao lançar: trocar as chaves de **teste** pelas de **produção**.
- 💡 A chave é **restrita** (`rk_test_`) — funcionou pra tudo que precisamos; vale rotacionar depois já que passou no chat.

### 2. Meta / Instagram (publicação automática) — maior lead time, comece já
> O código de OAuth + conexão + publicação **já está pronto e testado** (fundação). Falta só criar o app e passar no review — aí liga sozinho.
- [ ] Criar um **app Business** em developers.facebook.com
- [ ] Adicionar os produtos **Instagram** e **Facebook Login**
- [ ] Configurar o **redirect URI** do Facebook Login para `https://SEU_DOMINIO/api/instagram/callback`
- [ ] Colar no `.env`: `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET` (é só isso que o código espera)
- [ ] Solicitar a permissão **`instagram_business_content_publish`**
- [ ] Fazer a **verificação de negócio** (Business Verification)
- [ ] Ter **Política de Privacidade** publicada (já existe rascunho em `/privacidade`)
- [ ] Submeter para **App Review** com um screencast do fluxo (conectar conta → agendar → publicar) — leva **2 a 4 semanas**
- ✅ Depois de configurado, o botão **"Conectar Instagram"** (aba Agenda da marca) já funciona

### 3. Atlas Cloud
- [ ] Manter **saldo** (pay-as-you-go; recarga única ~US$30 pega +20% de bônus na 1ª)

## 🟡 Média prioridade (produção)

### 4. Cloudflare R2 (storage durável)
- [ ] Criar conta Cloudflare + um **bucket R2**
- [ ] Gerar **API token** (Access Key + Secret) → me passar pra colocar no `.env`
  (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`)
- (o driver de storage já vai estar pronto esperando essas credenciais)

### 5. E-mail transacional (verificação de conta / reset de senha)
- [ ] Criar conta num provedor (recomendo **Resend** — simples e barato) e me passar a API key (`RESEND_API_KEY`)
- 💡 Em dev, os e-mails são impressos no console (não precisa de nada pra testar)

### 6. Música de fundo
- [ ] Decisão: vou embutir algumas trilhas simples **geradas por mim** (100% livres de direitos) como ponto de partida. Se quiser trilhas melhores depois, escolha uma fonte licenciada (ex: **Uppbeat**, **Epidemic Sound**) — aí é só trocar os arquivos numa pasta. **Nunca** música do TikTok/Spotify (IG/TikTok mutam e é ilegal).

## 🟢 Baixa prioridade / contínuo

### 7. Segurança
- [ ] **Rotacionar** as chaves de API que foram coladas no chat (Anthropic, Atlas, ElevenLabs) — elas ficaram expostas
### 8. Legal
- [ ] Revisar com um advogado os **Termos de Uso** e **Política de Privacidade** (LGPD) que eu vou redigir como rascunho
### 9. Infra de produção
- [ ] Registrar **domínio** + escolher hospedagem (Vercel p/ o web + um host p/ o worker e o Postgres)

---
_Atualizado por mim conforme as coisas andam. O que é do meu lado (código) eu vou tocando na sequência: higiene de conta → R2 → música → onboarding → calendário → B-roll/métricas._
