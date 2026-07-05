# Influa — o que está implementado e como testar

SaaS de influenciadores de IA: cada usuário cria **marcas**, dentro delas **personas**
(rostos consistentes) que gravam **vídeos** curtos (talking-head com lip-sync),
agenda e publica no Instagram, e a IA **aprende** com o desempenho.

Este documento lista tudo que foi construído e como validar cada parte.

---

## Como rodar (dev)

```bash
pnpm db:up          # sobe o Postgres (docker, porta 5433)
pnpm db:migrate     # aplica as migrations
pnpm dev            # sobe web (localhost:3000) + worker
```

- **Login de teste:** `levi@influa.app` / `senha12345`
- **Créditos:** conceda com `pnpm grant -- --email <email> --amount 1000`
- **Sem túnel:** o Atlas busca mídia via `uploadMedia` (nada de cloudflared).
- **Flags de dev úteis no `.env`:**
  - `SIMULATE_BILLING=1` — simula pagamento (testa o ciclo de cobrança sem Stripe real)
  - `SIMULATE_PUBLISH=1` — simula publicação no Instagram (testa o agendador sem app Meta)
  - E-mails e créditos aparecem no **console** do `pnpm dev` quando não há provedor configurado.

---

## 1. Contas e acesso

Registro com aceite de **Termos + Privacidade**, **verificação de e-mail**, **reset de senha**.

**Como testar:**
1. Abra `/register` (aba anônima) → repare no checkbox de termos (obrigatório) → crie a conta.
2. Você cai em `/brands` com o banner **"Confirme seu e-mail"**. O link de verificação aparece no **console** (`[e-mail dev]`) — cole no navegador.
3. Teste `/forgot` → o link de reset também sai no console → defina nova senha.
- Páginas legais: `/termos` e `/privacidade` (rascunho LGPD — revisar com advogado).

## 2. Onboarding guiado

Checklist **"Comece por aqui"** no topo de `/brands`, derivado dos dados reais
(marca → cérebro → persona → vídeo). Some quando completo; dispensável.

**Como testar:** numa conta nova, veja "0 de 4 passos". Cada passo concluído marca ✓.

## 3. Marcas (o negócio)

Painel por marca com abas: **Cérebro · Recursos · Personas · Vídeos · Agenda · Memória**.

- **Cérebro da Marca:** cole um print de perfil OU texto sobre o negócio → a IA extrai
  o perfil (negócio, público, tom, pilares). Editável campo a campo (botão "editar") ou
  re-analisável de um material novo.
- **Cenários por marca:** ao salvar o cérebro, a IA gera cenários **sob medida do nicho**
  (finanças → home office/quadro de metas; café → balcão/bancada de coados — nunca "academia" em finanças).
- **Recursos:** suba **logo e produtos**; ao criar um vídeo você escolhe quais aparecem na cena
  (a IA compõe o produto na mão da persona, mantendo a marca fiel).

**Como testar:** crie uma marca → aba Cérebro → cole um texto do negócio → Analisar → veja o perfil.
Na aba Recursos, suba uma imagem. Ao criar vídeo, os cenários no seletor serão do seu nicho.

## 4. Personas (o rosto)

Wizard: dados + **voz** (22 vozes ElevenLabs com **preview "ouvir"**) → **4 rostos candidatos**
→ escolher (grátis) → **character sheet** travado (mesmo rosto em 4 ângulos). Custo único de
criação; **escolher o rosto não gasta créditos**. A voz é **editável** depois (card "Voz da persona").

**Como testar:** aba Personas → Nova persona → escolha a voz (clique "ouvir") → Gerar 4 rostos →
escolha um → aguarde o sheet → pronta. Depois, no card de voz, troque a voz.

## 5. Vídeos (a fábrica)

Tema (ou **"Me dê ideias"**) → **roteiro editável** (com **custo ao vivo**) → gerar.
O pipeline: moderação → keyframe (rosto na cena) → voz (ElevenLabs) → **lip-sync (Kling)** →
montagem (legendas + estilo). Falhas **devolvem 100% dos créditos**.

