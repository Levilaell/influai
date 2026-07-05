# Arquitetura de Jobs — Fábrica de Vídeo

Como o pipeline do protótipo (`prototype/`) vira um sistema de produção: durável, idempotente, com créditos que nunca somem em falha e paralelismo por shot.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Orquestrador | **Trigger.dev v3** (alternativa: Inngest) | Steps duráveis com retry independente, `idempotencyKey` nativo, sem infra própria de fila, TypeScript |
| Modelos | **fal.ai** (queue API + webhooks) | 1 API key, modelos intercambiáveis, fila gerenciada — não seguramos conexão aberta por 3-6 min |
| Storage | **Cloudflare R2** | Egress $0 — servir/baixar vídeo não corrói margem |
| Banco | Postgres (Supabase) | Schema em `database-schema.sql`, RLS pronto |
| Montagem | Worker FFmpeg (Fly.io/Railway, container próprio) | Único estágio que precisa de CPU nossa |

## O fluxo completo

```
usuário confirma ──► API: transação de créditos ──► trigger.dev: video-pipeline
                      1. balance >= estimate?          │
                      2. INSERT hold (-N)              ▼
                      3. video.status = queued    ┌──────────────────────────┐
                                                  │ step 1: script    (Claude)│
                                                  │ step 2: keyframes ──┐     │
                                                  │   shot 0..n em      │ paralelo
                                                  │   PARALELO com      │ por shot
                                                  │ step 3: render  ◄───┘     │
                                                  │ step 4: voice (se tts)    │
                                                  │ step 5: assemble (FFmpeg) │
                                                  │ step 6: finalize          │
                                                  └──────────────────────────┘
                                                       │ sucesso          │ falha terminal
                                                       ▼                  ▼
                                              hold_release da sobra   hold_release TOTAL
                                              status = ready          status = failed
```

### Regra de ouro dos créditos

O ledger é **append-only** (ver schema). Três invariantes:

1. **Hold antes de gastar.** `INSERT hold(-N)` na mesma transação que muda `status → queued`. O índice único `one_hold_per_video` torna o enqueue idempotente — retry do request não segura crédito duas vezes.
2. **Falha devolve tudo.** Qualquer erro terminal → `hold_release(+N)` + `status = failed`. *O usuário nunca paga por vídeo que não recebeu* (a Viral do d0t1 provavelmente cobra — isso vira argumento de marketing).
3. **Sobra volta.** Se o custo real < estimado (ex.: shot reaproveitado em retry), `hold_release` parcial na finalização.

Saldo = `SUM(amount)`. Nunca existe um campo `credits` mutável para corromper.

## Definição do pipeline (Trigger.dev v3, esqueleto)

```ts
export const videoPipeline = task({
  id: "video-pipeline",
  retry: { maxAttempts: 1 }, // retries são POR STEP, não do pipeline inteiro
  run: async ({ videoId }: { videoId: string }) => {
    const video = await db.video.load(videoId);

    // 1. Roteiro
    await setStatus(videoId, "scripting");
    const script = await step(`script:${videoId}`, () => generateScript(video), {
      retry: { maxAttempts: 3, factor: 2 },
    });
    await db.video.saveScript(videoId, script);

    // 2+3. Keyframe → render POR SHOT, em paralelo (pipeline, sem barreira:
    // o shot 0 pode estar renderizando enquanto o shot 3 gera keyframe)
    await setStatus(videoId, "rendering");
    await Promise.all(
      script.shots.map((shot, i) =>
        step(`shot:${videoId}:${i}`, async () => {
          const keyframe = await falQueue("nano-banana-pro/edit", keyframeInput(video, shot, i));
          await db.shot.saveKeyframe(videoId, i, await persistToR2(keyframe));
          const clip = await falQueue("veo3.1/fast/image-to-video", videoInput(video, shot, keyframe));
          await db.shot.saveClip(videoId, i, await persistToR2(clip));
        }, { retry: { maxAttempts: 2 } })
      )
    );

    // 4. Voz (modo tts)
    const voice = video.audioMode === "tts"
      ? await step(`voice:${videoId}`, () => generateVoice(script, video.persona.voiceId))
      : null;

    // 5. Montagem (worker FFmpeg dedicado)
    await setStatus(videoId, "assembling");
    const finalKey = await step(`assemble:${videoId}`, () =>
      ffmpegWorker.assemble({ videoId, voice }), { retry: { maxAttempts: 2 } });

    // 6. Finalização: release da sobra + ready (transação única)
    await finalize(videoId, finalKey);
  },
  onFailure: async ({ videoId }) => releaseHoldAndFail(videoId), // devolve créditos
});
```

