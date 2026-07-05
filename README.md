# AI Influencer — Fábrica de Influenciadores de IA

SaaS para criar influenciadores de IA com rosto consistente, gerar vídeos prontos pra postar e publicar automaticamente. Posicionamento: **ferramenta, não curso** (vs. viral.doti.gg e afins).

## Rodar o MVP (dev)

```bash
cp .env.example .env          # preencher chaves (Atlas, ElevenLabs, Anthropic) e secrets
pnpm install
pnpm db:up                    # Postgres via Docker (porta 5433)
pnpm db:migrate
pnpm dev                      # web (localhost:3000) + worker

# (Não precisa de túnel: áudio e imagens de referência sobem para o storage
#  do próprio Atlas via uploadMedia — o Atlas busca do storage dele mesmo.)

# Conceder créditos a um beta tester:
pnpm grant -- --email fulano@x.com --amount 1000 --note "beta"

# Smoke test do pipeline (sem UI):
pnpm smoke
```

## Estrutura

| Pasta | O que é |
|---|---|
| [`prototype/`](prototype/) | Pipeline funcional em Node.js: persona → roteiro (Claude) → keyframes (Nano Banana Pro) → vídeo (Veo 3.1) → voz (ElevenLabs) → montagem (FFmpeg). Roda hoje com uma chave da fal.ai. |
| [`docs/database-schema.sql`](docs/database-schema.sql) | Schema PostgreSQL completo: personas, vídeos, ledger de créditos append-only, publicação, métricas. |
| [`docs/jobs-architecture.md`](docs/jobs-architecture.md) | Arquitetura de jobs duráveis (Trigger.dev): idempotência, retry por estágio, hold/release de créditos, moderação, workers de publicação. |
| [`landing/index.html`](landing/index.html) | Landing page de validação com waitlist (PT-BR, self-contained — deploy em Cloudflare Pages/Vercel). |

## Começar agora

```bash
# 1. Validar o pipeline (custo ~$4-6 por vídeo de teste)
cd prototype && npm install && cp .env.example .env  # preencher chaves
node pipeline.js --persona "Lia" --tema "3 apps de IA que parecem mágica"

# 2. Publicar a landing (plugar Formspree no index.html antes)
npx wrangler pages deploy landing/

# 3. Iniciar HOJE os app reviews (gargalo de calendário):
#    - Meta (instagram_business_content_publish): 2-4 semanas
#    - TikTok Content Posting API (auditoria p/ post público): semanas
```

## Decisões de produto (resumo)

- **Diferencial #1:** Persona Lock — mesmo rosto em todos os vídeos (character sheet + identity lock; LoRA na fase 2).
- **Créditos transparentes:** custo mostrado antes de gerar; falha devolve crédito (ledger append-only garante).
- **Compliance nativo:** persona 100% sintética (bloqueio de pessoa real), rótulo de IA nos posts.
- **Fosso (fase 3):** loop de dados — métricas reais → recomendação de hooks/formatos por nicho.