**Estilo escolhido pelo usuário (sem surpresas):**
- **Cenário** (da marca) · **Dinâmica de câmera** (Estático / Sutil / **Dinâmico** = cortes de enquadramento) ·
  **Música de fundo** (Calma/Corporativa/Energética, com ducking sob a voz) · **Cartela de gancho** ·
  **Corte de B-roll** (a IA corta para um clipe ilustrativo no melhor momento, mantendo a voz).
- **Guarda-rails de conteúdo:** não inventa estatística; em nichos sensíveis (finanças/saúde/jurídico)
  evita promessas garantidas e adiciona ressalva. A moderação bloqueia promessa enganosa.

**Como testar:** aba Vídeos → Novo vídeo → "Me dê ideias" (tente um tema financeiro pra ver o guarda-rail)
→ escolha o estilo → Gerar roteiro → confira o custo ao vivo → Gerar vídeo → acompanhe o progresso
(pode fechar; o header mostra "N gerando"). No vídeo pronto: legendas rápidas, movimento de câmera,
música (se escolhida), B-roll (se escolhido).

## 6. Séries — "Gerar minha semana"

Gera **vários vídeos variados de uma vez** (motor de ideias + **memória antirrepetição**),
como rascunhos. Roda em **background** (mostra "Gerando sua semana N/M"). Depois, **"Gerar N rascunho(s)"**
enfileira todos.

**Como testar:** aba Vídeos → **Gerar minha semana** → persona + quantidade + estilo → Gerar.
Veja o progresso na marca; os rascunhos aparecem na aba Vídeos. Clique "Gerar N rascunho(s)" pra enfileirar.

## 7. Publicação (Instagram)

- **Agendar publicação** no vídeo pronto (data/hora + legenda) → aparece na aba **Agenda**.
- **Conectar Instagram** (OAuth) na aba Agenda — liga quando o app Meta estiver configurado.
- Um **cron publisher** publica no horário agendado (Reels via Content Publishing API).

**Como testar (sem app Meta):** no vídeo pronto → Agendar publicação. Veja na aba Agenda.
Com `SIMULATE_PUBLISH=1` e um horário 1-2 min no futuro, o status vira "Publicado".
O botão "Conectar Instagram" mostra "entra no ar após aprovação da Meta" até o app existir.

## 8. Métricas e aprendizado (o diferencial)

No vídeo pronto, **registrar desempenho** (views/curtidas/comentários/salvamentos — manual agora,
IG Insights depois). Na aba **Memória**, **"Analisar desempenho"** faz a IA comparar os vídeos e
extrair **aprendizados** (o que funciona pra AQUELA marca). Esses aprendizados **entram na próxima
geração** de roteiro e ideias — o loop fecha.

**Como testar:** registre números em 2+ vídeos → aba Memória → Analisar desempenho → veja os aprendizados.

## 9. Cobrança (Stripe) e créditos

Planos **Starter R$127 / Pro R$397 / Studio R$997** (créditos mensais + capacidade). Assinatura via
**Stripe** (test mode não exige CNPJ). Créditos: **ledger append-only**, reserva na geração, devolução
automática em falha. Retenção: só o `final.mp4` é mantido (intermediários são descartados).

**Como testar:** `/credits` mostra os planos e o extrato. Com `STRIPE_SECRET_KEY` + Prices configurados
(ver `PENDENCIAS.md`), "Assinar" gera o checkout real. Com `SIMULATE_BILLING=1`, dá pra testar o ciclo.

---

## O que ainda depende de você

Está tudo em **`PENDENCIAS.md`** — resumo:
- **Stripe:** chave de teste + 3 Prices recorrentes (posso criar via API se você passar a `sk_test_`).
- **App Meta + review** (2-4 semanas) para a publicação automática real.
- **Deploy** (Vercel + R2 + Postgres hospedado + domínio) — destrava webhooks e OAuth (precisam de URL pública).
- **B-roll (Veo):** validar visualmente precisa de saldo Atlas.
- **Segurança:** rotacionar as chaves de API que passaram pelo chat.

## Scripts de teste (referência)

Os testes deste desenvolvimento rodaram via `node --import tsx` chamando as funções do core
diretamente (fluxo de créditos, cobrança, agendamento, métricas, B-roll, etc.). O smoke do pipeline
de vídeo é `pnpm smoke`.