**Pontos críticos do esqueleto:**

- **`idempotencyKey` por step** (`shot:videoId:i`): se o pipeline reiniciar, steps concluídos não re-executam — não gera (nem paga) o mesmo shot duas vezes.
- **Retry por step, não do pipeline**: falhou o shot 3, refaz só o shot 3.
- **`falQueue`** usa a *queue API* da fal (`fal.queue.submit` + webhook de conclusão), não `subscribe` — sem conexão pendurada durante os 1-4 min de geração. O webhook cai em `webhook_events` (dedupe por `external_id`) e acorda o step.
- **`persistToR2` imediatamente**: URLs da fal são efêmeras. Todo asset é copiado para o R2 antes do step concluir; o banco só guarda `storage_key`.

## Máquina de estados (`videos.status`)

```
draft → estimated → queued → scripting → keyframing/rendering → [voicing] → assembling → ready
                       │                                                        │
                       └────────────── failed / canceled ◄──────────────────────┘
                                       (sempre com hold_release)
```

Transições só acontecem pelo worker (service role). O front assina mudanças via Supabase Realtime → barra de progresso ao vivo por estágio.

## Política de retry por estágio

| Estágio | Tentativas | Backoff | Falha terminal → |
|---|---|---|---|
| Roteiro (Claude) | 3 | exp. 2x | failed (raro; 429/529 são retryable) |
| Keyframe | 2 | 30s | failed — imagem é barata, mas 2 falhas seguidas = problema de prompt/moderação |
| Render (Veo) | 2 | 60s | failed — estágio mais caro; nunca mais que 2 |
| Voz | 3 | 15s | fallback para `audio_mode=native` do shot ou failed |
| Montagem | 2 | 10s | failed — assets já estão no R2, retry é barato |
| Publicação | 5 | exp. até 1h | publication.failed (não afeta créditos do vídeo) |

## Gates de moderação (antes de gastar crédito)

1. **Criação de persona**: descrição passa por classificador (Claude, 1 chamada barata) — bloqueia pessoa real/celebridade nomeada, menor de idade, NSFW. Resultado salvo em `personas.moderation`. **Este é o maior risco jurídico do produto no Brasil** (direito de imagem + LGPD).
2. **Roteiro**: mesmo gate sobre o `topic` + roteiro gerado, antes do estágio de keyframes.
3. **Rótulo de IA**: `videos.ai_label` default `true` → metadados C2PA no FFmpeg + flag "AI-generated" nas APIs de publicação (Instagram/TikTok já exigem).

## Worker de publicação

Processo separado (cron a cada minuto):

```sql
select * from publications
where status = 'scheduled' and scheduled_at <= now()
for update skip locked limit 20;
```

Adapters por plataforma:

| Plataforma | Fluxo | Observações |
|---|---|---|
| YouTube | upload resumable via Data API | Mais simples — lançar primeiro |
| Instagram | container REELS → poll status → publish | Conta Business; limite 25 posts/24h; app review 2-4 sem |
| TikTok | Content Posting API | Sem auditoria só posta rascunho — iniciar auditoria já |

Coletor de métricas (cron 6/6h) alimenta `publication_metrics` → é o **loop de dados da fase 3** (recomendar hooks/formatos que performam por nicho).

## Custos de infra (estimativa mensal, 1k vídeos/mês)

| Item | Custo |
|---|---|
| Trigger.dev cloud | ~$50 |
| Worker FFmpeg (2 vCPU) | ~$20 |
| R2 (500GB + zero egress) | ~$8 |
| Supabase Pro | $25 |
| **Total fixo** | **~$100/mês** (o variável é COGS de modelo, coberto pelos créditos) |
